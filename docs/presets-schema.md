# DeckTuner Presets Schema (v1)

This repo adds a **curated, community-driven** concept of 3 presets per game:

- Battery Saver
- Framerate
- Graphics

These presets are fetched by the plugin from a **static JSON CDN** (v1) and are designed to be upgradeable to a real API service (v2).

## File layout (CDN)

- `presets/index.json` (optional): list of supported appids and metadata
- `presets/<appid>.json`: the curated presets document for a specific Steam appid

## `presets/<appid>.json` (Schema v1)

Top-level fields:

- `schema_version`: must be `1`
- `appid`: Steam appid (number)
- `game_name`: optional display name
- `updated_at`: ISO timestamp
- `profiles`: required **generic fallback** map containing:
  - `battery_saver`
  - `framerate`
  - `graphics`
- `profiles_by_device` (optional): map of device variant → profiles map. If present, the plugin should prefer the exact device match and fall back to `profiles`.

Each profile:

- `label`: string
- `notes`: optional string
- `requiresRestart`: optional boolean
- `steamos`: optional object with normalized fields:
  - `fpsLimit`, `refreshRateHz`, `tdpLimitW`, `allowTearing`, `scalingMode`, `fsrSharpness`, `halfRateShading`
- `graphics`: optional object:
  - `applyMode`: `best_effort | strict`
  - `targets`: array of file write instructions (see below)

### Graphics targets

Targets are applied by the backend (Python) and are **best-effort**.

Each target:

- `adapter`: `ini | unreal_ini | json | cfg | regex`
- `path`:
  - `{ "type": "proton_prefix", "relative": "drive_c/users/steamuser/..." }`
  - `{ "type": "linux_config", "relative": "<app>/*.ini" }`
  - `{ "type": "linux_share", "relative": "<app>/*.json" }`
  - `{ "type": "absolute", "path": "/home/deck/..." }`
- `patches`:
  - for INI/JSON/CFG: `{ "key": "...", "value": ... , "section": "..."? }`
  - for regex: `{ "pattern": "...", "replace": "..." }`

## Example document

```json
{
  "schema_version": 1,
  "appid": 123456,
  "game_name": "Example Game",
  "updated_at": "2025-12-18T00:00:00Z",
  "profiles": {
    "battery_saver": {
      "label": "Battery Saver",
      "notes": "Target stable 30fps.",
      "requiresRestart": true,
      "steamos": { "fpsLimit": 30, "refreshRateHz": 60, "tdpLimitW": 8 },
      "graphics": {
        "applyMode": "best_effort",
        "targets": [
          {
            "adapter": "unreal_ini",
            "path": {
              "type": "proton_prefix",
              "relative": "drive_c/users/steamuser/AppData/Local/Game/Saved/Config/WindowsNoEditor/GameUserSettings.ini"
            },
            "patches": [
              { "key": "sg.ShadowQuality", "value": 1 },
              { "key": "bUseVSync", "value": false }
            ]
          }
        ]
      }
    },
    "framerate": {
      "label": "Framerate",
      "steamos": { "fpsLimit": 60, "refreshRateHz": 60, "tdpLimitW": 15 }
    },
    "graphics": {
      "label": "Graphics",
      "steamos": { "fpsLimit": 40, "refreshRateHz": 80, "tdpLimitW": 12 }
    }
  }
}
```


