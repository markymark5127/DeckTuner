import { CuratedPresetsDocV1, Preset, PresetCategory } from "./types"

const OVERRIDE_KEY_PREFIX = "decktuner-preset-override:"

type OverrideDoc = {
	appid: number
	overrides: Partial<Record<PresetCategory, Preset>>
	updated_at: string
}

const nowIso = () => new Date().toISOString()

async function trySteamStorageGet(key: string): Promise<any | null> {
	try {
		if (SteamClient?.Storage?.GetJSON) {
			const raw = await SteamClient.Storage.GetJSON(key)
			if (!raw) return null
			return JSON.parse(raw)
		}
	} catch {
		// ignore
	}
	return null
}

async function trySteamStorageSet(key: string, value: any): Promise<boolean> {
	try {
		if (SteamClient?.Storage?.SetObject) {
			await SteamClient.Storage.SetObject(key, value)
			return true
		}
	} catch {
		// ignore
	}
	return false
}

function localGet(key: string): any | null {
	try {
		const raw = window.localStorage.getItem(key)
		return raw ? JSON.parse(raw) : null
	} catch {
		return null
	}
}

function localSet(key: string, value: any) {
	window.localStorage.setItem(key, JSON.stringify(value))
}

export async function getPresetOverrides(appid: number): Promise<OverrideDoc | null> {
	const key = `${OVERRIDE_KEY_PREFIX}${appid}`
	const fromSteam = await trySteamStorageGet(key)
	if (fromSteam) return fromSteam as OverrideDoc
	return localGet(key) as OverrideDoc | null
}

export async function setPresetOverride(
	appid: number,
	category: PresetCategory,
	preset: Preset
): Promise<void> {
	const key = `${OVERRIDE_KEY_PREFIX}${appid}`
	const current = (await getPresetOverrides(appid)) ?? {
		appid,
		overrides: {},
		updated_at: nowIso(),
	}
	current.overrides[category] = preset
	current.updated_at = nowIso()
	const ok = await trySteamStorageSet(key, current)
	if (!ok) localSet(key, current)
}

export async function clearPresetOverride(
	appid: number,
	category: PresetCategory
): Promise<void> {
	const key = `${OVERRIDE_KEY_PREFIX}${appid}`
	const current = await getPresetOverrides(appid)
	if (!current) return
	delete current.overrides[category]
	current.updated_at = nowIso()
	const ok = await trySteamStorageSet(key, current)
	if (!ok) localSet(key, current)
}

export async function resolveEffectivePreset(
	curated: CuratedPresetsDocV1 | null,
	appid: number,
	category: PresetCategory
): Promise<{ preset: Preset | null; source: "override" | "curated" | "none" }> {
	const overrideDoc = await getPresetOverrides(appid)
	const o = overrideDoc?.overrides?.[category]
	if (o) return { preset: o, source: "override" }
	const c = curated?.profiles?.[category]
	if (c) return { preset: c, source: "curated" }
	return { preset: null, source: "none" }
}


