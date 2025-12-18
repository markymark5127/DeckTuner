# Record Mode (Graphics Writer)

Record Mode is the “teach the plugin” workflow for locating in-game config files:

1. Start Record Mode for a game/appid.
2. Change **one** in-game graphics setting and apply/save.
3. Stop Record Mode.
4. The plugin shows the files that changed (ranked) so you can confirm which file is the right settings file.

## What’s implemented (v1)

- Backend uses a **polling snapshot** approach (no extra Linux deps):
  - start: snapshot mtimes/sizes under watch roots
  - stop: snapshot again + diff
- Basic ranking heuristics:
  - filenames like `GameUserSettings.ini`, `settings`, `config`, `graphics`, `video`
  - extensions `.ini/.cfg/.json/.xml`
  - content hints: `shadow`, `texture`, `vsync`, `resolution`, `fsr`, `dlss`, `sg.`

## Recommended watch roots (Steam Deck)

For a Proton game with appid `<appid>`:

- `~/.local/share/Steam/steamapps/compatdata/<appid>/pfx/drive_c/users/steamuser/AppData/Local`
- `~/.local/share/Steam/steamapps/compatdata/<appid>/pfx/drive_c/users/steamuser/AppData/Roaming`
- `~/.local/share/Steam/steamapps/compatdata/<appid>/pfx/drive_c/users/steamuser/Documents`
- `~/.local/share/Steam/steamapps/compatdata/<appid>/pfx/drive_c/users/steamuser/Saved Games`

Also useful:

- `~/.config`
- `~/.local/share`

## Next steps (v2+)

- Upgrade to inotify-based streaming watchers when available.
- Key-level diffs for INI/JSON so we can auto-generate patches for Battery/Framerate/Graphics profiles.


