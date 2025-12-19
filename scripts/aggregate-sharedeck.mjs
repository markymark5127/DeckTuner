/**
 * Pulls ShareDeck reports and generates an auto-curated presets file.
 *
 * Output:
 * - curation/presets.auto.json
 *
 * Notes:
 * - This is intentionally best-effort. ShareDeck provides SteamOS/perf knobs, but not game config paths.
 * - We bucket reports by ShareDeck `device` and produce `profiles_by_device` plus generic fallback `profiles`.
 */

import fs from "node:fs"
import path from "node:path"

const repoRoot = process.cwd()

const sourcePath =
	process.env.DECKTUNER_SOURCE ??
	path.join(repoRoot, "curation", "presets.source.json")
const outPath =
	process.env.DECKTUNER_AUTO_OUT ??
	path.join(repoRoot, "curation", "presets.auto.json")

const SHAREDECK_ENDPOINT =
	process.env.DECKTUNER_SHAREDECK_ENDPOINT ??
	"https://sharedeck.games/api/experimental/reports?app_id=${appid}"

const HALF_LIFE_DAYS = Number(process.env.DECKTUNER_WEIGHT_HALFLIFE_DAYS ?? 90)

function fail(msg) {
	console.error(`[decktuner:aggregate-sharedeck] ${msg}`)
	process.exit(1)
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, obj) {
	fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8")
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n))
}

function parseNumber(v) {
	if (v === null || v === undefined) return null
	if (typeof v === "number" && Number.isFinite(v)) return v
	if (typeof v === "string") {
		const x = Number(v)
		return Number.isFinite(x) ? x : null
	}
	return null
}

function toDeviceVariant(deviceStr) {
	if (!deviceStr) return "unknown"
	const d = String(deviceStr).toLowerCase()
	if (d.includes("steamdeck_oled")) return "steamdeck_oled"
	if (d.includes("steamdeck_lcd")) return "steamdeck_lcd"
	// ShareDeck may introduce additional device tags over time; keep unknown as a safe bucket.
	return "unknown"
}

function weightForReport(report) {
	const nowMs = Date.now()
	const tsStr = report.updated_at ?? report.created_at
	const tsMs = tsStr ? Date.parse(tsStr) : NaN
	const ageDays = Number.isFinite(tsMs)
		? Math.max(0, (nowMs - tsMs) / (1000 * 60 * 60 * 24))
		: 3650

	// Exponential decay so newer reports dominate.
	const decay = Math.pow(0.5, ageDays / Math.max(1, HALF_LIFE_DAYS))

	// Prefer higher-score reports (ShareDeck `score` seems to be a per-report score).
	const score = parseNumber(report.score) ?? 0
	const scoreBoost = 1 + clamp(score, 0, 10) * 0.25

	return decay * scoreBoost
}

function weightedMedian(samples) {
	// samples: Array<{ v:number, w:number }>
	const filtered = samples
		.filter((s) => Number.isFinite(s.v) && Number.isFinite(s.w) && s.w > 0)
		.sort((a, b) => a.v - b.v)
	if (filtered.length === 0) return null
	const total = filtered.reduce((acc, s) => acc + s.w, 0)
	if (total <= 0) return null
	let cum = 0
	for (const s of filtered) {
		cum += s.w
		if (cum >= total / 2) return s.v
	}
	return filtered[filtered.length - 1].v
}

function weightedMode(samples) {
	// samples: Array<{ v:string, w:number }>
	const m = new Map()
	for (const s of samples) {
		if (!s.v || !Number.isFinite(s.w) || s.w <= 0) continue
		m.set(s.v, (m.get(s.v) ?? 0) + s.w)
	}
	let best = null
	let bestW = -1
	for (const [k, w] of m.entries()) {
		if (w > bestW) {
			bestW = w
			best = k
		}
	}
	return best
}

function weightedBool(samples) {
	// samples: Array<{ v:boolean, w:number }>
	let t = 0
	let f = 0
	for (const s of samples) {
		if (!Number.isFinite(s.w) || s.w <= 0) continue
		if (s.v === true) t += s.w
		if (s.v === false) f += s.w
	}
	if (t === 0 && f === 0) return null
	return t >= f
}

function categorize(report) {
	// Heuristic categorization based on FPS limit.
	const fps = parseNumber(report.framerate_limit)
	if (fps !== null && fps >= 55) return "framerate"
	if (fps !== null && fps <= 30) return "battery_saver"
	// mid-range (often 40) defaults to graphics category
	return "graphics"
}

function scalingModeFromFilter(filter) {
	if (!filter) return null
	const f = String(filter).toLowerCase()
	if (f.includes("fsr")) return "fsr"
	if (f.includes("nis")) return "nis"
	if (f.includes("integer")) return "integer"
	if (f.includes("linear")) return "linear"
	return "unknown"
}

function aggregatePreset(reports, label) {
	const samples = reports.map((r) => ({ r, w: weightForReport(r) }))

	const fpsLimit = weightedMedian(
		samples
			.map(({ r, w }) => ({ v: parseNumber(r.framerate_limit), w }))
			.filter((s) => s.v !== null)
			// @ts-ignore
			.map((s) => ({ v: s.v, w: s.w }))
	)

	const refreshRateHz = weightedMedian(
		samples
			.map(({ r, w }) => ({ v: parseNumber(r.screen_refresh_rate), w }))
			.filter((s) => s.v !== null)
			// @ts-ignore
			.map((s) => ({ v: s.v, w: s.w }))
	)

	const tdpLimitW = weightedMedian(
		samples
			.map(({ r, w }) => ({ v: parseNumber(r.tdp_limit), w }))
			.filter((s) => s.v !== null)
			// @ts-ignore
			.map((s) => ({ v: s.v, w: s.w }))
	)

	const gpuClockMhz = weightedMedian(
		samples
			.map(({ r, w }) => ({ v: parseNumber(r.gpu_clock), w }))
			.filter((s) => s.v !== null)
			// @ts-ignore
			.map((s) => ({ v: s.v, w: s.w }))
	)

	const halfRateShading = weightedBool(
		samples
			.filter(({ r }) => typeof r.halfrate_shading === "boolean")
			.map(({ r, w }) => ({ v: !!r.halfrate_shading, w }))
	)

	const scalingMode = weightedMode(
		samples
			.map(({ r, w }) => ({
				v: scalingModeFromFilter(r.scaling_filter),
				w,
			}))
			.filter((s) => s.v !== null)
			// @ts-ignore
			.map((s) => ({ v: s.v, w: s.w }))
	)

	const reportCount = reports.length
	const preset = {
		label,
		notes:
			reportCount > 0
				? `Auto-curated from ShareDeck (${reportCount} report(s), weighted toward newer).`
				: "No ShareDeck data available yet for this category/device.",
		steamos: reportCount
			? {
					perGameProfile: true,
					fpsLimit: fpsLimit ?? null,
					refreshRateHz: refreshRateHz ?? null,
					tdpLimitW: tdpLimitW ?? null,
					gpuClockMhz: gpuClockMhz ?? null,
					halfRateShading: halfRateShading ?? null,
					scalingMode: scalingMode ?? null,
			  }
			: undefined,
	}

	const reportIds = reports.map((r) => r.id).filter((x) => Number.isInteger(x))
	return { preset, reportIds }
}

async function fetchReports(appid) {
	const url = SHAREDECK_ENDPOINT.replace("${appid}", String(appid))
	const res = await fetch(url, { method: "GET" })
	if (!res.ok) return []
	const text = await res.text()
	try {
		const arr = JSON.parse(text)
		return Array.isArray(arr) ? arr : []
	} catch {
		return []
	}
}

async function main() {
	if (!fs.existsSync(sourcePath)) {
		fail(`Missing source file: ${sourcePath}`)
	}

	const source = readJson(sourcePath)
	const apps = source?.apps
	if (!Array.isArray(apps)) {
		fail("curation/presets.source.json must contain an `apps` array.")
	}

	const outApps = []

	for (const app of apps) {
		const appid = app?.appid
		if (!Number.isInteger(appid) || appid <= 0) continue

		const reports = await fetchReports(appid)

		// Bucket by device + category
		const byDevice = new Map()
		for (const r of reports) {
			const device = toDeviceVariant(r.device)
			const category = categorize(r)
			const key = `${device}:${category}`
			if (!byDevice.has(key)) byDevice.set(key, [])
			byDevice.get(key).push(r)
		}

		const deviceVariants = ["steamdeck_oled", "steamdeck_lcd", "unknown"]
		const categories = ["battery_saver", "framerate", "graphics"]

		const profiles_by_device = {}
		const collectedReportIds = new Set()

		for (const dv of deviceVariants) {
			const perCat = {}
			let any = false
			for (const cat of categories) {
				const rs = byDevice.get(`${dv}:${cat}`) ?? []
				const label =
					cat === "battery_saver"
						? "Battery Saver"
						: cat === "framerate"
							? "Framerate"
							: "Graphics"
				const { preset, reportIds } = aggregatePreset(rs, label)
				perCat[cat] = preset
				for (const id of reportIds) collectedReportIds.add(id)
				if (rs.length > 0) any = true
			}
			if (any) profiles_by_device[dv] = perCat
		}

		// Generic fallback: aggregate across all devices.
		const byCatAll = {
			battery_saver: [],
			framerate: [],
			graphics: [],
		}
		for (const r of reports) {
			byCatAll[categorize(r)].push(r)
		}
		const profiles = {}
		for (const cat of categories) {
			const label =
				cat === "battery_saver"
					? "Battery Saver"
					: cat === "framerate"
						? "Framerate"
						: "Graphics"
			profiles[cat] = aggregatePreset(byCatAll[cat], label).preset
		}

		outApps.push({
			appid,
			game_name: app?.game_name,
			updated_at: new Date().toISOString(),
			device_targets: app?.device_targets,
			profiles,
			profiles_by_device: Object.keys(profiles_by_device).length
				? profiles_by_device
				: undefined,
			source: {
				provider: "sharedeck",
				ranking: {
					strategy: "sharedeck_weighted_aggregate",
					score: reports.length,
				},
				report_ids: Array.from(collectedReportIds).slice(0, 500),
			},
		})
	}

	writeJson(outPath, {
		meta: {
			schema: "decktuner-curation-auto-v1",
			generated_at: new Date().toISOString(),
			sharedeck_endpoint: SHAREDECK_ENDPOINT,
			weight_half_life_days: HALF_LIFE_DAYS,
			note: "Generated from ShareDeck reports. Intended to be merged with curated/community presets that include in-game config targets.",
		},
		apps: outApps,
	})

	console.log(
		`[decktuner:aggregate-sharedeck] Wrote ${outApps.length} app(s) to ${outPath}`
	)
}

main().catch((e) => fail(e?.message ?? String(e)))


