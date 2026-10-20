import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// Serves api/guide.ts in `npm run dev` the way Vercel serves it in production, so the AI guide
// can be tried locally. Without ANTHROPIC_API_KEY it answers 503 and the game falls back to
// searching its own data, exactly as on a deployment without a key.
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.url?.split('?')[0] !== '/api/guide') return next();
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const reply = {
          status(code: number) {
            res.statusCode = code;
            return reply;
          },
          json(body: unknown) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
          },
          setHeader(name: string, value: string) {
            res.setHeader(name, value);
          },
        };
        try {
          const { default: handler } = await server.ssrLoadModule('/api/guide.ts');
          await handler({ method: req.method, body: raw ? JSON.parse(raw) : undefined }, reply);
        } catch (error) {
          server.config.logger.error(`api/guide: ${String(error)}`);
          reply.status(500).json({ error: 'internal' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // The key may live in .env.local (git-ignored); it is read on the server side only, never bundled
  const env = loadEnv(mode, process.cwd(), '');
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY ??= env.ANTHROPIC_API_KEY;

  return {
    plugins: [react(), tailwindcss(), localApi()],
    // content/ is served as static root, so card images live at /images/<file>
    publicDir: 'content',
    // MapLibre starts a Web Worker via new Worker(new URL(...)); esbuild pre-bundling
    // rewrites that URL and the map never fires `load`. Leaving it unbundled keeps it intact.
    optimizeDeps: { exclude: ['maplibre-gl'] },
    worker: { format: 'es' },
  };
});
