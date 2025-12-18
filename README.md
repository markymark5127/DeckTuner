# DeckTuner

A Decky (Steam Deck Quick Access Menu) plugin that:

- browses ShareDeck + SteamDeckHQ reports (original functionality)
- adds **3 curated, switchable presets per game**:
  - **Battery Saver**
  - **Framerate**
  - **Graphics**
- can **apply** a preset (SteamOS apply is best-effort; in-game config edits are optional/experimental)
- supports **Record Mode** to discover which in-game config files change when you adjust game settings

This repo started as a fork of @davocarli’s [`sharedeck-y`](https://github.com/davocarli/sharedeck-y).

## Screenshots (legacy)

Games List             |  Reports List
:-------------------------:|:-------------------------:
![](screenshots/001_games_list.png)  |  ![](screenshots/002_reports_list.png)

ShareDeck             |  SteamDeckHQ
:-------------------------:|:-------------------------:
![](screenshots/003_sharedeck_report.png)  |  ![](screenshots/004_sdhq_report.png)

## Installing on Steam Deck

### Recommended environment

- Node >= 18 (LTS) — this repo's CI and dev tooling target Node 18+
- pnpm (or npm) — prefer pnpm for reproducible installs

> If you build directly on the Deck, use Desktop Mode and install Node 18 from the SteamOS package manager or use a container. See the "Build & Deploy on Steam Deck" section below for commands.

## Build & Deploy on Steam Deck

This project is intended to run on a Steam Deck with Decky Loader. Two approaches are supported.

### Option A — Build and deploy directly on the Deck (recommended)

1. In Desktop Mode, open Konsole and install Node 18 + pnpm (if needed):

```bash
# example: install Node 18 via package manager (varies by SteamOS version)
sudo apt update && sudo apt install -y nodejs npm
# then install pnpm
npm i -g pnpm
```

2. Clone and build:

```bash
cd ~/homebrew/plugins
git clone <YOUR_REPO_URL> DeckTuner
cd DeckTuner
pnpm install
pnpm run build
```

3. Restart Decky Loader (or reboot) and open the plugin in Gaming Mode.

### Option B — Build locally and copy to the Deck

1. On your PC or CI:

```bash
pnpm install
pnpm run build
```

2. Copy the plugin folder to the Deck (example):

```bash
scp -r . deck@<STEAM_DECK_IP>:~/homebrew/plugins/DeckTuner
```

3. On Deck, restart Decky Loader (or reboot) and open the plugin.


## Installing on Steam Deck

### Prereqs

- Decky Loader installed
- Steam Deck in Desktop Mode
- Optional: SSH enabled (recommended)

### Option A (recommended): build directly on the Deck

1. On the Deck, open **Konsole** and install the plugin folder:

```bash
cd ~/homebrew/plugins
git clone <YOUR_REPO_URL> DeckTuner
cd DeckTuner
npm install
npm run build
```

2. Restart Decky Loader:
   - easiest: reboot, or
   - in Desktop Mode, restart the Decky service (method varies by install)

3. Open Gaming Mode → Quick Access Menu → Decky → **DeckTuner**

### Option B: build on your PC, copy to the Deck (SSH)

1. Build on your PC:

```bash
npm install
npm run build
```

2. Copy the whole plugin folder to the Deck (example):

```bash
scp -r . deck@<STEAM_DECK_IP>:~/homebrew/plugins/DeckTuner
```

3. On the Deck, restart Decky Loader (or reboot) and open the plugin.

## Using presets

### Configure preset source (v1)

In the plugin **Settings** page:

- **Preset CDN Base URL**: where curated preset docs are hosted, expected layout:
  - `presets/<appid>.json`

Schema reference: `docs/presets-schema.md`.

### Local overrides

On a game page:

- **Save as Local Override** pins the current preset for that game + category.
- **Reset Override** reverts to the curated preset (if available).

## Graphics Writer (Experimental)

Enable **Graphics Writer (Experimental)** in Settings to use:

- **Record Mode** (Start / Stop & Analyze)
- “Attach top match to this preset” (creates a local override with a generated graphics target)

Record Mode reference: `docs/record-mode.md`.

## Curation tooling (v1)

This repo includes a minimal curator that turns ShareDeck reports into 3 representative presets:

```bash
python tools/curate_presets.py --appid 620 --out presets/620.json
```

You can host generated `presets/<appid>.json` files on GitHub Pages (or any static host).

## V2 service (optional)

If you set **DeckTuner Service Base URL** in Settings, the UI exposes:

- “Login to DeckTuner service (Steam)” → opens `/auth/steam`
- “Upload preset to DeckTuner service” → POSTs to `/api/presets`

Reference design: `docs/v2-service.md`.

## Developer notes

- Frontend entry: `src/index.tsx`
- Backend: `main.py`
- Build: `npm run build` → produces `dist/index.js`
