import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('../',import.meta.url)),plugins:[react()],build:{outDir:'dist-ticket-preview',rollupOptions:{input:fileURLToPath(new URL('../ticket-review-preview.html',import.meta.url))}}});
