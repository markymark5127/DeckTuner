import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import * as ts from 'typescript';
import { defineConfig } from 'rollup';
import importAssets from 'rollup-plugin-import-assets';

import { name } from "./plugin.json";

// Derive a safe JS identifier for the IIFE bundle name from `plugin.json`'s name.
// Replace invalid characters with underscores and prefix with '_' if it starts with a digit.
const bundleName = (() => {
  const raw = name || 'DeckTuner';
  let s = String(raw).replace(/[^a-zA-Z0-9_$]/g, '_');
  if (/^[0-9]/.test(s)) s = '_' + s;
  return s;
})();

export default defineConfig({
  input: './src/index.tsx',
  plugins: [
    commonjs(),
    nodeResolve(),
    // Pass the TypeScript module explicitly to avoid an intermittent runtime lookup issue
    // where @rollup/plugin-typescript expects a `ModuleKind` enum on the resolved
    // TypeScript module. This makes builds more deterministic across different
    // environments (e.g., CI or Steam Deck systems with different TypeScript installs).
    typescript({ typescript: ts }),
    json(),
    replace({
      preventAssignment: false,
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    importAssets({
      publicPath: `http://127.0.0.1:1337/plugins/${name}/`
    })
  ],
  context: 'window',
  external: ['react', 'react-dom','decky-frontend-lib'],
  output: {
    file: 'dist/index.js',
    // Name the IIFE bundle using a sanitized identifier derived from `plugin.json`.
    // This ensures the bundle is reachable as e.g. `window[ bundleName ]` and avoids
    // accidental invalid identifier characters from the package name.
    name: bundleName,
    globals: {
      react: 'SP_REACT',
      'react-dom': 'SP_REACTDOM',
      'decky-frontend-lib': 'DFL',
    },
    format: 'iife',
    exports: 'default',
  },
});
