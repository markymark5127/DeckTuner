import fs from "node:fs";
import path from "node:path";

/**
 * Generates GitHub Pages content for DeckTuner curated presets.
 *
 * Output layout (site root):
 * - presets/{appid}.json   (CuratedPresetsDocV1)
 * - presets/index.json     (list of available appids + metadata)
 */

const repoRoot = process.cwd();
const sourcePath = process.env.DECKTUNER_SOURCE ?? path.join(repoRoot, "curation", "presets.source.json");
const autoPath = process.env.DECKTUNER_AUTO_SOURCE ?? path.join(repoRoot, "curation", "presets.auto.json");
const outDir = process.env.DECKTUNER_OUTDIR ?? path.join(repoRoot, "site");

function fail(msg) {
  console.error(`[decktuner:generate-presets] ${msg}`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validateDoc(app) {
  // Minimal validation aligned to `src/presets/types.ts` (CuratedPresetsDocV1).
  if (!isObject(app)) fail("Each app entry must be an object.");
  if (!Number.isInteger(app.appid) || app.appid <= 0) fail(`Invalid appid: ${app.appid}`);

  const profiles = app.profiles;
  if (!isObject(profiles)) fail(`appid ${app.appid}: profiles must be an object`);

  for (const k of ["battery_saver", "framerate", "graphics"]) {
    if (!isObject(profiles[k])) fail(`appid ${app.appid}: missing profiles.${k}`);
    if (typeof profiles[k].label !== "string" || !profiles[k].label) {
      fail(`appid ${app.appid}: profiles.${k}.label must be a non-empty string`);
    }
  }
}

function deepMerge(base, overlay) {
  if (!isObject(base)) return overlay;
  if (!isObject(overlay)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (isObject(v) && isObject(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}

function mergeProfiles(baseProfiles, overlayProfiles) {
  // Per-category merge. Overlay wins, but preserve graphics.targets when overlay doesn't provide them.
  const out = deepMerge(baseProfiles, overlayProfiles);
  for (const cat of ["battery_saver", "framerate", "graphics"]) {
    const b = baseProfiles?.[cat];
    const o = overlayProfiles?.[cat];
    if (!o || !b) continue;
    const oTargets = o?.graphics?.targets;
    const bTargets = b?.graphics?.targets;
    if ((!oTargets || oTargets.length === 0) && bTargets?.length) {
      out[cat] = deepMerge(out[cat], { graphics: { targets: bTargets } });
    }
  }
  return out;
}

function mergeApps(autoApp, sourceApp) {
  // baseline = auto, overlay = source
  const baseline = autoApp ?? {};
  const overlay = sourceApp ?? {};

  const merged = deepMerge(baseline, overlay);

  // Ensure required top-level `profiles` exists and has labels.
  merged.profiles = mergeProfiles(baseline.profiles ?? {}, overlay.profiles ?? {});

  // Device-specific profiles merge (if any)
  const baseByDevice = baseline.profiles_by_device ?? {};
  const overByDevice = overlay.profiles_by_device ?? {};
  const mergedByDevice = {};

  for (const dv of new Set([...Object.keys(baseByDevice), ...Object.keys(overByDevice)])) {
    mergedByDevice[dv] = mergeProfiles(baseByDevice[dv] ?? {}, overByDevice[dv] ?? {});
  }

  if (Object.keys(mergedByDevice).length > 0) {
    merged.profiles_by_device = mergedByDevice;
  }

  // Keep updated_at consistent
  merged.updated_at = overlay.updated_at ?? baseline.updated_at ?? new Date().toISOString();

  // Keep source metadata if overlay provided it; else preserve baseline; else default.
  merged.source = overlay.source ?? baseline.source ?? { provider: "decktuner" };

  return merged;
}

function toCuratedDoc(app) {
  return {
    schema_version: 1,
    appid: app.appid,
    game_name: app.game_name,
    updated_at: app.updated_at ?? new Date().toISOString(),
    device_targets: app.device_targets,
    profiles: app.profiles,
    profiles_by_device: app.profiles_by_device,
    source: app.source ?? { provider: "decktuner" },
  };
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    fail(`Missing source file: ${sourcePath}`);
  }

  const source = readJson(sourcePath);
  const sourceApps = source?.apps;
  if (!Array.isArray(sourceApps)) fail("curation/presets.source.json must contain an `apps` array.");

  const auto = fs.existsSync(autoPath) ? readJson(autoPath) : null;
  const autoApps = Array.isArray(auto?.apps) ? auto.apps : [];

  const byAppIdAuto = new Map(autoApps.map((a) => [a.appid, a]));
  const byAppIdSource = new Map(sourceApps.map((a) => [a.appid, a]));

  const appIds = Array.from(new Set([...byAppIdAuto.keys(), ...byAppIdSource.keys()]))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b);

  const presetsDir = path.join(outDir, "presets");
  ensureDir(presetsDir);

  const index = [];

  for (const appid of appIds) {
    const mergedApp = mergeApps(byAppIdAuto.get(appid), byAppIdSource.get(appid));
    validateDoc(mergedApp);
    const doc = toCuratedDoc(mergedApp);

    const outFile = path.join(presetsDir, `${doc.appid}.json`);
    fs.writeFileSync(outFile, JSON.stringify(doc, null, 2) + "\n", "utf8");

    index.push({
      appid: doc.appid,
      game_name: doc.game_name ?? null,
      updated_at: doc.updated_at ?? null,
      has_profiles: Object.keys(doc.profiles ?? {}).length,
    });
  }

  index.sort((a, b) => a.appid - b.appid);
  fs.writeFileSync(
    path.join(presetsDir, "index.json"),
    JSON.stringify(
      {
        schema: "decktuner-presets-index-v1",
        generated_at: new Date().toISOString(),
        count: index.length,
        apps: index,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  // Minimal landing page (optional but useful for debugging Pages).
  fs.writeFileSync(
    path.join(outDir, "index.html"),
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DeckTuner Presets</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
      code { background: #f3f3f3; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <h2>DeckTuner Presets</h2>
    <p>This GitHub Pages site serves curated presets for the DeckTuner plugin.</p>
    <p>Index: <code>presets/index.json</code></p>
    <p>Per-game: <code>presets/&lt;appid&gt;.json</code></p>
  </body>
</html>
`,
    "utf8",
  );

  console.log(
    `[decktuner:generate-presets] Wrote ${index.length} preset file(s) to ${presetsDir}`,
  );
}

main();


