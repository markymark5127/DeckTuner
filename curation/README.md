# Curated presets (GitHub Pages)

This folder contains the **source-of-truth** input for DeckTuner curated presets.

The GitHub Action in `.github/workflows/publish-presets.yml` generates a GitHub Pages site that serves:

- `presets/index.json`
- `presets/<appid>.json`

Your DeckTuner plugin fetches from:

`<presetCdnBaseUrl>/presets/<appid>.json`

## Edit presets

Edit:

- `curation/presets.source.json`

Then push to `main`. The workflow will publish updated JSON.

## Local generation

```bash
npm install
npm run presets:build
```

Output goes to:

- `site/presets/*.json`


