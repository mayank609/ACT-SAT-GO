import { QUERY_API_BASE } from '../config';

const TOKEN_KEY = 'spg_admin_token';

export type LeadStatus = 'Pending' | 'In Progress' | 'Contacted' | 'Resolved';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  exam: string;
  message: string;
  type: string; // 'Consultation' | 'Newsletter' | 'Tutor'
  status: LeadStatus;
  createdAt: string;

  // Tutor fields
  city?: string;
  subject?: string;
  testPrep?: string[];
  grades?: string;
  hourlyRate?: string;
  cvFile?: {
    name: string;
    type: string;
    data: string; // base64 string
  } | null;
  videoUrl?: string;
  remarks?: string;
}

export interface Job {
  id: string;
  dept: string;
  title: string;
  location: string;
  type: string;
  desc: string;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  tag: string;
  title: string;
  text: string;
  image: string;
  date: string;
  read: string;
  tags: string[];
  createdAt: string;
}

export const LEAD_STATUSES: LeadStatus[] = ['Pending', 'In Progress', 'Contacted', 'Resolved'];

// ─── Token storage ────────────────────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
export function isAuthed(): boolean {
  return !!getToken();
}

// Thrown when a request fails because the session is missing/expired.
export class AuthError extends Error {
  constructor(message = 'Your session has expired. Please log in again.') {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────
export async function adminLogin(username: string, password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${QUERY_API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error(`Cannot reach the server. Make sure the query server is running at ${QUERY_API_BASE}.`);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  const data = await res.json();
  setToken(data.token);
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  if (!token) throw new AuthError();
  let res: Response;
  try {
    res = await fetch(`${QUERY_API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new Error(`Cannot reach the server at ${QUERY_API_BASE}.`);
  }
  if (res.status === 401) {
    clearToken();
    throw new AuthError();
  }
  return res;
}

export async function fetchLeads(): Promise<Lead[]> {
  const res = await authFetch('/api/queries');
  if (!res.ok) throw new Error('Failed to load leads');
  return res.json();
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  const res = await authFetch(`/api/queries/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  const data = await res.json();
  return data.query;
}

export async function deleteLead(id: string): Promise<void> {
  const res = await authFetch(`/api/queries/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete lead');
}

export async function createLead(data: {
  name: string;
  email: string;
  phone?: string;
  exam?: string;
  message?: string;
  type?: string;
  status?: LeadStatus;
  city?: string;
  subject?: string;
  testPrep?: string[];
  grades?: string;
  hourlyRate?: string;
  cvFile?: {
    name: string;
    type: string;
    data: string;
  } | null;
  videoUrl?: string;
  remarks?: string;
}): Promise<Lead> {
  const res = await authFetch('/api/queries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Failed to create lead');
  }
  const json = await res.json();
  return json.query;
}

// ─── Jobs CRUD ───────────────────────────────────────────────────────────────
export async function fetchJobs(): Promise<Job[]> {
  const res = await fetch(`${QUERY_API_BASE}/api/jobs`);
  if (!res.ok) throw new Error('Failed to load jobs');
  return res.json();
}

export async function createJob(data: {
  dept: string;
  title: string;
  location?: string;
  type?: string;
  desc: string;
}): Promise<Job> {
  const res = await authFetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create job');
  return res.json();
}

export async function deleteJob(id: string): Promise<void> {
  const res = await authFetch(`/api/jobs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete job');
}

// ─── Blogs CRUD ──────────────────────────────────────────────────────────────
export async function fetchBlogs(): Promise<BlogPost[]> {
  const res = await fetch(`${QUERY_API_BASE}/api/blogs`);
  if (!res.ok) throw new Error('Failed to load blogs');
  return res.json();
}

export async function createBlog(data: {
  tag: string;
  title: string;
  text: string;
  image?: string;
  date?: string;
  read?: string;
  tags?: string[];
}): Promise<BlogPost> {
  const res = await authFetch('/api/blogs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create blog');
  return res.json();
}

export async function deleteBlog(id: string): Promise<void> {
  const res = await authFetch(`/api/blogs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete blog');
}
