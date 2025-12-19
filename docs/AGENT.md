# DeckTuner Agent Doc

This document is written for an “agent” (human or AI) that needs to understand the project quickly and make consistent decisions while extending it.

## Project summary

**DeckTuner** is a Decky (Steam Deck Quick Access Menu) plugin that:

- shows **3 curated presets per game** sourced from community ShareDeck data:
  - **Battery Saver**
  - **Framerate**
  - **Graphics**
- lets the user **apply** a preset, and optionally:
  - write **in-game config files** (best-effort, adapter-driven)
  - **record** which files change when the user edits in-game settings (Record Mode)
- supports **local overrides** (pin a preset per game/category) and “share” workflows.

## Key product decisions (why the code looks like it does)

- **Curated presets are external (v1)**: v1 expects a static CDN of JSON docs (`presets/<appid>.json`). This avoids needing accounts, moderation, or a backend service on day 1.
- **Applying in-game settings is optional**: it’s behind `enableGraphicsWriter` and uses adapters + backups. Many games store settings differently, so the design is intentionally best-effort.
- **Steam identity is Steam OpenID**: ShareDeck uses Steam identity; DeckTuner’s v2 service should too. Inside the plugin, “login” is implemented by opening a URL in Steam’s browser.
- **SteamOS per-game performance apply is risk-heavy**: there is a guarded “try via SteamClient” attempt plus a backend **discovery** tool. Final deterministic writing depends on what SteamOS stores and how it can be safely updated.

## Current architecture

```mermaid
flowchart TD
  UI[Decky_UI_React] -->|fetch curated presets| PresetCDN[Static_JSON_CDN]
  UI -->|local override| LocalStore[SteamClient_Storage_or_localStorage]
  UI -->|@decky/api_callable| Backend[Python_Backend_main.py]
  Backend -->|patch config files| FS[Filesystem]
  UI -->|optional SteamClient setters| SteamClientAPI[SteamClient_Perf_APIs]
```

### Frontend (TypeScript/React)

- **Main game page**: `src/pages/reportViewer.tsx`
  - preset selector
  - apply/save/reset
  - record mode UI
  - share flows (copy JSON, open ShareDeck form, optional upload to v2 service)
- **Settings**: `src/pages/settings.tsx`
  - `presetCdnBaseUrl`
  - `serviceBaseUrl` (v2)
  - toggles for apply/features

### Backend (Python)

Implemented in `main.py`:

- `discover_perf_profile_storage`: read-only scan for likely Steam/SteamOS config storage locations (to de-risk per-game profile writes)
- `apply_preset`: applies **graphics targets** (INI/JSON/CFG/regex) with backups
- `record_mode_start` / `record_mode_stop`: snapshot-based record mode with best-effort key diffs

## Preset schema

See: `docs/presets-schema.md` and TS types in `src/presets/types.ts`.

## Record Mode

See: `docs/record-mode.md`.

## Milestones (implementation roadmap)

### Milestone A — Core UX + curated preset fetch (done)

- preset selector UI
- fetch `presets/<appid>.json` from configurable base URL
- cache with TTL
- local overrides

### Milestone B — Safe backend primitives (done)

- backend RPC methods
- backups + best-effort adapters
- record mode snapshot/diff

### Milestone C — Deterministic SteamOS per-game performance apply (partially done)

Current state:
- “best-effort” SteamClient setter attempts (guarded) in `src/presets/apply.ts`
- backend discovery button in UI

Next:
- confirm real storage path + keys on SteamOS, then implement a deterministic writer (or confirm a stable SteamClient API).

### Milestone D — Community contribution loop (v2 service; optional)

Current state:
- plugin can open `/auth/steam` and POST `/api/presets` (service not included)

Next:
- build the hosted service
- moderation/curation pipeline → publish static CDN docs

## Known risks / “gotchas”

- **SteamOS per-game performance storage changes** across SteamOS updates. Always keep a discovery path and avoid hard-coding without validation.
- **In-game configs** are inconsistent; some games overwrite settings on exit, some use cloud sync.
- **Proton prefixes** can be large—Record Mode is scoped to likely directories, and snapshots are capped.
- **INI formatting**: `configparser` rewrites files; for strict games, use regex adapter.

## Contributing guidelines (practical)

- Add new adapters cautiously; always backup before write.
- Keep UI non-destructive: show what will change; prefer “best-effort” with clear errors.
- Keep the preset schema stable (version it) so CDN docs don’t break old plugin versions.


