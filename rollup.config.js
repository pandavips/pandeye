import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'rollup';

const isProd = process.env.NODE_ENV === 'production';

const config = defineConfig([
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/pandeye.js',
        format: 'umd',
        name: 'Pandeye',
        sourcemap: true
      },
      {
        file: 'dist/pandeye.esm.js',
        format: 'es',
        sourcemap: true
      }
    ],
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
          'process.env.VERSION': JSON.stringify(process.env.npm_package_version)
        }
      }),
      typescript({
        tsconfig: 'tsconfig.json',
        clean: true
      }),
      isProd && terser({
        format: {
          comments: false
        }
      }),
      isProd && visualizer({
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true
      })
    ].filter(Boolean)
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/types/index.d.ts',
      format: 'es'
    },
    plugins: [dts()],
  }
]);

export default config;
