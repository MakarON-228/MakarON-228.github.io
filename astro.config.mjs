// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  site: 'https://makaron-228.github.io',
  integrations: [svelte()],
});
