require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// ─── APP / SECURITY MIDDLEWARE ──────────────────────────────────────────────
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

const extraOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin, curl, server-to-server
  if (extraOrigins.length === 0) return true; // no whitelist configured: allow public API clients
  if (extraOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return ['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

// ─── AUTH HELPERS ──────────────────────────────────────────────────────────
const LEGACY_SECRET = process.env.APP_SECRET || 'inventory-app-secret';
const SCRYPT_KEYLEN = 64;
const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_HOURS, 10) || 12) * 60 * 60 * 1000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;

  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    const candidate = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }

  // Legacy unsalted SHA-256 (kept so old accounts keep working until reset).
  const legacyHash = crypto
    .createHash('sha256')
    .update(String(password) + LEGACY_SECRET)
    .digest('hex');
  return (
    legacyHash.length === stored.length &&
    crypto.timingSafeEqual(Buffer.from(legacyHash), Buffer.from(stored))
  );
}

const activeTokens = new Map(); // token -> { userId, expiresAt }

function createToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSession(token) {
  const session = activeTokens.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    activeTokens.delete(token);
    return null;
  }
  return session;
}

function revokeUserTokens(userId) {
  for (const [token, session] of activeTokens.entries()) {
    if (session.userId === userId) activeTokens.delete(token);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeTokens.entries()) {
    if (session.expiresAt <= now) activeTokens.delete(token);
  }
}, 10 * 60 * 1000).unref();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.headers['x-auth-token'];
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = getSession(token);
  if (!session) return res.status(401).json({ error: 'Authentication required' });

  const [rows] = await db.query(
    'SELECT id, username, role, is_active, created_at, last_login FROM logins WHERE id = ?',
    [session.userId]
  );
  const user = rows[0];

  if (!user || !user.is_active) {
    activeTokens.delete(token);
    return res.status(401).json({ error: 'Account is inactive' });
  }

  req.user = user;
  req.token = token;
  next();
});

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Simple in-memory login rate limiting.
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function loginRateLimitKey(req, username) {
  return `${req.ip}:${String(username || '').toLowerCase()}`;
}

function hitLoginRateLimit(key) {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || record.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }

  record.count += 1;
  return record.count <= MAX_LOGIN_ATTEMPTS;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of loginAttempts.entries()) {
    if (record.resetAt <= now) loginAttempts.delete(key);
  }
}, 10 * 60 * 1000).unref();

// ─── DB HELPERS ────────────────────────────────────────────────────────────
const statusForQuantity = (quantity) => {
  if (quantity <= 0) return 'out_stock';
  if (quantity <= 5) return 'low_stock';
  return 'in_stock';
};

const toInt = (value, fallback = null) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toNumber = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const isDuplicateEntry = (err) => err && err.code === 'ER_DUP_ENTRY';
const isForeignKeyError = (err) => err && err.code === 'ER_NO_REFERENCED_ROW_2';

const ITEM_SORTS = {
  id: 'i.id',
  name: 'i.name',
  sku: 'i.SKU',
  category: 'i.category',
  quantity: 'i.quantity',
  unit_price: 'i.unit_price',
  status: 'i.status',
  created_at: 'i.created_at',
  updated_at: 'i.updated_at',
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ─── DATABASE ──────────────────────────────────────────────────────────────
let db;

async function connectDB() {
  db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory_db',
    ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    dateStrings: ['DATE'],
  });

  await db.query('SELECT 1');
  console.log(
    `Connected to MySQL at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'inventory_db'}`
  );
}

async function ensureDefaultAccounts() {
  const defaults = [
    {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin',
    },
    {
      username: process.env.STAFF_USERNAME || 'staff',
      password: process.env.STAFF_PASSWORD || 'staff123',
      role: 'staff',
    },
  ];

  const created = [];

  for (const account of defaults) {
    const [existing] = await db.query('SELECT id FROM logins WHERE username = ?', [account.username]);
    if (existing.length > 0) continue;

    await db.query(
      'INSERT INTO logins (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
      [account.username, hashPassword(account.password), account.role]
    );
    created.push(`${account.username} (${account.role})`);
  }

  if (created.length > 0) {
    console.log(`Seeded default accounts: ${created.join(', ')}.`);
    console.log('Change the default passwords after your first login.');
  }
}

// ─── HEALTH ────────────────────────────────────────────────────────────────
app.get('/api/health', asyncHandler(async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unreachable', timestamp: new Date().toISOString() });
  }
}));

// ─── AUTH ──────────────────────────────────────────────────────────────────
app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const rateLimitKey = loginRateLimitKey(req, username);
  if (!hitLoginRateLimit(rateLimitKey)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
  }

  const [rows] = await db.query(
    'SELECT id, username, role, is_active, password_hash, created_at, last_login FROM logins WHERE username = ?',
    [String(username).trim()]
  );

  const account = rows[0];
  if (!account || !verifyPassword(password, account.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (!account.is_active) {
    return res.status(403).json({ error: 'This account is inactive. Contact an administrator.' });
  }

  // Transparently upgrade legacy unsalted hashes on successful login.
  if (!account.password_hash.startsWith('scrypt$')) {
    await db.query('UPDATE logins SET password_hash = ? WHERE id = ?', [
      hashPassword(password),
      account.id,
    ]);
  }

  await db.query('UPDATE logins SET last_login = NOW() WHERE id = ?', [account.id]);
  loginAttempts.delete(rateLimitKey);

  const user = {
    id: account.id,
    username: account.username,
    role: account.role,
    is_active: !!account.is_active,
    created_at: account.created_at,
    last_login: new Date(),
  };

  const token = createToken(user.id);
  return res.json({ success: true, user, token });
}));

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) activeTokens.delete(token);
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ─── PROFILE ───────────────────────────────────────────────────────────────
app.get('/api/profile', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/profile/password', requireAuth, asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  if (String(oldPassword) === String(newPassword)) {
    return res.status(400).json({ error: 'New password must be different from the current password' });
  }

  const [rows] = await db.query('SELECT password_hash FROM logins WHERE id = ?', [req.user.id]);
  const storedHash = rows[0]?.password_hash;

  if (!storedHash || !verifyPassword(oldPassword, storedHash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  await db.query('UPDATE logins SET password_hash = ?, updated_at = NOW() WHERE id = ?', [
    hashPassword(newPassword),
    req.user.id,
  ]);

  // Invalidate every other session for this user, keep the current one.
  for (const [token, session] of activeTokens.entries()) {
    if (session.userId === req.user.id && token !== req.token) activeTokens.delete(token);
  }

  res.json({ success: true, message: 'Password updated successfully' });
}));

// ─── ADMIN: USER MANAGEMENT ────────────────────────────────────────────────
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,50}$/;
const PUBLIC_USER_FIELDS = 'id, username, role, is_active, created_at, last_login';

async function countActiveAdmins() {
  const [rows] = await db.query("SELECT COUNT(*) AS count FROM logins WHERE role = 'admin' AND is_active = 1");
  return parseInt(rows[0].count, 10);
}

app.get('/api/admin/users', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const [users] = await db.query(`SELECT ${PUBLIC_USER_FIELDS} FROM logins ORDER BY username ASC`);
  res.json({ users });
}));

app.post('/api/admin/users', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { username, password, role } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUsername = String(username).trim();
  if (!USERNAME_PATTERN.test(cleanUsername)) {
    return res.status(400).json({
      error: 'Username must be 3-50 characters and contain only letters, numbers, dots, dashes or underscores',
    });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const validRoles = ['staff', 'admin'];
  const cleanRole = role || 'staff';
  if (!validRoles.includes(cleanRole)) {
    return res.status(400).json({ error: `Role must be one of: ${validRoles.join(', ')}` });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO logins (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
      [cleanUsername, hashPassword(password), cleanRole]
    );

    const [user] = await db.query(`SELECT ${PUBLIC_USER_FIELDS} FROM logins WHERE id = ?`, [result.insertId]);
    return res.status(201).json({ user: user[0] });
  } catch (err) {
    if (isDuplicateEntry(err)) return res.status(409).json({ error: 'Username already exists' });
    throw err;
  }
}));

app.put('/api/admin/users/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });

  const { username, role, is_active } = req.body || {};

  const [existingRows] = await db.query(`SELECT ${PUBLIC_USER_FIELDS} FROM logins WHERE id = ?`, [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const sets = [];
  const values = [];

  if (username !== undefined) {
    const cleanUsername = String(username).trim();
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }
    sets.push('username = ?');
    values.push(cleanUsername);
  }

  if (role !== undefined) {
    if (!['staff', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (id === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    sets.push('role = ?');
    values.push(role);
  }

  if (is_active !== undefined) {
    if (id === req.user.id && !is_active) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    sets.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }

  const removesActiveAdmin =
    existing.role === 'admin' &&
    existing.is_active &&
    (role === 'staff' || is_active === false || is_active === 0);

  if (removesActiveAdmin && (await countActiveAdmins()) <= 1) {
    return res.status(400).json({ error: 'At least one active admin must remain' });
  }

  if (sets.length > 0) {
    sets.push('updated_at = NOW()');
    values.push(id);
    try {
      await db.query(`UPDATE logins SET ${sets.join(', ')} WHERE id = ?`, values);
    } catch (err) {
      if (isDuplicateEntry(err)) return res.status(409).json({ error: 'Username already exists' });
      throw err;
    }
  }

  if (role !== undefined || is_active === false || is_active === 0) {
    revokeUserTokens(id);
  }

  const [user] = await db.query(`SELECT ${PUBLIC_USER_FIELDS} FROM logins WHERE id = ?`, [id]);
  return res.json({ user: user[0] });
}));

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id' });

  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  const [rows] = await db.query(`SELECT ${PUBLIC_USER_FIELDS} FROM logins WHERE id = ?`, [id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'admin' && user.is_active && (await countActiveAdmins()) <= 1) {
    return res.status(400).json({ error: 'At least one active admin must remain' });
  }

  await db.query('DELETE FROM logins WHERE id = ?', [id]);
  revokeUserTokens(id);
  res.json({ message: 'User deleted successfully' });
}));

// ─── ITEMS ─────────────────────────────────────────────────────────────────
const ITEM_SELECT = `SELECT i.*, l.name AS location_name
  FROM items i
  LEFT JOIN locations l ON l.id = i.location_id`;

app.get('/api/items', requireAuth, asyncHandler(async (req, res) => {
  const { search, category, status } = req.query;
  const sort = ITEM_SORTS[String(req.query.sort || 'name').toLowerCase()] || ITEM_SORTS.name;
  const order = String(req.query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const page = Math.max(toInt(req.query.page, 1), 1);
  const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(i.name LIKE ? OR i.SKU LIKE ? OR i.description LIKE ? OR i.category LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (category) {
    conditions.push('i.category = ?');
    params.push(category);
  }
  if (status) {
    conditions.push('i.status = ?');
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [items] = await db.query(
    `${ITEM_SELECT} ${where} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await db.query(`SELECT COUNT(*) AS count FROM items i ${where}`, params);

  res.json({ items, total: parseInt(countRows[0].count, 10) });
}));

app.get('/api/items/categories', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await db.query("SELECT DISTINCT category FROM items WHERE category <> '' ORDER BY category ASC");
  res.json({ categories: rows.map((row) => row.category) });
}));

app.get('/api/items/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid item id' });

  const [items] = await db.query(`${ITEM_SELECT} WHERE i.id = ?`, [id]);
  if (items.length === 0) return res.status(404).json({ error: 'Item not found' });

  res.json(items[0]);
}));

app.post('/api/items', requireAuth, asyncHandler(async (req, res) => {
  const { name, sku, category, quantity, unit_price, location_id, description } = req.body || {};

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Item name is required' });
  if (!sku || !String(sku).trim()) return res.status(400).json({ error: 'SKU is required' });

  const cleanQuantity = toInt(quantity, 0);
  const cleanPrice = toNumber(unit_price, 0);
  const cleanLocationId = toInt(location_id, 1);

  if (cleanQuantity < 0) return res.status(400).json({ error: 'Quantity cannot be negative' });
  if (cleanPrice < 0) return res.status(400).json({ error: 'Unit price cannot be negative' });
  if (!cleanLocationId || cleanLocationId < 1) return res.status(400).json({ error: 'Invalid location' });

  try {
    const [result] = await db.query(
      `INSERT INTO items (name, SKU, category, description, quantity, unit_price, location_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        String(name).trim(),
        String(sku).trim(),
        category || 'General',
        description || '',
        cleanQuantity,
        cleanPrice,
        cleanLocationId,
        statusForQuantity(cleanQuantity),
      ]
    );

    res.status(201).json({ id: result.insertId, message: 'Item created successfully' });
  } catch (err) {
    if (isDuplicateEntry(err)) return res.status(409).json({ error: 'An item with that SKU already exists' });
    if (isForeignKeyError(err)) return res.status(400).json({ error: 'Selected location does not exist' });
    throw err;
  }
}));

app.put('/api/items/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid item id' });

  const { name, sku, category, quantity, unit_price, location_id, description } = req.body || {};

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Item name is required' });
  if (!sku || !String(sku).trim()) return res.status(400).json({ error: 'SKU is required' });

  const cleanQuantity = toInt(quantity, 0);
  const cleanPrice = toNumber(unit_price, 0);
  const cleanLocationId = toInt(location_id, 1);

  if (cleanQuantity < 0) return res.status(400).json({ error: 'Quantity cannot be negative' });
  if (cleanPrice < 0) return res.status(400).json({ error: 'Unit price cannot be negative' });
  if (!cleanLocationId || cleanLocationId < 1) return res.status(400).json({ error: 'Invalid location' });

  try {
    const [result] = await db.query(
      `UPDATE items
       SET name = ?, SKU = ?, category = ?, description = ?, quantity = ?, unit_price = ?, location_id = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        String(name).trim(),
        String(sku).trim(),
        category || 'General',
        description || '',
        cleanQuantity,
        cleanPrice,
        cleanLocationId,
        statusForQuantity(cleanQuantity),
        id,
      ]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });

    res.json({ message: 'Item updated successfully' });
  } catch (err) {
    if (isDuplicateEntry(err)) return res.status(409).json({ error: 'An item with that SKU already exists' });
    if (isForeignKeyError(err)) return res.status(400).json({ error: 'Selected location does not exist' });
    throw err;
  }
}));

app.delete('/api/items/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid item id' });

  const [result] = await db.query('DELETE FROM items WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });

  res.json({ message: 'Item deleted successfully' });
}));

// ─── MOVEMENTS ─────────────────────────────────────────────────────────────
const MOVEMENT_SELECT = `SELECT m.*, i.name AS item_name, i.SKU AS item_sku, l.name AS location_name
  FROM movements m
  LEFT JOIN items i ON i.id = m.item_id
  LEFT JOIN locations l ON l.id = m.location_id`;

app.get('/api/movements', requireAuth, asyncHandler(async (req, res) => {
  const { item_id, type, search, date_from, date_to } = req.query;
  const page = Math.max(toInt(req.query.page, 1), 1);
  const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (item_id) {
    conditions.push('m.item_id = ?');
    params.push(toInt(item_id));
  }
  if (type) {
    conditions.push('m.type = ?');
    params.push(type);
  }
  if (search) {
    conditions.push('(i.name LIKE ? OR i.SKU LIKE ? OR m.reference_number LIKE ? OR m.reason LIKE ?)');
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }
  if (date_from && DATE_PATTERN.test(String(date_from))) {
    conditions.push('m.movement_date >= ?');
    params.push(date_from);
  }
  if (date_to && DATE_PATTERN.test(String(date_to))) {
    conditions.push('m.movement_date <= ?');
    params.push(date_to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [movements] = await db.query(
    `${MOVEMENT_SELECT} ${where} ORDER BY m.movement_date DESC, m.created_at DESC, m.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS count FROM movements m LEFT JOIN items i ON i.id = m.item_id ${where}`,
    params
  );

  res.json({ movements, total: parseInt(countRows[0].count, 10) });
}));

app.get('/api/movements/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid movement id' });

  const [movements] = await db.query(`${MOVEMENT_SELECT} WHERE m.id = ?`, [id]);
  if (movements.length === 0) return res.status(404).json({ error: 'Movement not found' });

  res.json(movements[0]);
}));

app.post('/api/movements', requireAuth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const itemId = toInt(body.item_id);
  const quantity = toInt(body.quantity);
  const type = String(body.type || '').toLowerCase();
  const referenceNumber = body.reference_number ? String(body.reference_number).slice(0, 255) : '';
  const reason = body.reason ? String(body.reason) : '';
  const movementDate =
    body.movement_date && DATE_PATTERN.test(String(body.movement_date)) ? body.movement_date : null;

  if (!itemId) return res.status(400).json({ error: 'A valid item is required' });
  if (!['in', 'out', 'transfer'].includes(type)) {
    return res.status(400).json({ error: 'Movement type must be in, out or transfer' });
  }
  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be a positive whole number' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [itemRows] = await conn.query(
      'SELECT id, quantity, location_id FROM items WHERE id = ? FOR UPDATE',
      [itemId]
    );
    const item = itemRows[0];
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'Item not found' });
    }

    let locationId = toInt(body.location_id, null);
    let newQuantity = item.quantity;
    let itemLocationId = item.location_id;

    if (type === 'out') {
      locationId = locationId || item.location_id;
      if (quantity > item.quantity) {
        await conn.rollback();
        return res.status(400).json({ error: `Not enough stock. Available: ${item.quantity}` });
      }
      newQuantity = item.quantity - quantity;
    } else if (type === 'in') {
      locationId = locationId || item.location_id;
      newQuantity = item.quantity + quantity;
    } else {
      if (!locationId) {
        await conn.rollback();
        return res.status(400).json({ error: 'Transfer movements require a destination location' });
      }
      const [locationRows] = await conn.query('SELECT id FROM locations WHERE id = ?', [locationId]);
      if (locationRows.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Destination location not found' });
      }
      itemLocationId = locationId;
    }

    if (locationId) {
      const [locationRows] = await conn.query('SELECT id FROM locations WHERE id = ?', [locationId]);
      if (locationRows.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Location not found' });
      }
    }

    const [result] = await conn.query(
      `INSERT INTO movements (item_id, location_id, type, quantity, reference_number, reason, movement_date, processed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURDATE()), 1, NOW())`,
      [itemId, locationId || 1, type, quantity, referenceNumber, reason, movementDate]
    );

    await conn.query('UPDATE items SET quantity = ?, location_id = ?, status = ?, updated_at = NOW() WHERE id = ?', [
      newQuantity,
      itemLocationId,
      statusForQuantity(newQuantity),
      itemId,
    ]);

    await conn.commit();
    res.status(201).json({ id: result.insertId, message: 'Movement created successfully' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

app.delete('/api/movements/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid movement id' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM movements WHERE id = ? FOR UPDATE', [id]);
    const movement = rows[0];
    if (!movement) {
      await conn.rollback();
      return res.status(404).json({ error: 'Movement not found' });
    }

    const [itemRows] = await conn.query('SELECT quantity FROM items WHERE id = ? FOR UPDATE', [movement.item_id]);

    if (itemRows.length > 0 && movement.type !== 'transfer') {
      const delta = movement.type === 'in' ? -movement.quantity : movement.quantity;
      const newQuantity = itemRows[0].quantity + delta;

      if (newQuantity < 0) {
        await conn.rollback();
        return res.status(400).json({
          error: 'Cannot delete this movement because stock would become negative. Adjust the item stock first.',
        });
      }

      await conn.query('UPDATE items SET quantity = ?, status = ?, updated_at = NOW() WHERE id = ?', [
        newQuantity,
        statusForQuantity(newQuantity),
        movement.item_id,
      ]);
    }

    await conn.query('DELETE FROM movements WHERE id = ?', [id]);
    await conn.commit();

    res.json({ message: 'Movement deleted successfully' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// ─── LOCATIONS ─────────────────────────────────────────────────────────────
app.get('/api/locations', requireAuth, asyncHandler(async (req, res) => {
  const [locations] = await db.query(
    `SELECT l.*, COUNT(i.id) AS itemCount
     FROM locations l
     LEFT JOIN items i ON i.location_id = l.id
     GROUP BY l.id
     ORDER BY l.name ASC`
  );
  res.json({ locations });
}));

app.get('/api/locations/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = toInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid location id' });

  const [locations] = await db.query('SELECT * FROM locations WHERE id = ?', [id]);
  if (!locations.length) return res.status(404).json({ error: 'Location not found' });

  const [items] = await db.query(
    'SELECT id, name, SKU, quantity, status FROM items WHERE location_id = ? ORDER BY name ASC',
    [id]
  );

  res.json({ ...locations[0], items });
}));

app.post('/api/locations', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, type, address } = req.body || {};

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Location name is required' });

  const cleanType = ['warehouse', 'shelf', 'bin'].includes(type) ? type : 'warehouse';

  try {
    const [result] = await db.query('INSERT INTO locations (name, type, address) VALUES (?, ?, ?)', [
      String(name).trim(),
      cleanType,
      address ? String(address).trim() : '',
    ]);
    res.status(201).json({ id: result.insertId, message: 'Location created successfully' });
  } catch (err) {
    if (isDuplicateEntry(err)) return res.status(409).json({ error: 'A location with that name already exists' });
    throw err;
  }
}));

// ─── SUPPLIERS ─────────────────────────────────────────────────────────────
app.get('/api/suppliers', requireAuth, asyncHandler(async (req, res) => {
  const [suppliers] = await db.query('SELECT * FROM suppliers ORDER BY name ASC');
  res.json({ suppliers });
}));

app.post('/api/suppliers', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { name, email, phone, contact_name } = req.body || {};

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Supplier name is required' });

  try {
    const [result] = await db.query(
      'INSERT INTO suppliers (name, email, phone, contact_name) VALUES (?, ?, ?, ?)',
      [
        String(name).trim(),
        email ? String(email).trim() : '',
        phone ? String(phone).trim() : '',
        contact_name ? String(contact_name).trim() : '',
      ]
    );
    res.status(201).json({ id: result.insertId, message: 'Supplier created successfully' });
  } catch (err) {
    if (isDuplicateEntry(err)) return res.status(409).json({ error: 'A supplier with that name already exists' });
    throw err;
  }
}));

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
app.get('/api/dashboard', requireAuth, asyncHandler(async (req, res) => {
  const [totalItems] = await db.query('SELECT COUNT(*) AS count FROM items');
  const [totalStock] = await db.query('SELECT COALESCE(SUM(quantity), 0) AS total FROM items');
  const [lowStock] = await db.query("SELECT COUNT(*) AS count FROM items WHERE status IN ('low_stock', 'out_stock')");
  const [totalValue] = await db.query('SELECT COALESCE(SUM(quantity * unit_price), 0) AS value FROM items');
  const [recentMovements] = await db.query(
    `${MOVEMENT_SELECT} ORDER BY m.movement_date DESC, m.created_at DESC, m.id DESC LIMIT 10`
  );
  const [inbound] = await db.query("SELECT COUNT(*) AS count FROM movements WHERE type = 'in'");
  const [outbound] = await db.query("SELECT COUNT(*) AS count FROM movements WHERE type = 'out'");
  const [topItems] = await db.query('SELECT * FROM items ORDER BY quantity DESC LIMIT 5');

  res.json({
    stats: {
      totalItems: parseInt(totalItems[0].count, 10) || 0,
      totalStock: parseInt(totalStock[0].total, 10) || 0,
      lowStockCount: parseInt(lowStock[0].count, 10) || 0,
      totalStockValue: parseFloat(totalValue[0]?.value ?? 0),
      inboundCount: parseInt(inbound[0].count, 10) || 0,
      outboundCount: parseInt(outbound[0].count, 10) || 0,
    },
    recentMovements,
    topItems,
  });
}));

// ─── STATIC CLIENT + 404s ──────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

const distDir = path.join(__dirname, 'client', 'dist');
const indexHtml = path.join(distDir, 'index.html');

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (!fs.existsSync(indexHtml)) {
    return res
      .status(503)
      .type('text/plain')
      .send(
        'Client build not found.\n\nRun "npm run build" to create client/dist, or use the Vite dev server: http://localhost:5173'
      );
  }
  return res.sendFile(indexHtml);
});

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  console.error('Unhandled error:', err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  return res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message });
});

// ─── START ─────────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  await ensureDefaultAccounts();

  app.listen(PORT, () => {
    console.log(`\nInventory App server running on http://localhost:${PORT}`);
    console.log(`API base: http://localhost:${PORT}/api`);
    console.log(`Health:   http://localhost:${PORT}/api/health`);
    if (!isProduction) {
      console.log('Dev client: http://localhost:5173 (run "npm run client" in another terminal)\n');
    }
  });
}

start().catch((err) => {
  console.error('\nFailed to start server:', err.message);
  console.error('Check that MySQL/XAMPP is running and your .env DB settings are correct.');
  console.error('To create the database and tables, run: npm run db:init\n');
  process.exit(1);
});
