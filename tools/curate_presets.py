#!/usr/bin/env python3
"""
Minimal curator that turns ShareDeck report lists into 3 representative presets:
  - battery_saver
  - framerate
  - graphics

This is a v1 tool meant to produce static JSON you can host on GitHub Pages.

Usage:
  python tools/curate_presets.py --appid 123456 --out presets/123456.json
"""

import argparse
import json
import math
import sys
import time
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


SHAREDECK_REPORT_ENDPOINT = "https://sharedeck.games/api/experimental/reports?app_id={appid}"


def fetch_reports(appid: int) -> List[Dict[str, Any]]:
    url = SHAREDECK_REPORT_ENDPOINT.format(appid=appid)
    with urllib.request.urlopen(url, timeout=30) as resp:
        body = resp.read().decode("utf-8")
    data = json.loads(body)
    if not isinstance(data, list):
        return []
    return data


def safe_num(x: Any) -> Optional[float]:
    try:
        if x is None:
            return None
        return float(x)
    except Exception:
        return None


def pick_best(
    reports: List[Dict[str, Any]],
    score_fn,
) -> Optional[Dict[str, Any]]:
    best = None
    best_score = None
    for r in reports:
        try:
            s = score_fn(r)
            if s is None or (isinstance(s, float) and (math.isnan(s) or math.isinf(s))):
                continue
            if best is None or s > best_score:
                best = r
                best_score = s
        except Exception:
            continue
    return best


def normalize_scaling_filter(v: Any) -> Optional[str]:
    if not v:
        return None
    s = str(v).lower()
    if "fsr" in s:
        return "fsr"
    if "nis" in s:
        return "nis"
    if "integer" in s:
        return "integer"
    if "linear" in s:
        return "linear"
    return "unknown"


def report_to_steamos(report: Dict[str, Any]) -> Dict[str, Any]:
    # Map ShareDeck fields to our normalized schema
    return {
        "perGameProfile": True,
        "fpsLimit": report.get("framerate_limit"),
        "refreshRateHz": report.get("screen_refresh_rate"),
        "tdpLimitW": safe_num(report.get("tdp_limit")),
        "gpuClockMhz": safe_num(report.get("gpu_clock")),
        "scalingMode": normalize_scaling_filter(report.get("scaling_filter")),
        "halfRateShading": report.get("halfrate_shading"),
    }


def curate(appid: int, reports: List[Dict[str, Any]]) -> Dict[str, Any]:
    # Heuristic scoring:
    # - Battery saver: low power_draw, decent avg fps, modest cap.
    def score_battery(r: Dict[str, Any]) -> Optional[float]:
        pd = safe_num(r.get("power_draw"))
        avg = safe_num(r.get("average_framerate")) or 0.0
        cap = safe_num(r.get("framerate_limit")) or avg
        fav = safe_num(r.get("favourites_count")) or 0.0
        if pd is None:
            return None
        # Prefer stable (avg close to cap), low power, some community signal.
        stability = 1.0 - min(abs(avg - cap) / max(cap, 1.0), 1.0)
        return (stability * 3.0) + (avg / 30.0) + (fav / 50.0) - (pd / 5.0)

    # - Framerate: high average fps, prefer higher cap.
    def score_framerate(r: Dict[str, Any]) -> Optional[float]:
        avg = safe_num(r.get("average_framerate"))
        if avg is None:
            return None
        cap = safe_num(r.get("framerate_limit")) or avg
        fav = safe_num(r.get("favourites_count")) or 0.0
        return avg + (cap / 10.0) + (fav / 25.0)

    # - Graphics: use graphics_preset label + prefer higher resolution; still needs decent favs.
    preset_rank = {"low": 0, "medium": 1, "high": 2, "ultra": 3}

    def score_graphics(r: Dict[str, Any]) -> Optional[float]:
        gp = r.get("graphics_preset")
        if not gp:
            return None
        g = preset_rank.get(str(gp).lower(), 0)
        rx = safe_num(r.get("resolution_horizontal")) or 0.0
        ry = safe_num(r.get("resolution_vertical")) or 0.0
        fav = safe_num(r.get("favourites_count")) or 0.0
        return (g * 10.0) + ((rx * ry) / (1280.0 * 720.0)) + (fav / 25.0)

    battery = pick_best(reports, score_battery)
    framerate = pick_best(reports, score_framerate)
    graphics = pick_best(reports, score_graphics)

    def profile(label: str, report: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not report:
            return {"label": label, "notes": "No data available yet."}
        return {
            "label": label,
            "notes": report.get("note"),
            "requiresRestart": True,
            "steamos": report_to_steamos(report),
        }

    return {
        "schema_version": 1,
        "appid": appid,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "profiles": {
            "battery_saver": profile("Battery Saver", battery),
            "framerate": profile("Framerate", framerate),
            "graphics": profile("Graphics", graphics),
        },
        "source": {
            "provider": "sharedeck",
            "report_ids": [r.get("id") for r in [battery, framerate, graphics] if r and r.get("id")],
            "ranking": {"strategy": "v1_heuristic", "score": None},
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--appid", type=int, required=True)
    ap.add_argument("--out", type=str, required=True)
    args = ap.parse_args()

    reports = fetch_reports(args.appid)
    doc = curate(args.appid, reports)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, sort_keys=True)
        f.write("\n")

    print(f"Wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


