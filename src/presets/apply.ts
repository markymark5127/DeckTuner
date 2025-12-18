import { ServerAPI } from "decky-frontend-lib"

import { callBackend } from "../backend"
import { PluginSettings } from "../context"
import { Preset } from "./types"

type ApplyResult = {
	appid: number
	dry_run: boolean
	applied: any[]
	skipped: any[]
	failed: any[]
	messages: string[]
	restart_required: boolean
}

// SteamClient performance APIs are private/non-typed; keep calls guarded.
async function tryApplySteamOsViaSteamClient(appid: number, preset: Preset): Promise<string[]> {
	const msgs: string[] = []
	const s = preset.steamos
	if (!s) return msgs

	// We do not know the exact APIs at build time; provide guarded attempts.
	// This is intentionally “best effort” and will no-op safely if APIs are absent.
	try {
		const settingsObj = {
			fps_limit: s.fpsLimit ?? undefined,
			refresh_rate_hz: s.refreshRateHz ?? undefined,
			tdp_limit_w: s.tdpLimitW ?? undefined,
			allow_tearing: s.allowTearing ?? undefined,
			gpu_clock_mhz: s.gpuClockMhz ?? undefined,
			scaling_mode: s.scalingMode ?? undefined,
			fsr_sharpness: s.fsrSharpness ?? undefined,
			half_rate_shading: s.halfRateShading ?? undefined,
		}

		// Candidate modules/objects where performance setters may exist.
		// @ts-ignore
		const candidates: any[] = [
			// @ts-ignore
			SteamClient?.System?.Performance,
			// @ts-ignore
			SteamClient?.SystemPerformance,
			// @ts-ignore
			SteamClient?.Performance,
			// @ts-ignore
			SteamClient?.SystemSettings,
			// @ts-ignore
			SteamClient?.Settings,
			// @ts-ignore
			SteamClient,
		].filter(Boolean)

		const methodNames = [
			"SetAppPerformanceProfile",
			"SetPerAppPerformanceProfile",
			"SetAppPerformanceSettings",
			"SetPerAppPerformanceSettings",
			"SetPerGamePerformanceProfile",
			"SetPerGamePerformanceSettings",
		]

		for (const obj of candidates) {
			for (const name of methodNames) {
				try {
					if (typeof obj?.[name] !== "function") continue
					await obj[name](appid, settingsObj)
					msgs.push(`Applied SteamOS settings via SteamClient.${name}.`)
					return msgs
				} catch (e: any) {
					msgs.push(
						`Attempt SteamClient.${name} failed: ${
							e?.message ?? String(e)
						}`
					)
				}
			}
		}

		msgs.push(
			"No supported SteamClient performance setter found; SteamOS apply skipped."
		)
		return msgs
	} catch (e: any) {
		msgs.push(`SteamClient performance apply threw: ${e?.message ?? String(e)}`)
		return msgs
	}
}

export async function applyPreset(
	serverApi: ServerAPI,
	settings: PluginSettings,
	appid: number,
	preset: Preset,
	dryRun: boolean = false
): Promise<ApplyResult> {
	const out: ApplyResult = {
		appid,
		dry_run: dryRun,
		applied: [],
		skipped: [],
		failed: [],
		messages: [],
		restart_required: false,
	}

	if (settings.enableSteamOsApply) {
		const msgs = await tryApplySteamOsViaSteamClient(appid, preset)
		out.messages.push(...msgs)
	}

	const hasGraphicsTargets = (preset.graphics?.targets?.length ?? 0) > 0
	if (hasGraphicsTargets && !settings.enableGraphicsWriter) {
		out.skipped.push({ area: "graphics", reason: "disabled_in_settings" })
		out.restart_required = true
		return out
	}

	if (hasGraphicsTargets) {
		const res = await callBackend<ApplyResult>(serverApi, "apply_preset", {
			appid,
			preset,
			dry_run: dryRun,
		})
		// merge backend results
		out.applied.push(...(res.applied ?? []))
		out.skipped.push(...(res.skipped ?? []))
		out.failed.push(...(res.failed ?? []))
		out.messages.push(...(res.messages ?? []))
		out.restart_required = out.restart_required || !!res.restart_required
	}

	return out
}

export async function discoverSteamOsStorage(serverApi: ServerAPI) {
	return await callBackend<any>(serverApi, "discover_perf_profile_storage", {})
}

export async function getDeviceInfo(serverApi: ServerAPI) {
	return await callBackend<any>(serverApi, "get_device_info", {})
}

export async function recordModeStart(serverApi: ServerAPI, appid: number, watchRoots: string[]) {
	return await callBackend<any>(serverApi, "record_mode_start", {
		appid,
		watch_roots: watchRoots,
	})
}

export async function recordModeStop(serverApi: ServerAPI, sessionId: string) {
	return await callBackend<any>(serverApi, "record_mode_stop", { session_id: sessionId })
}


