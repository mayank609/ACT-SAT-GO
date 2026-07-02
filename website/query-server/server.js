import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dns from 'dns';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

// Configure DNS resolver to use reliable public servers first. This prevents 
// querySrv ECONNREFUSED issues on networks with problematic local DNS setups.
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  console.warn('Warning: Could not configure custom DNS servers:', e.message);
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5005;

// ─── MongoDB configuration (credentials come from .env) ───────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'actsatgo';
if (!MONGODB_URI) {
  console.error('✗ MONGODB_URI is not set. Create a .env file (see .env.example).');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);
let leads = null; // the "leads" collection, set on connect

async function connectDb() {
  await client.connect();
  const db = client.db(MONGODB_DB);
  leads = db.collection('leads');
  // Unique business id + fast sort by date
  await leads.createIndex({ id: 1 }, { unique: true });
  await leads.createIndex({ createdAt: -1 });
  console.log(`✓ Connected to MongoDB → ${MONGODB_DB}.leads`);
  await seedFromJsonIfEmpty();
}

// One-time, non-destructive migration: if the collection is empty and an old
// queries.json exists, import those leads so history carries over.
async function seedFromJsonIfEmpty() {
  try {
    if ((await leads.countDocuments()) > 0) return;
    const file = path.join(__dirname, 'queries.json');
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
    if (Array.isArray(data) && data.length) {
      await leads.insertMany(data.map((d) => ({ ...d })));
      console.log(`✓ Seeded ${data.length} lead(s) from queries.json`);
    }
  } catch (err) {
    console.error('Seed skipped:', err.message);
  }
}

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

// Middleware to ensure MongoDB is connected before handling any request (critical for serverless like Vercel)
app.use(async (req, res, next) => {
  if (!leads) {
    try {
      await connectDb();
    } catch (err) {
      console.error('Failed to lazy-connect to MongoDB:', err.message);
      return res.status(500).json({ error: 'Database connection failed' });
    }
  }
  next();
});

// Serve static admin files
app.use('/admin', express.static(path.join(__dirname, 'public')));

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
app.get('/api/queries', requireAuth, async (_req, res) => {
  try {
    const all = await leads.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
    res.json(all);
  } catch (err) {
    console.error('GET /api/queries:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// POST API: Create a new query (public from website form; admin can also send a status)
app.post('/api/queries', async (req, res) => {
  const {
    name, email, phone, exam, message, type, status,
    grade, source, stage, counselor, lastActivity, nextFollowup, leadScore
  } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const validStatuses = ['Pending', 'In Progress', 'Contacted', 'Resolved', 'Active', 'Archived'];
  const validStages = ['New Lead', 'Contacted', 'Qualified', 'Proposal Sent', 'Interested', 'Uncontacted', 'Enrolled', 'Lost/Drop'];
  const newQuery = {
    id: 'q_' + crypto.randomBytes(6).toString('hex') + '_' + Date.now(),
    name: name || 'Anonymous',
    grade: grade || '',
    email: String(email).trim(),
    phone: phone || '',
    exam: exam || 'General',
    source: source || 'Website',
    stage: validStages.includes(stage) ? stage : 'New Lead',
    counselor: counselor || '',
    lastActivity: lastActivity || { date: '-', type: 'Lead Created', icon: 'plus' },
    nextFollowup: nextFollowup || { date: '-', type: 'Call', icon: 'clock' },
    leadScore: typeof leadScore === 'number' ? leadScore : 50,
    message: message || '',
    type: type || 'Consultation',
    status: validStatuses.includes(status) ? status : 'Active',
    createdAt: new Date().toISOString(),
  };

  try {
    await leads.insertOne({ ...newQuery }); // spread so newQuery stays free of _id
    res.status(201).json({ message: 'Query submitted successfully', query: newQuery });
  } catch (err) {
    console.error('POST /api/queries:', err);
    res.status(500).json({ error: 'Failed to save query' });
  }
});

// PUT API: Update any lead fields (admin only)
app.put('/api/queries/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const allowedFields = [
    'status', 'stage', 'counselor', 'grade', 'source', 'exam',
    'leadScore', 'lastActivity', 'nextFollowup', 'name', 'email', 'phone', 'message'
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body && req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  try {
    const result = await leads.updateOne({ id }, { $set: updates });
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }
    const updated = await leads.findOne({ id }, { projection: { _id: 0 } });
    res.json({ message: 'Lead updated successfully', query: updated });
  } catch (err) {
    console.error('PUT /api/queries/:id:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// DELETE API: Delete query (admin only)
app.delete('/api/queries/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await leads.deleteOne({ id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }
    res.json({ message: 'Query deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/queries/:id:', err);
    res.status(500).json({ error: 'Failed to delete query' });
  }
});

// Redirect root admin to public index
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start server only after the DB connection is ready ───────────────────────
if (!process.env.VERCEL) {
  connectDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Query server is running on http://localhost:${PORT}`);
        console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
      });
    })
    .catch((err) => {
      console.error('✗ Failed to connect to MongoDB:', err.message);
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await client.close().catch(() => {});
    process.exit(0);
  });
}

export default app;
