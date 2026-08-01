import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://travel.weiweifan.com',
  output: 'static',
  vite: {
    build: { cssMinify: true },
  },
});
