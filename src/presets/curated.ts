import { fetchNoCors } from "@decky/api"

import { CuratedPresetsDocV1 } from "./types"

type Cached<T> = { value: T; cachedAt: number }

const CACHE_KEY_PREFIX = "decktuner-curated-presets-cache:"

const getCacheKey = (appid: number) => `${CACHE_KEY_PREFIX}${appid}`

const cacheGet = <T,>(key: string): Cached<T> | null => {
	try {
		const raw = window.localStorage.getItem(key)
		return raw ? (JSON.parse(raw) as Cached<T>) : null
	} catch {
		return null
	}
}

const cacheSet = (key: string, value: any) => {
	window.localStorage.setItem(key, JSON.stringify(value))
}

export async function fetchCuratedPresets(
	appid: number,
	baseUrl: string,
	ttlMs: number = 6 * 60 * 60 * 1000
): Promise<{ doc: CuratedPresetsDocV1 | null; source: "network" | "cache" | "none" }> {
	const cacheKey = getCacheKey(appid)
	const cached = cacheGet<CuratedPresetsDocV1>(cacheKey)
	if (cached && Date.now() - cached.cachedAt < ttlMs) {
		return { doc: cached.value, source: "cache" }
	}

	const url = `${baseUrl.replace(/\/$/, "")}/presets/${appid}.json`
	const res = await fetchNoCors(url, { method: "GET" })
	if (!res.ok) {
		if (cached) return { doc: cached.value, source: "cache" }
		return { doc: null, source: "none" }
	}

	try {
		const doc = JSON.parse(await res.text()) as CuratedPresetsDocV1
		cacheSet(cacheKey, { value: doc, cachedAt: Date.now() })
		return { doc, source: "network" }
	} catch {
		if (cached) return { doc: cached.value, source: "cache" }
		return { doc: null, source: "none" }
	}
}


