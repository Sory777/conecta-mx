import path from 'node:path';
import type { AppConfig } from './config/env';
import { Db } from './db/database';
import { Bus } from './lib/bus';
import { createLogger, type Logger } from './lib/logger';
import { AccountService } from './modules/accounts/service';
import { AdsService } from './modules/ads/service';
import { AnalyticsService } from './modules/analytics/service';
import { AntiFraudService } from './modules/antifraud/service';
import { createMailer } from './modules/auth/mailer';
import { AuthService } from './modules/auth/service';
import { loadBaseContent } from './modules/content/loader';
import { EconomyConfigService } from './modules/economy/config';
import { Economy } from './modules/economy/ledger';
import { ItemCatalog } from './modules/inventory/catalog';
import { InventoryService } from './modules/inventory/service';
import { MarketplaceService } from './modules/marketplace/service';
import { MissionService } from './modules/missions/service';
import { ReferralService } from './modules/referrals/service';
import { RewardsService } from './modules/rewards/service';
import { SeasonService } from './modules/seasons/service';
import { SocialService } from './modules/social/service';
import { SponsorService } from './modules/sponsors/service';
import { SandboxPaymentProvider } from './modules/store/payments';
import { StoreService } from './modules/store/service';

export type Services = ReturnType<typeof createServices>;

/** Composición de dependencias (sin contenedor mágico: explícito y fácil de seguir). */
export function createServices(config: AppConfig, opts: { log?: Logger } = {}) {
  const log = opts.log ?? createLogger(config.LOG_LEVEL);
  const db = new Db(config.DATABASE_PATH);
  db.migrate();
  loadBaseContent(db, config.CONTENT_DIR);

  const bus = new Bus();
  const catalog = new ItemCatalog(db);
  catalog.reload();
  const ecoCfg = new EconomyConfigService(db);
  const economy = new Economy(db, bus, catalog);
  const inventory = new InventoryService(db, catalog);
  const analytics = new AnalyticsService(db, ecoCfg);
  const antifraud = new AntiFraudService(db, config, ecoCfg, log);
  const rewards = new RewardsService(db, config, ecoCfg, economy, antifraud, analytics, log);
  const seasons = new SeasonService(db, economy, catalog);
  seasons.loadFromDir(path.join(config.CONTENT_DIR, 'seasons'));
  const referrals = new ReferralService(db, bus, log, economy, ecoCfg, () => rewards, antifraud);
  const mailer = createMailer(config, log);
  const auth = new AuthService(db, config, bus, log, mailer, economy, ecoCfg, antifraud, analytics, referrals);
  const accounts = new AccountService(db, bus, catalog, inventory, economy);
  const missions = new MissionService(db, bus, log, catalog, inventory, economy, ecoCfg, rewards, seasons, analytics, antifraud);
  missions.loadFromDir(path.join(config.CONTENT_DIR, 'episodes'));
  const payments = config.PAYMENT_PROVIDER === 'sandbox' ? new SandboxPaymentProvider() : null;
  const store = new StoreService(db, log, catalog, inventory, economy, seasons, analytics, payments);
  store.loadFromFile(path.join(config.CONTENT_DIR, 'store.json'));
  const ads = new AdsService(db, config, ecoCfg, economy, rewards, antifraud, analytics);
  ads.seed();
  const social = new SocialService(db);
  const marketplace = new MarketplaceService(db, ecoCfg, economy, catalog, antifraud, social, analytics);
  const sponsors = new SponsorService(db);

  return {
    config,
    log,
    db,
    bus,
    catalog,
    ecoCfg,
    economy,
    inventory,
    analytics,
    antifraud,
    rewards,
    seasons,
    referrals,
    auth,
    accounts,
    missions,
    store,
    ads,
    social,
    marketplace,
    sponsors,
    mailer,
  };
}
