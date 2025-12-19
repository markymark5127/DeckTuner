# DeckTuner Service (v2) – Reference Design

This repo’s v1 approach uses a static JSON CDN for curated presets.

v2 introduces an optional hosted service to support:

- Steam OpenID login (same identity model ShareDeck uses)
- community curation workflows (votes/reviews)
- ingestion + publishing to the static preset CDN

## Minimal endpoints

### `GET /auth/steam`

Starts a Steam OpenID login flow and sets a session cookie.

### `POST /api/presets`

Accepts a user-submitted preset payload:

```json
{
  "appid": 123456,
  "category": "battery_saver",
  "preset": { "label": "Battery Saver", "steamos": { "fpsLimit": 30 } },
  "source": "override",
  "device": "steamdeck_oled",
  "device_info": { "steam_deck_variant": "oled" },
  "record_suggestion": {
    "path": "/home/deck/.local/share/Steam/steamapps/compatdata/123456/pfx/drive_c/users/steamuser/AppData/Local/Game/Config.ini",
    "adapter": "ini",
    "pathSpec": { "type": "proton_prefix", "relative": "drive_c/users/steamuser/AppData/Local/Game/Config.ini" },
    "patches": [{ "section": null, "key": "sg.ShadowQuality", "value": "1" }]
  }
}
```

Response: `200 OK` on success.

## Security notes

- Prefer same-site cookies + CSRF protection.
- Rate limit submissions.
- Store provenance: SteamID, client version, and a timestamp.


