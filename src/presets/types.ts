export type PresetCategory = "battery_saver" | "framerate" | "graphics"

export type DeviceVariant = "steamdeck_oled" | "steamdeck_lcd" | "unknown"

export type ProfilesByDevice = Partial<
	Record<DeviceVariant, Record<PresetCategory, Preset>>
>

export type SteamosPreset = {
	// These are intentionally “normalized” fields; mapping to actual SteamOS keys happens in apply layer.
	perGameProfile?: boolean
	fpsLimit?: number | null
	refreshRateHz?: number | null
	allowTearing?: boolean | null
	tdpLimitW?: number | null
	gpuClockMhz?: number | null
	scalingMode?: "linear" | "fsr" | "nis" | "integer" | "unknown" | null
	fsrSharpness?: number | null
	halfRateShading?: boolean | null
}

export type GraphicsPatch =
	| {
			section?: string | null
			key: string
			type?: "string" | "int" | "float" | "bool"
			value: any
	  }
	| {
			pattern: string
			replace: string
	  }

export type GraphicsTargetPath =
	| { type: "proton_prefix"; relative: string }
	| { type: "absolute"; path: string }
	| { type: "linux_config"; relative: string }
	| { type: "linux_share"; relative: string }

export type GraphicsTarget = {
	adapter: "ini" | "unreal_ini" | "json" | "cfg" | "regex"
	priority?: number
	path: GraphicsTargetPath
	patches: GraphicsPatch[]
}

export type Preset = {
	label: string
	notes?: string
	requiresRestart?: boolean
	steamos?: SteamosPreset
	graphics?: {
		applyMode?: "best_effort" | "strict"
		targets?: GraphicsTarget[]
	}
}

export type CuratedPresetsDocV1 = {
	schema_version: 1
	appid: number
	game_name?: string
	updated_at?: string
	device_targets?: Partial<Record<DeviceVariant, boolean>>
	/**
	 * Generic fallback presets used when no device-specific profile exists.
	 */
	profiles: Record<PresetCategory, Preset>
	/**
	 * Optional device-specific presets. If present, the plugin should prefer an exact device match,
	 * then fall back to `profiles`.
	 */
	profiles_by_device?: ProfilesByDevice
	source?: {
		provider: "sharedeck" | "decktuner"
		ranking?: { strategy?: string; score?: number }
		report_ids?: number[]
	}
}


