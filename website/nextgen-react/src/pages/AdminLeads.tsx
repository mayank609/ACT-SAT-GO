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
  const [activeTab, setActiveTab] = useState<'students' | 'tutors'>('students');

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
      // 1. Separate students and tutors
      const isTutor = l.type === 'Tutor';
      if (activeTab === 'students' && isTutor) return false;
      if (activeTab === 'tutors' && !isTutor) return false;

      // 2. Status filter
      if (statusFilter !== 'All' && l.status !== statusFilter) return false;

      // 3. Search query filter
      if (!q) return true;
      
      const searchFields = [
        l.name,
        l.email,
        l.phone,
        l.exam,
        l.message,
        l.city,
        l.subject,
        l.grades,
        l.hourlyRate,
        l.remarks,
        ...(l.testPrep || [])
      ].map(f => (f || '').toLowerCase());

      return searchFields.some(f => f.includes(q));
    });
  }, [leads, search, statusFilter, activeTab]);

  // Split leads for stats calculation
  const studentLeads = leads.filter((l) => l.type !== 'Tutor');
  const tutorLeads = leads.filter((l) => l.type === 'Tutor');

  // Stats calculation
  const totalCount = activeTab === 'students' ? studentLeads.length : tutorLeads.length;
  const pendingCount = activeTab === 'students' 
    ? studentLeads.filter((l) => l.status === 'Pending').length 
    : tutorLeads.filter((l) => l.status === 'Pending').length;
    
  const stat3Label = activeTab === 'students' ? 'Consultations' : 'In Progress';
  const stat3Val = activeTab === 'students' 
    ? studentLeads.filter((l) => l.type === 'Consultation').length 
    : tutorLeads.filter((l) => l.status === 'In Progress').length;

  const stat4Label = activeTab === 'students' ? 'Newsletter' : 'Contacted / Resolved';
  const stat4Val = activeTab === 'students'
    ? studentLeads.filter((l) => l.type === 'Newsletter').length
    : tutorLeads.filter((l) => l.status === 'Contacted' || l.status === 'Resolved').length;

  return (
    <div className="admin-root">
      <div className="admin-shell">
        <div className="admin-topbar">
          <div>
            <div className="admin-logo">
              ACT SAT GO
            </div>
            <h1>Leads &amp; Enquiries</h1>
            <p className="admin-muted">Consultation requests, newsletter sign-ups, and tutor applications from the website.</p>
          </div>
          <button className="admin-logout" onClick={logout}>
            Log out
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div className="admin-view-tabs">
          <button 
            type="button"
            className={`admin-view-tab ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => { setActiveTab('students'); setStatusFilter('All'); setSearch(''); }}
          >
            Student Leads
          </button>
          <button 
            type="button"
            className={`admin-view-tab ${activeTab === 'tutors' ? 'active' : ''}`}
            onClick={() => { setActiveTab('tutors'); setStatusFilter('All'); setSearch(''); }}
          >
            Tutor Applications
          </button>
        </div>

        <div className="admin-stats">
          <div className="admin-stat is-total">
            <strong>{totalCount}</strong>
            <span>{activeTab === 'students' ? 'Total leads' : 'Total applicants'}</span>
          </div>
          <div className="admin-stat is-pending">
            <strong>{pendingCount}</strong>
            <span>Pending</span>
          </div>
          <div className="admin-stat">
            <strong>{stat3Val}</strong>
            <span>{stat3Label}</span>
          </div>
          <div className="admin-stat">
            <strong>{stat4Val}</strong>
            <span>{stat4Label}</span>
          </div>
        </div>

        <div className="admin-toolbar">
          <input
            type="text"
            placeholder={activeTab === 'students' ? "Search by name, email, phone, exam…" : "Search by name, subject, city, grade…"}
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
          {activeTab === 'students' && (
            <button className="admin-add-btn" onClick={() => { setAddForm(EMPTY_FORM); setAddError(''); setShowAddModal(true); }}>
              + Add Lead
            </button>
          )}
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
              {activeTab === 'students' ? (
                <>
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
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th>Tutor Name</th>
                      <th>Contact &amp; Location</th>
                      <th>Expertise / Test Prep</th>
                      <th>Grades &amp; Rate</th>
                      <th>CV &amp; Video</th>
                      <th>Remarks</th>
                      <th>Applied Date</th>
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
                          {l.city && (
                            <div className="admin-tutor-city">
                              📍 {l.city}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="admin-tutor-subject">{l.subject}</div>
                          {l.testPrep && l.testPrep.length > 0 && (
                            <div className="admin-tutor-tags">
                              {l.testPrep.map((p) => (
                                <span key={p} className="admin-tutor-tag">{p}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="admin-contact">
                          <div>Grades: {l.grades || '—'}</div>
                          <div className="admin-tutor-rate">Rate: {l.hourlyRate || '—'}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {l.cvFile ? (
                              <button
                                type="button"
                                className="admin-cv-download-btn"
                                onClick={() => {
                                  if (!l.cvFile) return;
                                  const link = document.createElement('a');
                                  link.href = l.cvFile.data;
                                  link.download = l.cvFile.name || 'CV.pdf';
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }}
                              >
                                📄 Download CV
                              </button>
                            ) : (
                              <span className="admin-muted">No CV</span>
                            )}
                            
                            {l.videoUrl ? (
                              <a
                                href={l.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="admin-video-link"
                              >
                                🎥 View Video ↗
                              </a>
                            ) : (
                              <span className="admin-muted">No Video</span>
                            )}
                          </div>
                        </td>
                        <td className="admin-msg">
                          {l.remarks || <span className="admin-muted">—</span>}
                        </td>
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
                </>
              )}
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
