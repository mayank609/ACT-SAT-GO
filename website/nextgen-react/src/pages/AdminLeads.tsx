import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AuthError,
  LEAD_STATUSES,
  clearToken,
  createLead,
  deleteLead,
  fetchLeads,
  isAuthed,
  updateLeadStatus,
  type Lead,
  type LeadStatus,
} from '../admin/api';

const EXAM_OPTIONS = ['SAT', 'ACT', 'SAT & ACT', 'General'];
const TYPE_OPTIONS = ['Consultation', 'Newsletter', 'Manual'];

const EMPTY_FORM = { name: '', email: '', phone: '', exam: 'SAT', message: '', type: 'Consultation', status: 'Pending' as LeadStatus };

const statusClass = (s: LeadStatus) => 's-' + s.toLowerCase().replace(/\s+/g, '-');

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AdminLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | LeadStatus>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const logout = () => {
    clearToken();
    navigate('/admin/login', { replace: true });
  };

  useEffect(() => {
    if (!isAuthed()) {
      navigate('/admin/login', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLeads();
        if (!cancelled) setLeads(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthError) {
          navigate('/admin/login', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load leads');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await updateLeadStatus(id, status);
    } catch (err) {
      setLeads(prev); // revert on failure
      if (err instanceof AuthError) logout();
      else setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.email) { setAddError('Email is required'); return; }
    setAddError(''); setAddLoading(true);
    try {
      const newLead = await createLead(addForm);
      setLeads((cur) => [newLead, ...cur]);
      setShowAddModal(false);
      setAddForm(EMPTY_FORM);
    } catch (err) {
      if (err instanceof AuthError) logout();
      else setAddError(err instanceof Error ? err.message : 'Failed to create lead');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this lead permanently?')) return;
    const prev = leads;
    setLeads((cur) => cur.filter((l) => l.id !== id));
    try {
      await deleteLead(id);
    } catch (err) {
      setLeads(prev);
      if (err instanceof AuthError) logout();
      else setError(err instanceof Error ? err.message : 'Failed to delete lead');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== 'All' && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.phone.toLowerCase().includes(q) ||
        l.exam.toLowerCase().includes(q) ||
        l.message.toLowerCase().includes(q)
      );
    });
  }, [leads, search, statusFilter]);

  const pendingCount = leads.filter((l) => l.status === 'Pending').length;
  const consultations = leads.filter((l) => l.type === 'Consultation').length;

  return (
    <div className="admin-root">
      <div className="admin-shell">
        <div className="admin-topbar">
          <div>
            <div className="admin-logo">
              ACT SAT GO
            </div>
            <h1>Leads &amp; Enquiries</h1>
            <p className="admin-muted">Consultation requests and newsletter sign-ups from the website.</p>
          </div>
          <button className="admin-logout" onClick={logout}>
            Log out
          </button>
        </div>

        <div className="admin-stats">
          <div className="admin-stat is-total">
            <strong>{leads.length}</strong>
            <span>Total leads</span>
          </div>
          <div className="admin-stat is-pending">
            <strong>{pendingCount}</strong>
            <span>Pending</span>
          </div>
          <div className="admin-stat">
            <strong>{consultations}</strong>
            <span>Consultations</span>
          </div>
          <div className="admin-stat">
            <strong>{leads.length - consultations}</strong>
            <span>Newsletter</span>
          </div>
        </div>

        <div className="admin-toolbar">
          <input
            type="text"
            placeholder="Search by name, email, phone, exam…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | LeadStatus)}>
            <option value="All">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="admin-add-btn" onClick={() => { setAddForm(EMPTY_FORM); setAddError(''); setShowAddModal(true); }}>
            + Add Lead
          </button>
        </div>

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-wrap">
          {loading ? (
            <div className="admin-loading">Loading leads…</div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">
              {leads.length === 0 ? 'No leads yet.' : 'No leads match your filters.'}
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Interest</th>
                  <th>Message</th>
                  <th>Type</th>
                  <th>Received</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td className="admin-name">{l.name}</td>
                    <td className="admin-contact">
                      <div>
                        <a href={`mailto:${l.email}`}>{l.email}</a>
                      </div>
                      {l.phone && (
                        <div>
                          <a href={`tel:${l.phone}`}>{l.phone}</a>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="admin-tag">{l.exam}</span>
                    </td>
                    <td className="admin-msg">{l.message || <span className="admin-muted">—</span>}</td>
                    <td>{l.type}</td>
                    <td className="admin-contact">{formatDate(l.createdAt)}</td>
                    <td>
                      <select
                        className={`admin-status-select ${statusClass(l.status)}`}
                        value={l.status}
                        onChange={(e) => handleStatusChange(l.id, e.target.value as LeadStatus)}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="admin-del" onClick={() => handleDelete(l.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Add Lead Modal ── */}
      {showAddModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add Lead Manually</h2>
              <button className="admin-modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddLead} className="admin-modal-form">
              {addError && <div className="admin-error">{addError}</div>}
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Name</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Email *</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={addForm.phone}
                    onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Exam Interest</label>
                  <select value={addForm.exam} onChange={(e) => setAddForm((f) => ({ ...f, exam: e.target.value }))}>
                    {EXAM_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Type</label>
                  <select value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}>
                    {TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="admin-form-field">
                  <label>Initial Status</label>
                  <select value={addForm.status} onChange={(e) => setAddForm((f) => ({ ...f, status: e.target.value as LeadStatus }))}>
                    {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-form-field">
                <label>Notes / Message</label>
                <textarea
                  rows={3}
                  placeholder="Any notes about this lead…"
                  value={addForm.message}
                  onChange={(e) => setAddForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary" disabled={addLoading}>
                  {addLoading ? 'Adding…' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
