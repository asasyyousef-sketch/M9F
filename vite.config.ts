import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      ...(process.env.BACKEND_URL
        ? {
            proxy: {
              '/api': {
                target: process.env.BACKEND_URL,
                changeOrigin: true,
                secure: false,
              },
            },
          }
        : {}),
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/*.json',
          '**/media_files.json',
          '**/media_folders.json',
          '**/active_sessions.json',
          '**/db.json',
          '**/shared_decks.json',
          '**/token_usage_log.json',
          '**/users.json',
          '**/voice_profiles.json',
          '**/uploads/**',
          '**/piper/**',
          '**/runtime_voices/**'
        ]
      },
    },
  };
});
