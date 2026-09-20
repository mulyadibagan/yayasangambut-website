// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://yayasangambut.org',
	output: 'static',
	trailingSlash: 'always',
	i18n: {
		locales: ['id', 'en'],
		defaultLocale: 'id',
		routing: {
			prefixDefaultLocale: true,
		},
	},
});
