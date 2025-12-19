# Static Presets Output (v1)

This folder is a convenient place to store generated preset documents during development.

In production, host the same structure on a static CDN (GitHub Pages works fine):

- `presets/<appid>.json`

## Recommended (GitHub Pages workflow)

This repo can publish curated preset JSON via GitHub Pages:

- Source: `curation/presets.source.json`
- Generator: `scripts/generate-presets.mjs`
- Output site: `site/presets/<appid>.json`
- Workflow: `.github/workflows/publish-presets.yml`

Local generation:

```bash
npm install
npm run presets:build
```

## Legacy (Python curator)

Generate one file (development utility):

```bash
python tools/curate_presets.py --appid 620 --out presets/620.json
```


