import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import * as ts from 'typescript';
import { defineConfig } from 'rollup';
import importAssets from 'rollup-plugin-import-assets';

import { name } from "./plugin.json";

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
    // Decky imports the frontend bundle as an ES module and expects a default export
    // that is a function (serverApi) => pluginDefinition.
    format: 'esm',
  },
});
