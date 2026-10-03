import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

const config = loadConfig();
const app = createApp({ config });

const server = app.listen(config.port, () => {
  console.log(`HealthLink API listening on http://localhost:${config.port} (storage: ${config.storage})`);
});

// Finish in-flight requests (and their file writes) before exiting.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5_000).unref();
  });
}
