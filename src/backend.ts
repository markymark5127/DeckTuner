import { callable } from "@decky/api"

export type ApplyResult = {
	appid: number
	dry_run: boolean
	applied: any[]
	skipped: any[]
	failed: any[]
	messages: string[]
	restart_required: boolean
}

export const applyPresetBackend = callable<
	[appid: number, preset: any, dry_run?: boolean],
	ApplyResult
>("apply_preset")

export const discoverPerfProfileStorage = callable<[], any>(
	"discover_perf_profile_storage"
)

export const getDeviceInfoBackend = callable<[], any>("get_device_info")

export const recordModeStartBackend = callable<
	[appid: number, watch_roots: string[]],
	{ session_id: string; state_path?: string; file_count?: number }
>("record_mode_start")

export const recordModeStopBackend = callable<
	[session_id: string],
	{ session_id: string; changed?: any[]; changed_count?: number; error?: string }
>("record_mode_stop")

export const discoverGameConfigPathsBackend = callable<
	[appid: number],
	any
>("discover_game_config_paths")