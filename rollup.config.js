import JsonPlugin from '@rollup/plugin-json';
import TypescriptPlugin from '@rollup/plugin-typescript';
import { defineConfig } from 'rollup';
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from './package.json' with { type: 'json' };
const name = pkg.name;

const banner = `/**
 * ${name} v${pkg.version}
 * (c) ${new Date().getFullYear()} ${pkg.author}
 * @license ${pkg.license}
 */`;

export default defineConfig({
  input: 'src/index.ts',
  output: [
    {
      dir: './dist',
      format: 'es',
      exports: 'named',
      sourcemap: true,
      banner,
      preserveModules: true,
    },
  ],
  plugins: [
    JsonPlugin(),
    TypescriptPlugin(),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  watch: {
    include: 'src/**',
  },
});
