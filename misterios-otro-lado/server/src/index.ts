import { loadConfig } from './config/env';
import { buildServer } from './app';
import { GAME_NAME } from '../../shared/constants';

const config = loadConfig();
const server = await buildServer(config);
const addr = await server.start();
server.services.log.info(`${GAME_NAME} — servidor listo`, {
  addr,
  sandbox: config.SANDBOX_MODE,
  payments: config.PAYMENT_PROVIDER,
  ads: config.AD_PROVIDER,
  realPayoutsAllowed: config.REAL_PAYOUTS_ALLOWED,
  db: config.DATABASE_PATH,
});
if (config.SANDBOX_MODE) {
  server.services.log.warn('MODO SANDBOX ACTIVO: compras, anuncios y canjes son simulados. No se mueve dinero real.');
}

const shutdown = async (sig: string) => {
  server.services.log.info('shutting down', { sig });
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
