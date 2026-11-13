require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "true" ? {} : undefined
    }
  : {
      host: process.env.PGHOST || "127.0.0.1",
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || "shirou_topup",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "",
      ssl: process.env.PGSSL === "true" ? {} : undefined
    };

const pool = new Pool(poolConfig);

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan. Coba lagi beberapa menit." }
});

function sendBadRequest(res, message) {
  return res.status(400).json({ error: message });
}

function validDigits(value, min, max) {
  return typeof value === "string" &&
    value.length >= min &&
    value.length <= max &&
    /^[0-9]+$/.test(value);
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.get("/api/packages", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, sku, name, diamonds, bonus_diamonds, price_idr FROM packages WHERE active = TRUE ORDER BY sort_order, id"
    );
    res.json({ packages: result.rows });
  } catch (error) {
    console.error("Could not load packages:", error.message);
    res.status(503).json({ error: "Katalog sedang tidak tersedia." });
  }
});

app.post("/api/orders", orderLimiter, async (req, res) => {
  const body = req.body || {};
  const packageId = Number(body.packageId);
  const playerId = body.playerId;
  const serverId = body.serverId;
  const customerEmail = typeof body.email === "string" ? body.email.trim() : "";

  if (!Number.isSafeInteger(packageId) || packageId < 1) {
    return sendBadRequest(res, "Pilih paket diamond yang tersedia.");
  }
  if (!validDigits(playerId, 4, 20)) {
    return sendBadRequest(res, "User ID harus berisi 4 sampai 20 angka.");
  }
  if (!validDigits(serverId, 1, 10)) {
    return sendBadRequest(res, "Server ID harus berisi 1 sampai 10 angka.");
  }
  if (customerEmail && (customerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))) {
    return sendBadRequest(res, "Format email tidak valid.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const packageResult = await client.query(
      "SELECT id, name, diamonds, bonus_diamonds, price_idr FROM packages WHERE id = $1 AND active = TRUE FOR SHARE",
      [packageId]
    );
    if (packageResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return sendBadRequest(res, "Paket tidak ditemukan atau sedang tidak tersedia.");
    }

    const product = packageResult.rows[0];
    const orderCode = "SHR-" + crypto.randomBytes(5).toString("hex").toUpperCase();
    const orderResult = await client.query(
      "INSERT INTO orders (order_code, package_id, package_name, diamonds, price_idr, player_id, server_id, customer_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING order_code, package_name, diamonds, price_idr, player_id, server_id, status, created_at",
      [
        orderCode,
        product.id,
        product.name,
        product.diamonds + product.bonus_diamonds,
        product.price_idr,
        playerId,
        serverId,
        customerEmail || null
      ]
    );
    await client.query("COMMIT");
    res.status(201).json({ order: orderResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Could not create order:", error.message);
    res.status(503).json({ error: "Order belum bisa dibuat. Coba lagi sebentar." });
  } finally {
    client.release();
  }
});

app.get("/api/orders/:orderCode", async (req, res) => {
  const orderCode = req.params.orderCode.toUpperCase();
  if (!/^SHR-[A-F0-9]{10}$/.test(orderCode)) {
    return res.status(404).json({ error: "Order tidak ditemukan." });
  }

  try {
    const result = await pool.query(
      "SELECT order_code, package_name, diamonds, price_idr, status, created_at, updated_at FROM orders WHERE order_code = $1",
      [orderCode]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Order tidak ditemukan." });
    }
    res.json({ order: result.rows[0] });
  } catch (error) {
    console.error("Could not load order:", error.message);
    res.status(503).json({ error: "Status order belum bisa dimuat." });
  }
});

app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function start() {
  const schema = await fs.readFile(path.join(__dirname, "db", "schema.sql"), "utf8");
  await pool.query(schema);
  app.listen(port, () => {
    console.log("Shirou Top-Up running on port " + port);
  });
}

start().catch((error) => {
  console.error("Startup failed. Check PostgreSQL configuration:", error.message);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
