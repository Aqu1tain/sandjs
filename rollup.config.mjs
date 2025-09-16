import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

const input = 'src/index.ts';

export default {
  input,
  output: [
    {
      file: 'dist/sandjs.mjs',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/sandjs.iife.js',
      format: 'iife',
      name: 'SandJS',
      sourcemap: true,
    },
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
      sourceMap: true,
    }),
    copy({
      targets: [
        { src: 'README.md', dest: 'dist' },
        { src: 'LICENSE', dest: 'dist' },
      ],
      hook: 'writeBundle',
      copyOnce: true,
    }),
  ],
};
