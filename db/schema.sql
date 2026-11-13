CREATE TABLE IF NOT EXISTS packages (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  diamonds INTEGER NOT NULL CHECK (diamonds > 0),
  bonus_diamonds INTEGER NOT NULL DEFAULT 0 CHECK (bonus_diamonds >= 0),
  price_idr INTEGER NOT NULL CHECK (price_idr >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  order_code TEXT PRIMARY KEY,
  package_id BIGINT NOT NULL REFERENCES packages(id),
  package_name TEXT NOT NULL,
  diamonds INTEGER NOT NULL CHECK (diamonds > 0),
  price_idr INTEGER NOT NULL CHECK (price_idr >= 0),
  player_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'paid', 'processing', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_player_server_idx ON orders (player_id, server_id);
CREATE INDEX IF NOT EXISTS packages_active_sort_idx ON packages (active, sort_order);

-- Demo prices only. Confirm a supplier's current catalog and set real prices before launch.
INSERT INTO packages (sku, name, diamonds, bonus_diamonds, price_idr, sort_order)
VALUES
  ('mlbb-86', '86 Diamonds', 86, 0, 20000, 10),
  ('mlbb-172', '172 Diamonds', 172, 0, 40000, 20),
  ('mlbb-257', '257 Diamonds', 257, 0, 60000, 30),
  ('mlbb-344', '344 Diamonds', 344, 0, 80000, 40),
  ('mlbb-514', '514 Diamonds', 514, 0, 120000, 50),
  ('mlbb-706', '706 Diamonds', 706, 0, 160000, 60)
ON CONFLICT (sku) DO NOTHING;
