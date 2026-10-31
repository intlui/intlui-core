import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [{ name: 'package-styles', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'styles.css', source: readFileSync(new URL('./src/styles.css', import.meta.url), 'utf8') });
    for (const file of ['index.d.ts', 'compiler.d.ts', 'capabilities.d.ts', 'styles.d.css.ts', 'primitives.d.ts']) {
      this.emitFile({ type: 'asset', fileName: file, source: readFileSync(new URL(`./types/${file}`, import.meta.url), 'utf8') });
    }
  } }],
  build: {
    minify: false,
    lib: { entry: { index: 'src/index.js', compiler: 'src/compiler.js', capabilities: 'src/capabilities.js', primitives: 'src/primitives.js' }, formats: ['es'], fileName: (_format, name) => `${name}.js` },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@intlui/protocol', '@intlui/client', 'acorn', 'marked'],
      // Keep the RSC boundary in the published bundle, not only in source JSX.
      output: { banner: chunk => chunk.name === 'index' ? '"use client";' : '' }
    }
  }
});
