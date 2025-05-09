import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';
import { defineConfig } from 'rollup';

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
      typescript({
        tsconfig: 'tsconfig.json',
        clean: true
      })
    ]
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
