import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5005;
const DB_FILE = path.join(__dirname, 'queries.json');

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

// GET API: Retrieve all queries
app.get('/api/queries', (req, res) => {
  const queries = readDb();
  // Sort queries by date descending (newest first)
  queries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(queries);
});

// POST API: Create a new query
app.post('/api/queries', (req, res) => {
  const { name, email, phone, exam, message, type } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const queries = readDb();
  const newQuery = {
    id: 'q_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
    name: name || 'Anonymous',
    email: email.trim(),
    phone: phone || '',
    exam: exam || 'General',
    message: message || '',
    type: type || 'Consultation', // 'Consultation' or 'Newsletter'
    status: 'Pending', // 'Pending' | 'In Progress' | 'Contacted' | 'Resolved'
    createdAt: new Date().toISOString()
  };

  queries.push(newQuery);
  writeDb(queries);

  res.status(201).json({ message: 'Query submitted successfully', query: newQuery });
});

// PUT API: Update query status
app.put('/api/queries/:id', (req, res) => {
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

// DELETE API: Delete query
app.delete('/api/queries/:id', (req, res) => {
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
