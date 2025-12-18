# Static Presets Output (v1)

This folder is a convenient place to store generated preset documents during development.

In production, host the same structure on a static CDN (GitHub Pages works fine):

- `presets/<appid>.json`

Generate one file:

```bash
python tools/curate_presets.py --appid 620 --out presets/620.json
```


