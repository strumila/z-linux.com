import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Assumption: custom domain z-linux.com served from GitHub Pages root.
// Change `site` if deploying elsewhere; add `base` if served from a subpath.
export default defineConfig({
  site: 'https://z-linux.com',
  integrations: [react()],
});
