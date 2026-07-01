import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5005;
const DB_FILE = path.join(__dirname, 'queries.json');

// ─── Admin users & auth secret ────────────────────────────────────────────────
// Dummy admin accounts for now. Replace with a real user store before production.
// The primary account can still be overridden via ADMIN_USERNAME/ADMIN_PASSWORD.
const ADMIN_USERS = [
  { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123', name: 'Super Admin' },
  { username: 'priya', password: 'priya123', name: 'Priya Sharma' },
  { username: 'rahul', password: 'rahul123', name: 'Rahul Mehta' },
  { username: 'counselor', password: 'counselor123', name: 'Lead Counselor' },
  { username: 'demo', password: 'demo123', name: 'Demo Admin' },
];
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'scorepigo-admin-secret-change-me';
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function findAdmin(username, password) {
  return ADMIN_USERS.find((u) => u.username === username && u.password === password) || null;
}

app.use(cors());
app.use(express.json());

// Serve static admin files
app.use('/admin', express.static(path.join(__dirname, 'public')));

// Helper to read database
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('Error reading database file:', error);
    return [];
  }
}

// Helper to write database
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing to database file:', error);
  }
}

// ─── Admin authentication ─────────────────────────────────────────────────────
// JWT-style HS256 token implemented with Node's built-in crypto (no extra deps).
function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function hmac(data) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signToken(payload, expiresInSeconds = TOKEN_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const head = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  return `${head}.${body}.${hmac(`${head}.${body}`)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = hmac(`${head}.${body}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Middleware: require a valid admin token on protected routes
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized. Please log in as admin.' });
  }
  req.admin = payload;
  next();
}

// POST API: Admin login → returns a session token
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const admin = findAdmin(username, password);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = signToken({ sub: admin.username, name: admin.name, role: 'admin' });
  res.json({ token, user: { username: admin.username, name: admin.name, role: 'admin' }, expiresIn: TOKEN_TTL_SECONDS });
});

// GET API: Verify the current admin session
app.get('/api/admin/me', requireAuth, (req, res) => {
  res.json({ user: { username: req.admin.sub, name: req.admin.name, role: req.admin.role } });
});

// GET API: Retrieve all queries (admin only)
app.get('/api/queries', requireAuth, (req, res) => {
  const queries = readDb();
  // Sort queries by date descending (newest first)
  queries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(queries);
});

// POST API: Create a new query (public from website form; admin can also call this with a status)
app.post('/api/queries', (req, res) => {
  const { name, email, phone, exam, message, type, status } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const validStatuses = ['Pending', 'In Progress', 'Contacted', 'Resolved'];
  const queries = readDb();
  const newQuery = {
    id: 'q_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
    name: name || 'Anonymous',
    email: email.trim(),
    phone: phone || '',
    exam: exam || 'General',
    message: message || '',
    type: type || 'Consultation',
    status: validStatuses.includes(status) ? status : 'Pending',
    createdAt: new Date().toISOString()
  };

  queries.push(newQuery);
  writeDb(queries);

  res.status(201).json({ message: 'Query submitted successfully', query: newQuery });
});

// PUT API: Update query status (admin only)
app.put('/api/queries/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['Pending', 'In Progress', 'Contacted', 'Resolved'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const queries = readDb();
  const queryIndex = queries.findIndex(q => q.id === id);

  if (queryIndex === -1) {
    return res.status(404).json({ error: 'Query not found' });
  }

  queries[queryIndex].status = status;
  writeDb(queries);

  res.json({ message: 'Query status updated successfully', query: queries[queryIndex] });
});

// DELETE API: Delete query (admin only)
app.delete('/api/queries/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  const queries = readDb();
  const filteredQueries = queries.filter(q => q.id !== id);

  if (queries.length === filteredQueries.length) {
    return res.status(404).json({ error: 'Query not found' });
  }

  writeDb(filteredQueries);
  res.json({ message: 'Query deleted successfully' });
});

// Redirect root admin to public index
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Query server is running on http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});
