import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  envPrefix: 'SLACK_',
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/emoji-datasource-google/img/google/64/*',
          dest: 'assets/emojis',
        },
      ],
    }),
  ],
});
