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
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          timeout: 120000,
          proxyTimeout: 120000,
          configure: (proxy) => {
            proxy.on('error', (err, _req, res: any) => {
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy stream disconnected', message: err.message }));
              }
            });
          },
        },
        '/uploads': {
          target: process.env.BACKEND_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          timeout: 120000,
          proxyTimeout: 120000,
        },
      },
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
