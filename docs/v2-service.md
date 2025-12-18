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
  "source": "override"
}
```

Response: `200 OK` on success.

## Security notes

- Prefer same-site cookies + CSRF protection.
- Rate limit submissions.
- Store provenance: SteamID, client version, and a timestamp.


