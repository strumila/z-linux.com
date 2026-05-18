import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// `site` is used for canonical URLs and sitemap generation; keep it as the
// public HTTPS origin regardless of where the build is actually served from.
// Currently deployed to a GCP compute instance (nginx + certbot) at z-linux.com.
export default defineConfig({
  site: 'https://z-linux.com',
  integrations: [react()],
});
