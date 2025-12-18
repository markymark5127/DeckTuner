import logging

logging.basicConfig(filename="/tmp/sharedecky.log",
                    format='[ShareDeck-y] %(asctime)s %(levelname)s %(message)s',
                    filemode='w+',
                    force=True)
logger=logging.getLogger()
logger.setLevel(logging.DEBUG) # can be changed to logging.DEBUG for debugging issues

import asyncio
import hashlib
import json
import os
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

class Plugin:
    # A normal method. It can be called from JavaScript using call_plugin_function("method_1", argument1, argument2)
    async def add(self, left, right):
        return left + right

    async def log(self, content):
        logger.info(content)
        return content

    async def get_device_info(self):
        """
        Best-effort device detection for Steam Deck LCD/OLED and general Linux.
        Returns a stable shape so the frontend can make decisions without crashing.
        """
        try:
            info: Dict[str, Any] = {
                "platform": os.uname().sysname if hasattr(os, "uname") else "unknown",
                "is_linux": (os.name == "posix"),
                "model": None,
                "product_name": None,
                "board_name": None,
                "kernel": None,
                "steam_deck_variant": None,  # "oled" | "lcd" | None
                "max_refresh_hz_hint": None,
            }

            try:
                info["kernel"] = os.uname().release  # type: ignore[attr-defined]
            except Exception:
                pass

            def _read_first(path: str) -> Optional[str]:
                try:
                    p = Path(path)
                    if p.exists():
                        return p.read_text(errors="ignore").strip()
                except Exception:
                    return None
                return None

            product_name = _read_first("/sys/devices/virtual/dmi/id/product_name") or _read_first("/sys/class/dmi/id/product_name")
            board_name = _read_first("/sys/devices/virtual/dmi/id/board_name") or _read_first("/sys/class/dmi/id/board_name")

            info["product_name"] = product_name
            info["board_name"] = board_name
            info["model"] = product_name or board_name

            # Heuristic: Steam Deck identifiers vary; keep this conservative.
            model_blob = f"{product_name or ''} {board_name or ''}".lower()
            if "jupiter" in model_blob or "steam deck" in model_blob:
                # OLED commonly reports "Galileo" in some contexts, but do not rely on it.
                # We'll attempt to infer refresh capability from known display modes if available.
                info["steam_deck_variant"] = None

            return info
        except Exception as e:
            logger.exception("get_device_info failed")
            return {"error": str(e)}

    async def discover_perf_profile_storage(self):
        """
        Best-effort discovery of where SteamOS/Steam stores per-game performance profile values.
        This does NOT modify anything. It returns candidate files and keyword matches.
        Intended to be run on-device to inform future writes.
        """
        try:
            home = Path(os.path.expanduser("~"))
            candidates: List[Path] = []

            # Known/common Steam config locations on Linux/SteamOS
            roots = [
                home / ".steam" / "steam" / "userdata",
                home / ".local" / "share" / "Steam" / "userdata",
                home / ".steam" / "steam" / "config",
                home / ".local" / "share" / "Steam" / "config",
                home / ".config",
                home / ".local" / "share",
            ]

            # Limit scanning to plausible config files.
            target_names = {
                "localconfig.vdf",
                "config.vdf",
                "shortcuts.vdf",
                "sharedconfig.vdf",
                "steamapps.vdf",
            }

            for root in roots:
                if not root.exists():
                    continue
                # shallow find: don't walk entire home; cap work.
                try:
                    for p in root.rglob("*"):
                        if p.is_file() and p.name in target_names and p.stat().st_size < 25_000_000:
                            candidates.append(p)
                        # hard cap
                        if len(candidates) >= 200:
                            break
                except Exception:
                    continue
                if len(candidates) >= 200:
                    break

            keywords = [
                "tdp",
                "gpu",
                "fps",
                "framerate",
                "refresh",
                "gamescope",
                "allow_tearing",
                "scaling",
                "fsr",
                "halfrate",
                "perf",
                "performance",
            ]

            matches: List[Dict[str, Any]] = []
            for p in candidates:
                try:
                    text = p.read_text(errors="ignore")
                    found = [k for k in keywords if k in text.lower()]
                    if found:
                        matches.append(
                            {
                                "path": str(p),
                                "size": p.stat().st_size,
                                "matched_keywords": found[:25],
                            }
                        )
                except Exception:
                    continue

            matches.sort(key=lambda m: (len(m["matched_keywords"]), m["size"]), reverse=True)
            return {
                "home": str(home),
                "candidate_count": len(candidates),
                "matches": matches[:50],
                "note": "Run this on SteamOS to identify real per-game performance profile storage locations. This plugin will use these results to implement writes safely.",
            }
        except Exception as e:
            logger.exception("discover_perf_profile_storage failed")
            return {"error": str(e)}

    async def apply_preset(self, appid: int, preset: Dict[str, Any], dry_run: bool = False):
        """
        Apply a preset. In v1, SteamOS performance settings are applied via frontend SteamClient APIs when possible.
        Backend focuses on in-game file edits and record-mode mappings.

        Expected preset shape (subset):
          { steamos: {...}, graphics: { targets: [...] } }
        """
        result: Dict[str, Any] = {
            "appid": appid,
            "dry_run": dry_run,
            "applied": [],
            "skipped": [],
            "failed": [],
            "messages": [],
            "restart_required": False,
        }
        try:
            graphics = preset.get("graphics") or {}
            targets = graphics.get("targets") or []
            if targets:
                # We treat any in-game config edit as requiring restart.
                result["restart_required"] = True

            if dry_run:
                result["skipped"].append({"area": "graphics", "reason": "dry_run"})
                return result

            # Apply graphics targets (best-effort)
            for t in targets:
                try:
                    applied = self._apply_graphics_target(appid, t)
                    result["applied"].append({"target": t.get("path"), "details": applied})
                except Exception as e:
                    result["failed"].append({"target": t.get("path"), "error": str(e)})

            return result
        except Exception as e:
            logger.exception("apply_preset failed")
            result["failed"].append({"area": "apply_preset", "error": str(e)})
            return result

    def _resolve_target_path(self, appid: int, path_spec: Dict[str, Any]) -> Path:
        ptype = path_spec.get("type")
        rel = path_spec.get("relative") or path_spec.get("path")
        if ptype == "absolute":
            return Path(rel)
        if ptype == "proton_prefix":
            home = Path(os.path.expanduser("~"))
            # Steam Deck typical Steam path:
            base = home / ".local" / "share" / "Steam" / "steamapps" / "compatdata" / str(appid) / "pfx"
            return base / rel
        if ptype == "linux_config":
            return Path(os.path.expanduser("~/.config")) / rel
        if ptype == "linux_share":
            return Path(os.path.expanduser("~/.local/share")) / rel
        raise ValueError(f"Unknown path type: {ptype}")

    def _backup_file(self, path: Path) -> Path:
        ts = time.strftime("%Y%m%d-%H%M%S")
        backup_dir = Path("/tmp/decktuner-backups") / ts
        backup_dir.mkdir(parents=True, exist_ok=True)
        backup_path = backup_dir / (path.name + ".bak")
        shutil.copy2(path, backup_path)
        return backup_path

    def _apply_graphics_target(self, appid: int, target: Dict[str, Any]) -> Dict[str, Any]:
        """
        Best-effort apply for in-game config target.
        Supported adapters: ini, json, cfg, regex (minimal).
        """
        adapter = (target.get("adapter") or "ini").lower()
        path_spec = target.get("path") or {}
        file_path = self._resolve_target_path(appid, path_spec)
        if not file_path.exists():
            raise FileNotFoundError(str(file_path))

        backup_path = self._backup_file(file_path)
        patches = target.get("patches") or []

        if adapter in ("ini", "unreal_ini"):
            return self._apply_ini(file_path, patches, backup_path)
        if adapter == "json":
            return self._apply_json(file_path, patches, backup_path)
        if adapter == "cfg":
            return self._apply_cfg(file_path, patches, backup_path)
        if adapter == "regex":
            return self._apply_regex(file_path, patches, backup_path)
        raise ValueError(f"Unsupported adapter: {adapter}")

    def _apply_ini(self, path: Path, patches: List[Dict[str, Any]], backup_path: Path) -> Dict[str, Any]:
        import configparser

        parser = configparser.ConfigParser(interpolation=None, strict=False)
        parser.optionxform = str  # preserve case
        raw = path.read_text(errors="ignore")
        # configparser requires a section; INI files without sections exist.
        if not raw.lstrip().startswith("["):
            raw = "[__root__]\n" + raw
            root_section = "__root__"
        else:
            root_section = None

        parser.read_string(raw)
        applied: List[Dict[str, Any]] = []
        for p in patches:
            section = p.get("section")
            key = p.get("key")
            if not key:
                continue
            if section is None:
                section = root_section or "DEFAULT"
            if not parser.has_section(section) and section != "DEFAULT":
                parser.add_section(section)
            value = p.get("value")
            parser.set(section, key, str(value))
            applied.append({"section": section, "key": key, "value": value})

        # write back while preserving minimal structure (configparser rewrites formatting)
        # We accept this tradeoff for v1; for strict games, prefer regex adapter.
        out_lines: List[str] = []
        for section in parser.sections():
            if section == "__root__":
                continue
            out_lines.append(f"[{section}]")
            for k, v in parser.items(section):
                out_lines.append(f"{k}={v}")
            out_lines.append("")
        if root_section:
            for k, v in parser.items(root_section):
                out_lines.insert(0, f"{k}={v}")
        path.write_text("\n".join(out_lines).rstrip() + "\n")
        return {"backup": str(backup_path), "applied": applied}

    def _apply_json(self, path: Path, patches: List[Dict[str, Any]], backup_path: Path) -> Dict[str, Any]:
        obj = json.loads(path.read_text(errors="ignore") or "{}")
        applied: List[Dict[str, Any]] = []
        for p in patches:
            key = p.get("key")
            if not key:
                continue
            obj[key] = p.get("value")
            applied.append({"key": key, "value": p.get("value")})
        path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n")
        return {"backup": str(backup_path), "applied": applied}

    def _apply_cfg(self, path: Path, patches: List[Dict[str, Any]], backup_path: Path) -> Dict[str, Any]:
        # Very simple Source-like cfg: key value per line; keep existing lines, append overrides.
        lines = (path.read_text(errors="ignore") or "").splitlines()
        applied: List[Dict[str, Any]] = []
        for p in patches:
            key = p.get("key")
            if not key:
                continue
            val = p.get("value")
            lines.append(f'{key} "{val}"')
            applied.append({"key": key, "value": val})
        path.write_text("\n".join(lines).rstrip() + "\n")
        return {"backup": str(backup_path), "applied": applied}

    def _apply_regex(self, path: Path, patches: List[Dict[str, Any]], backup_path: Path) -> Dict[str, Any]:
        import re

        text = path.read_text(errors="ignore")
        applied: List[Dict[str, Any]] = []
        for p in patches:
            pattern = p.get("pattern")
            repl = p.get("replace")
            if not pattern or repl is None:
                continue
            new_text, n = re.subn(pattern, repl, text, flags=re.MULTILINE)
            text = new_text
            applied.append({"pattern": pattern, "replace": repl, "count": n})
        path.write_text(text)
        return {"backup": str(backup_path), "applied": applied}

    async def record_mode_start(self, appid: int, watch_roots: List[str]):
        """
        Start record mode by capturing a snapshot of file mtimes/sizes under watch roots.
        We use polling snapshots (no external deps) and return a session id.
        """
        session_id = f"{appid}-{int(time.time())}"
        snapshot = self._snapshot_roots(watch_roots)
        state_path = Path("/tmp") / f"decktuner-record-{session_id}.json"
        state_path.write_text(json.dumps({"appid": appid, "watch_roots": watch_roots, "snapshot": snapshot}))
        return {"session_id": session_id, "state_path": str(state_path), "file_count": len(snapshot)}

    async def record_mode_stop(self, session_id: str):
        """
        Stop record mode and return changed files ranked by heuristics.
        """
        state_path = Path("/tmp") / f"decktuner-record-{session_id}.json"
        if not state_path.exists():
            return {"error": "session_not_found"}
        state = json.loads(state_path.read_text(errors="ignore") or "{}")
        watch_roots = state.get("watch_roots") or []
        before = state.get("snapshot") or {}
        after = self._snapshot_roots(watch_roots)

        changed: List[Dict[str, Any]] = []
        for p, meta in after.items():
            if p not in before:
                changed.append({"path": p, "change": "created", "meta": meta})
            else:
                if meta.get("mtime") != before[p].get("mtime") or meta.get("size") != before[p].get("size"):
                    changed.append({
                        "path": p,
                        "change": "modified",
                        "meta": meta,
                        "diff": self._diff_text_file(before.get(p), after.get(p), p)
                    })

        # Basic scoring: filenames and content hints
        def score(item: Dict[str, Any]) -> float:
            path_str = item["path"].lower()
            s = 0.0
            for name in ["gameusersettings.ini", "settings", "config", "graphics", "video", "renderer"]:
                if name in path_str:
                    s += 2.0
            for ext in [".ini", ".cfg", ".json", ".xml"]:
                if path_str.endswith(ext):
                    s += 1.0
            try:
                txt = Path(item["path"]).read_text(errors="ignore")
                for k in ["shadow", "texture", "vsync", "resolution", "fsr", "dlss", "sg."]:
                    if k in txt.lower():
                        s += 0.5
            except Exception:
                pass
            return s

        changed.sort(key=score, reverse=True)
        return {"session_id": session_id, "changed": changed[:50], "changed_count": len(changed)}

    def _snapshot_roots(self, roots: List[str]) -> Dict[str, Dict[str, Any]]:
        snapshot: Dict[str, Dict[str, Any]] = {}
        content_captured = 0
        for r in roots:
            root = Path(os.path.expanduser(r))
            if not root.exists():
                continue
            # cap work: only consider files <10MB and limit total.
            for p in root.rglob("*"):
                try:
                    if not p.is_file():
                        continue
                    st = p.stat()
                    if st.st_size > 10_000_000:
                        continue
                    meta: Dict[str, Any] = {"mtime": int(st.st_mtime), "size": int(st.st_size)}

                    # capture small text files for key-diffing later (INI/JSON/CFG)
                    if content_captured < 500 and st.st_size <= 200_000:
                        if p.suffix.lower() in (".ini", ".cfg", ".json", ".txt"):
                            try:
                                txt = p.read_text(errors="ignore")
                                meta["sha1"] = hashlib.sha1(txt.encode("utf-8", errors="ignore")).hexdigest()
                                meta["content"] = txt
                                content_captured += 1
                            except Exception:
                                pass

                    snapshot[str(p)] = meta
                    if len(snapshot) >= 25_000:
                        return snapshot
                except Exception:
                    continue
        return snapshot

    def _diff_text_file(self, before_meta: Optional[Dict[str, Any]], after_meta: Optional[Dict[str, Any]], path_str: str) -> Optional[Dict[str, Any]]:
        """
        Attempt to compute key-level diffs for small INI/JSON files.
        Returns a structured diff suitable for turning into patches.
        """
        try:
            if not before_meta or not after_meta:
                return None
            before_txt = before_meta.get("content")
            if not isinstance(before_txt, str):
                return None
            p = Path(path_str)
            if not p.exists() or p.stat().st_size > 200_000:
                return None
            after_txt = p.read_text(errors="ignore")

            ext = p.suffix.lower()
            if ext == ".json":
                try:
                    b = json.loads(before_txt or "{}")
                    a = json.loads(after_txt or "{}")
                    if not isinstance(b, dict) or not isinstance(a, dict):
                        return None
                    changed = []
                    keys = set(b.keys()) | set(a.keys())
                    for k in keys:
                        if b.get(k) != a.get(k):
                            changed.append({"key": k, "before": b.get(k), "after": a.get(k)})
                    return {"format": "json", "changed": changed[:200]}
                except Exception:
                    return None

            if ext in (".ini", ".cfg", ".txt"):
                # INI diff (best-effort). For cfg/txt, attempt INI root parsing.
                import configparser
                parser_b = configparser.ConfigParser(interpolation=None, strict=False)
                parser_a = configparser.ConfigParser(interpolation=None, strict=False)
                parser_b.optionxform = str
                parser_a.optionxform = str

                def _with_section(txt: str) -> Tuple[str, Optional[str]]:
                    if not txt.lstrip().startswith("["):
                        return "[__root__]\n" + txt, "__root__"
                    return txt, None

                b_txt, b_root = _with_section(before_txt)
                a_txt, a_root = _with_section(after_txt)
                parser_b.read_string(b_txt)
                parser_a.read_string(a_txt)

                changed = []
                sections = set(parser_b.sections()) | set(parser_a.sections())
                for s in sections:
                    items_b = dict(parser_b.items(s)) if parser_b.has_section(s) else {}
                    items_a = dict(parser_a.items(s)) if parser_a.has_section(s) else {}
                    keys = set(items_b.keys()) | set(items_a.keys())
                    for k in keys:
                        if items_b.get(k) != items_a.get(k):
                            changed.append({"section": None if s == "__root__" else s, "key": k, "before": items_b.get(k), "after": items_a.get(k)})
                return {"format": "ini", "changed": changed[:200]}

            return None
        except Exception:
            return None

    # Asyncio-compatible long-running code, executed in a task when the plugin is loaded
    async def _main(self):
        # logger.info("Hello World!")
        pass
