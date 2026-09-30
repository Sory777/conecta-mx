-- Misterios: El Otro Lado — esquema v1
-- SQLite en el MVP (cero configuración). El SQL evita extensiones específicas para
-- facilitar la migración a PostgreSQL (ver ARCHITECTURE.md).
-- Convenciones: ids TEXT (UUID), fechas en milisegundos epoch (INTEGER), JSON en TEXT.

PRAGMA foreign_keys = ON;

-- ===================== CUENTAS =====================
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,           -- Player ID
  email           TEXT NOT NULL UNIQUE,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','moderator','admin')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
  status_reason   TEXT,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  referral_code   TEXT NOT NULL UNIQUE,
  fraud_score     INTEGER NOT NULL DEFAULT 0,
  rewards_hold    INTEGER NOT NULL DEFAULT 0,  -- 1 = recompensas de valor real retenidas para revisión
  xp              INTEGER NOT NULL DEFAULT 0,
  level           INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  last_login_at   INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,           -- sólo guardamos el hash SHA-256 del token
  device_id    TEXT,
  ip           TEXT,
  user_agent   TEXT,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  revoked_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);

CREATE TABLE IF NOT EXISTS devices (
  id          TEXT PRIMARY KEY,                -- hash del identificador de dispositivo
  first_seen  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_devices (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  first_seen  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,
  last_ip     TEXT,
  PRIMARY KEY (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_user_devices_device ON user_devices(device_id);

CREATE TABLE IF NOT EXISTS characters (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot        INTEGER NOT NULL DEFAULT 0,
  name        TEXT NOT NULL UNIQUE,
  appearance  TEXT NOT NULL,                  -- JSON (colores + cosméticos equipados)
  pos_x       REAL NOT NULL,
  pos_y       REAL NOT NULL,
  pos_z       REAL NOT NULL,
  rot_y       REAL NOT NULL DEFAULT 0,
  tracked_mission_id TEXT,
  play_seconds INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (user_id, slot)
);

-- ===================== OBJETOS E INVENTARIO =====================
CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  rarity       TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  category     TEXT NOT NULL,
  stackable    INTEGER NOT NULL DEFAULT 0,
  tradeable    INTEGER NOT NULL DEFAULT 0,
  equip_slot   TEXT,
  metadata     TEXT NOT NULL DEFAULT '{}'
);

-- Cada objeto poseído es una instancia única (evita duplicación y permite trazabilidad).
CREATE TABLE IF NOT EXISTS inventory_items (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id      TEXT NOT NULL REFERENCES items(id),
  quantity     INTEGER NOT NULL CHECK (quantity >= 0),
  state        TEXT NOT NULL DEFAULT 'owned' CHECK (state IN ('owned','escrow','consumed')),
  source       TEXT NOT NULL,
  acquired_at  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_items(user_id, state);

-- ===================== ECONOMÍA =====================
CREATE TABLE IF NOT EXISTS currencies (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('soft','premium','reward')),
  description  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency_code  TEXT NOT NULL REFERENCES currencies(code),
  balance        INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (user_id, currency_code)
);

-- Operación económica (una compra, una recompensa, un canje…). Idempotente.
CREATE TABLE IF NOT EXISTS transactions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,   -- reward|purchase|iap|ad_reward|redemption|trade|admin_adjust|season_claim|referral|starter
  status           TEXT NOT NULL DEFAULT 'completed',
  idempotency_key  TEXT NOT NULL UNIQUE,
  details          TEXT NOT NULL DEFAULT '{}',
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type, created_at);

-- Movimientos por moneda (libro mayor). Nunca se editan ni se borran.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id              TEXT PRIMARY KEY,
  transaction_id  TEXT NOT NULL REFERENCES transactions(id),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency_code   TEXT NOT NULL REFERENCES currencies(code),
  delta           INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_cur ON ledger_entries(user_id, currency_code, created_at);

-- Movimientos de objetos (altas/bajas de inventario).
CREATE TABLE IF NOT EXISTS item_ledger (
  id              TEXT PRIMARY KEY,
  transaction_id  TEXT REFERENCES transactions(id),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id         TEXT NOT NULL REFERENCES items(id),
  instance_id     TEXT NOT NULL,
  delta           INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_item_ledger_user ON item_ledger(user_id, created_at);

CREATE TABLE IF NOT EXISTS economy_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,                 -- JSON
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT
);

-- Solicitudes de canje de puntos de recompensa por valor real.
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id     TEXT NOT NULL REFERENCES transactions(id),
  points             INTEGER NOT NULL CHECK (points > 0),
  value_usd_cents    INTEGER NOT NULL,
  reward_type        TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('pending_review','sandbox_approved','approved','rejected','paid')),
  sandbox            INTEGER NOT NULL,
  fraud_score        INTEGER NOT NULL,
  notes              TEXT,
  created_at         INTEGER NOT NULL,
  reviewed_by        TEXT,
  reviewed_at        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON reward_redemptions(user_id, created_at);

-- ===================== TIENDA Y COMPRAS =====================
CREATE TABLE IF NOT EXISTS store_products (
  id              TEXT PRIMARY KEY,
  sku             TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL,
  item_id         TEXT REFERENCES items(id),
  price_currency  TEXT NOT NULL CHECK (price_currency IN ('coins','gems')),  -- NUNCA 'rp'
  price           INTEGER NOT NULL CHECK (price > 0),
  season_id       TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL
);

-- Paquetes de moneda premium comprados con dinero real (a través de un proveedor de pagos).
CREATE TABLE IF NOT EXISTS gem_packs (
  sku          TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  gems         INTEGER NOT NULL CHECK (gems > 0),
  price_cents  INTEGER NOT NULL CHECK (price_cents > 0),
  currency     TEXT NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS purchases (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku             TEXT NOT NULL,
  provider        TEXT NOT NULL,       -- sandbox | google_play | apple | stripe
  provider_ref    TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,
  currency        TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending','completed','refunded','failed')),
  sandbox         INTEGER NOT NULL,
  transaction_id  TEXT REFERENCES transactions(id),
  created_at      INTEGER NOT NULL,
  UNIQUE (provider, provider_ref)
);

-- ===================== MISIONES / MISTERIOS =====================
CREATE TABLE IF NOT EXISTS missions (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  version     INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     INTEGER NOT NULL DEFAULT 1,
  season_id   TEXT,
  content     TEXT NOT NULL,       -- JSON completo (sólo servidor; incluye respuestas)
  source      TEXT NOT NULL,       -- file | admin
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS clues (
  id          TEXT PRIMARY KEY,
  mission_id  TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  text        TEXT NOT NULL,
  shareable   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mission_progress (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id    TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('active','completed')),
  stage_id      TEXT,
  flags         TEXT NOT NULL DEFAULT '[]',
  started_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  completed_at  INTEGER,
  completions   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, mission_id)
);

CREATE TABLE IF NOT EXISTS player_clues (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clue_id      TEXT NOT NULL REFERENCES clues(id) ON DELETE CASCADE,
  source       TEXT NOT NULL CHECK (source IN ('found','shared')),
  shared_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  acquired_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, clue_id)
);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id   TEXT NOT NULL,
  mission_id  TEXT NOT NULL,
  correct     INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts ON puzzle_attempts(user_id, puzzle_id, created_at);

-- ===================== TEMPORADAS Y EVENTOS =====================
CREATE TABLE IF NOT EXISTS seasons (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL,
  starts_at           INTEGER NOT NULL,
  ends_at             INTEGER NOT NULL,
  premium_price_gems  INTEGER NOT NULL,
  enabled             INTEGER NOT NULL DEFAULT 1,
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS season_tiers (
  season_id       TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tier            INTEGER NOT NULL,
  xp_required     INTEGER NOT NULL,
  free_reward     TEXT NOT NULL,   -- JSON
  premium_reward  TEXT NOT NULL,   -- JSON
  PRIMARY KEY (season_id, tier)
);

CREATE TABLE IF NOT EXISTS season_progress (
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id       TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  xp              INTEGER NOT NULL DEFAULT 0,
  premium         INTEGER NOT NULL DEFAULT 0,
  claimed         TEXT NOT NULL DEFAULT '[]',   -- JSON: ["free:1","premium:1",...]
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (user_id, season_id)
);

CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  season_id    TEXT REFERENCES seasons(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  type         TEXT NOT NULL,
  starts_at    INTEGER NOT NULL,
  ends_at      INTEGER NOT NULL,
  config       TEXT NOT NULL DEFAULT '{}',
  enabled      INTEGER NOT NULL DEFAULT 1
);

-- ===================== SOCIAL =====================
CREATE TABLE IF NOT EXISTS friendships (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('pending','accepted')),
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id),
  CHECK (user_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id           TEXT PRIMARY KEY,
  reporter_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  details      TEXT,
  context      TEXT NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution   TEXT,
  resolved_by  TEXT,
  created_at   INTEGER NOT NULL,
  resolved_at  INTEGER
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  channel     TEXT NOT NULL,
  sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id, created_at);

-- ===================== REFERIDOS =====================
CREATE TABLE IF NOT EXISTS referrals (
  id             TEXT PRIMARY KEY,
  referrer_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_id     TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL CHECK (status IN ('pending','rewarded','rejected')),
  reject_reason  TEXT,
  created_at     INTEGER NOT NULL,
  resolved_at    INTEGER,
  CHECK (referrer_id <> referee_id)
);

-- ===================== MARKETPLACE (desactivado por defecto) =====================
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id                 TEXT PRIMARY KEY,
  seller_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inventory_item_id  TEXT NOT NULL REFERENCES inventory_items(id),
  item_id            TEXT NOT NULL REFERENCES items(id),
  price              INTEGER NOT NULL CHECK (price > 0),
  currency           TEXT NOT NULL CHECK (currency = 'coins'),   -- sólo moneda virtual
  commission         INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL CHECK (status IN ('active','sold','cancelled','removed')),
  buyer_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at         INTEGER NOT NULL,
  closed_at          INTEGER
);
CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status, created_at);

-- ===================== PUBLICIDAD Y PATROCINIOS =====================
CREATE TABLE IF NOT EXISTS ad_placements (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('rewarded','optional_interstitial','banner')),
  provider         TEXT NOT NULL,        -- sandbox | admob | ...
  enabled          INTEGER NOT NULL DEFAULT 1,
  reward_coins     INTEGER NOT NULL DEFAULT 0,
  reward_rp        INTEGER NOT NULL DEFAULT 0,
  daily_cap        INTEGER NOT NULL DEFAULT 5,
  cooldown_sec     INTEGER NOT NULL DEFAULT 180,
  min_watch_sec    INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS ad_views (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  placement_id  TEXT NOT NULL REFERENCES ad_placements(id),
  token_hash    TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL CHECK (status IN ('started','completed','rejected','expired')),
  sandbox       INTEGER NOT NULL,
  ip            TEXT,
  device_id     TEXT,
  started_at    INTEGER NOT NULL,
  completed_at  INTEGER,
  reject_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_ad_views_user ON ad_views(user_id, started_at);

CREATE TABLE IF NOT EXISTS sponsor_campaigns (
  id           TEXT PRIMARY KEY,
  sponsor_name TEXT NOT NULL,
  slot_id      TEXT NOT NULL,          -- plaza_billboard, shop_sign, event, mission
  headline     TEXT NOT NULL,
  subline      TEXT NOT NULL DEFAULT '',
  bg_color     TEXT NOT NULL DEFAULT '#1d2b33',
  fg_color     TEXT NOT NULL DEFAULT '#f3e9d2',
  starts_at    INTEGER NOT NULL,
  ends_at      INTEGER NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1,
  impressions  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

-- ===================== SEGURIDAD / ANTIFRAUDE / AUDITORÍA =====================
CREATE TABLE IF NOT EXISTS suspicious_activity (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  severity     INTEGER NOT NULL,            -- puntos que suma al fraud_score
  details      TEXT NOT NULL DEFAULT '{}',
  ip           TEXT,
  device_id    TEXT,
  reviewed     INTEGER NOT NULL DEFAULT 0,
  reviewed_by  TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suspicious_user ON suspicious_activity(user_id, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id           TEXT PRIMARY KEY,
  actor_id     TEXT,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  details      TEXT NOT NULL DEFAULT '{}',
  ip           TEXT,
  created_at   INTEGER NOT NULL
);

-- ===================== ANALÍTICAS =====================
CREATE TABLE IF NOT EXISTS play_sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  duration_sec  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_play_sessions_user ON play_sessions(user_id, started_at);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  session_id  TEXT,
  type        TEXT NOT NULL,
  props       TEXT NOT NULL DEFAULT '{}',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(type, created_at);

-- ===================== MONETIZACIÓN (v2) =====================
-- Cuentas de Telegram vinculadas (una cuenta de Telegram = una cuenta de juego)
CREATE TABLE IF NOT EXISTS telegram_accounts (
  telegram_id    TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  username       TEXT,
  first_name     TEXT,
  language_code  TEXT,
  is_premium     INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  last_seen      INTEGER NOT NULL
);

-- Ofertas de pago con dinero real (gemas, VIP, paquetes, propinas). Precio en centavos (web) y en Stars (Telegram).
CREATE TABLE IF NOT EXISTS offers (
  sku            TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('gems','vip','bundle','tip')),
  label          TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  gems           INTEGER NOT NULL DEFAULT 0,
  vip_days       INTEGER NOT NULL DEFAULT 0,
  items          TEXT NOT NULL DEFAULT '[]',
  price_cents    INTEGER NOT NULL CHECK (price_cents > 0),
  price_stars    INTEGER NOT NULL CHECK (price_stars > 0),
  once_per_user  INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  sort           INTEGER NOT NULL DEFAULT 0
);

-- Intención de pago (se crea al emitir la factura; se completa al confirmar el proveedor)
CREATE TABLE IF NOT EXISTS payment_intents (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku           TEXT NOT NULL,
  provider      TEXT NOT NULL,
  amount        INTEGER NOT NULL,
  currency      TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('pending','paid','failed','refunded')),
  provider_ref  TEXT UNIQUE,
  created_at    INTEGER NOT NULL,
  paid_at       INTEGER
);

-- Redes de anuncios (mediación). Los IDs de bloque/zona NO son secretos: los usa el cliente.
CREATE TABLE IF NOT EXISTS ad_networks (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('sandbox','adsgram','monetag','adsense_h5')),
  enabled          INTEGER NOT NULL DEFAULT 0,
  env              TEXT NOT NULL DEFAULT 'any' CHECK (env IN ('any','telegram','web')),
  formats          TEXT NOT NULL DEFAULT '[]',   -- ["rewarded","interstitial"]
  config           TEXT NOT NULL DEFAULT '{}',   -- blockId / zoneId / client
  est_ecpm         TEXT NOT NULL DEFAULT '{}',   -- {"rewarded": 400} centavos por 1000
  weight           INTEGER NOT NULL DEFAULT 1,
  server_verified  INTEGER NOT NULL DEFAULT 0,   -- 1 si la red confirma cada vista a nuestro servidor
  updated_at       INTEGER NOT NULL
);

-- Ingresos REALES reportados por cada red (copiados de su panel o importados)
CREATE TABLE IF NOT EXISTS ad_revenue_reports (
  id             TEXT PRIMARY KEY,
  day            TEXT NOT NULL,
  network_id     TEXT NOT NULL REFERENCES ad_networks(id),
  format         TEXT NOT NULL,
  impressions    INTEGER NOT NULL CHECK (impressions >= 0),
  revenue_cents  INTEGER NOT NULL CHECK (revenue_cents >= 0),
  notes          TEXT,
  created_by     TEXT,
  created_at     INTEGER NOT NULL,
  UNIQUE (day, network_id, format)
);

-- Eventos de patrocinio deduplicados (impresión/clic por usuario y día)
CREATE TABLE IF NOT EXISTS sponsor_events (
  campaign_id  TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('impression','click')),
  day          TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, user_id, type, day)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  INTEGER NOT NULL
);
