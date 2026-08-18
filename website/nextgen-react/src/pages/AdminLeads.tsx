import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AuthError,
  LEAD_STATUSES,
  TUTOR_RECRUITMENT_STATUSES,
  TUTOR_ONBOARDING_STATUSES,
  clearToken,
  createLead,
  deleteLead,
  fetchLeads,
  isAuthed,
  updateLeadStatus,
  updateLeadFields,
  type Lead,
  type LeadStatus,
  type TutorRecruitmentStatus,
  type TutorOnboardingStatus,
  fetchJobs,
  createJob,
  deleteJob,
  fetchBlogs,
  createBlog,
  deleteBlog,
  type Job,
  type BlogPost,
} from '../admin/api';

const EXAM_OPTIONS = ['SAT', 'ACT', 'SAT & ACT', 'General'];
const TYPE_OPTIONS = ['Consultation', 'Newsletter', 'Manual'];
const TEST_PREP_OPTIONS = ['SAT', 'ACT', 'AP', 'K-12', 'Other'];

const EMPTY_FORM = { name: '', email: '', phone: '', exam: 'SAT', message: '', type: 'Consultation', status: 'Pending' as LeadStatus };
const EMPTY_JOB_FORM = { dept: 'Academics', title: '', location: 'Remote (Global)', type: 'Full-time', desc: '' };
const EMPTY_BLOG_FORM = { tag: 'STUDY TIPS', title: '', text: '', image: '', date: '', read: '5 min read', tagsString: '' };
const EMPTY_TUTOR_FORM = {
  name: '',
  email: '',
  phone: '',
  city: '',
  subject: '',
  testPrep: [] as string[],
  grades: '',
  hourlyRate: '',
  videoUrl: '',
  remarks: '',
  companiesWorkedWith: '',
  recruitmentStatus: 'Shortlisted' as TutorRecruitmentStatus,
  onboardingStatus: '' as TutorOnboardingStatus | '',
};

const statusClass = (s: string) => 's-' + s.toLowerCase().replace(/\s+/g, '-');

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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | LeadStatus | TutorRecruitmentStatus>('All');
  const [activeTab, setActiveTab] = useState<'students' | 'tutors' | 'hirings' | 'blogs'>('students');

  // Leads Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Tutor Applicant Modal State
  const [showAddTutorModal, setShowAddTutorModal] = useState(false);
  const [addTutorForm, setAddTutorForm] = useState(EMPTY_TUTOR_FORM);
  const [addTutorCvFile, setAddTutorCvFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [addTutorLoading, setAddTutorLoading] = useState(false);
  const [addTutorError, setAddTutorError] = useState('');

  // Job Modal State
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [addJobForm, setAddJobForm] = useState(EMPTY_JOB_FORM);
  const [addJobLoading, setAddJobLoading] = useState(false);
  const [addJobError, setAddJobError] = useState('');

  // Blog Modal State
  const [showAddBlogModal, setShowAddBlogModal] = useState(false);
  const [addBlogForm, setAddBlogForm] = useState(EMPTY_BLOG_FORM);
  const [addBlogLoading, setAddBlogLoading] = useState(false);
  const [addBlogError, setAddBlogError] = useState('');

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
        const [leadsData, jobsData, blogsData] = await Promise.all([
          fetchLeads(),
          fetchJobs().catch((e) => { console.error(e); return []; }),
          fetchBlogs().catch((e) => { console.error(e); return []; }),
        ]);
        if (!cancelled) {
          setLeads(leadsData);
          setJobs(jobsData);
          setBlogs(blogsData);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthError) {
          navigate('/admin/login', { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
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

  const handleRecruitmentStatusChange = async (id: string, recruitmentStatus: TutorRecruitmentStatus) => {
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, recruitmentStatus } : l)));
    try {
      await updateLeadFields(id, { recruitmentStatus });
    } catch (err) {
      setLeads(prev);
      if (err instanceof AuthError) logout();
      else setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleOnboardingStatusChange = async (id: string, onboardingStatus: TutorOnboardingStatus | '') => {
    const prev = leads;
    setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, onboardingStatus: onboardingStatus || undefined } : l)));
    try {
      // Send '' rather than undefined so clearing back to "Not set" actually
      // persists — JSON.stringify drops undefined keys, and the PUT handler
      // only updates fields present in the body.
      await updateLeadFields(id, { onboardingStatus: (onboardingStatus || '') as TutorOnboardingStatus });
    } catch (err) {
      setLeads(prev);
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

  const handleTutorTestPrepChange = (option: string) => {
    setAddTutorForm((f) => {
      const exists = f.testPrep.includes(option);
      const testPrep = exists ? f.testPrep.filter((t) => t !== option) : [...f.testPrep, option];
      return { ...f, testPrep };
    });
  };

  const handleTutorFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setAddTutorError('CV file size must be under 5MB.');
      return;
    }
    const validExtensions = ['pdf', 'doc', 'docx'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !validExtensions.includes(fileExt)) {
      setAddTutorError('Only PDF, DOC, or DOCX files are allowed.');
      return;
    }

    setAddTutorError('');
    const reader = new FileReader();
    reader.onload = () => {
      setAddTutorCvFile({ name: file.name, type: file.type, data: reader.result as string });
    };
    reader.onerror = () => {
      setAddTutorError('Failed to read the CV file.');
    };
    reader.readAsDataURL(file);
  };

  const handleAddTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addTutorForm.name.trim() || !addTutorForm.email.trim()) {
      setAddTutorError('Name and Email are required.');
      return;
    }
    setAddTutorError('');
    setAddTutorLoading(true);
    try {
      const newLead = await createLead({
        name: addTutorForm.name,
        email: addTutorForm.email,
        phone: addTutorForm.phone,
        city: addTutorForm.city,
        subject: addTutorForm.subject,
        testPrep: addTutorForm.testPrep,
        grades: addTutorForm.grades,
        hourlyRate: addTutorForm.hourlyRate,
        cvFile: addTutorCvFile,
        videoUrl: addTutorForm.videoUrl,
        message: addTutorForm.remarks,
        remarks: addTutorForm.remarks,
        companiesWorkedWith: addTutorForm.companiesWorkedWith,
        recruitmentStatus: addTutorForm.recruitmentStatus,
        onboardingStatus: addTutorForm.onboardingStatus || undefined,
        type: 'Tutor',
      });
      setLeads((cur) => [newLead, ...cur]);
      setShowAddTutorModal(false);
      setAddTutorForm(EMPTY_TUTOR_FORM);
      setAddTutorCvFile(null);
    } catch (err) {
      if (err instanceof AuthError) logout();
      else setAddTutorError(err instanceof Error ? err.message : 'Failed to add applicant');
    } finally {
      setAddTutorLoading(false);
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

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addJobForm.title || !addJobForm.desc) {
      setAddJobError('Title and Description are required.');
      return;
    }
    setAddJobError('');
    setAddJobLoading(true);
    try {
      const newJob = await createJob(addJobForm);
      setJobs((cur) => [newJob, ...cur]);
      setShowAddJobModal(false);
      setAddJobForm(EMPTY_JOB_FORM);
    } catch (err) {
      if (err instanceof AuthError) logout();
      else setAddJobError(err instanceof Error ? err.message : 'Failed to create job opening.');
    } finally {
      setAddJobLoading(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!window.confirm('Delete this job opening permanently?')) return;
    const prev = jobs;
    setJobs((cur) => cur.filter((j) => j.id !== id));
    try {
      await deleteJob(id);
    } catch (err) {
      setJobs(prev);
      if (err instanceof AuthError) logout();
      else setError(err instanceof Error ? err.message : 'Failed to delete job opening.');
    }
  };

  const handleAddBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addBlogForm.title || !addBlogForm.text) {
      setAddBlogError('Title and Text Content are required.');
      return;
    }
    setAddBlogError('');
    setAddBlogLoading(true);
    try {
      const tagsArray = addBlogForm.tagsString
        ? addBlogForm.tagsString.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
        : [];
      
      const newBlog = await createBlog({
        tag: addBlogForm.tag,
        title: addBlogForm.title,
        text: addBlogForm.text,
        image: addBlogForm.image,
        date: addBlogForm.date || undefined,
        read: addBlogForm.read,
        tags: tagsArray,
      });
      
      setBlogs((cur) => [newBlog, ...cur]);
      setShowAddBlogModal(false);
      setAddBlogForm(EMPTY_BLOG_FORM);
    } catch (err) {
      if (err instanceof AuthError) logout();
      else setAddBlogError(err instanceof Error ? err.message : 'Failed to create blog post.');
    } finally {
      setAddBlogLoading(false);
    }
  };

  const handleDeleteBlog = async (id: string) => {
    if (!window.confirm('Delete this blog post permanently?')) return;
    const prev = blogs;
    setBlogs((cur) => cur.filter((b) => b.id !== id));
    try {
      await deleteBlog(id);
    } catch (err) {
      setBlogs(prev);
      if (err instanceof AuthError) logout();
      else setError(err instanceof Error ? err.message : 'Failed to delete blog post.');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    
    if (activeTab === 'students' || activeTab === 'tutors') {
      return leads.filter((l) => {
        const isTutor = l.type === 'Tutor';
        if (activeTab === 'students' && isTutor) return false;
        if (activeTab === 'tutors' && !isTutor) return false;
        if (statusFilter !== 'All') {
          if (activeTab === 'tutors') {
            if (l.recruitmentStatus !== statusFilter) return false;
          } else if (l.status !== statusFilter) {
            return false;
          }
        }
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
          l.companiesWorkedWith,
          ...(l.testPrep || []),
        ].map((f) => (f || '').toLowerCase());
        return searchFields.some((f) => f.includes(q));
      });
    }

    if (activeTab === 'hirings') {
      return jobs.filter((j) => {
        if (!q) return true;
        return (
          j.title.toLowerCase().includes(q) ||
          j.dept.toLowerCase().includes(q) ||
          j.location.toLowerCase().includes(q) ||
          j.desc.toLowerCase().includes(q)
        );
      });
    }

    if (activeTab === 'blogs') {
      return blogs.filter((b) => {
        if (!q) return true;
        return (
          b.title.toLowerCase().includes(q) ||
          b.tag.toLowerCase().includes(q) ||
          b.text.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q))
        );
      });
    }

    return [];
  }, [leads, jobs, blogs, search, statusFilter, activeTab]);

  // Split leads for stats calculation
  const studentLeads = leads.filter((l) => l.type !== 'Tutor');
  const tutorLeads = leads.filter((l) => l.type === 'Tutor');

  // Stats calculation
  const totalCount = activeTab === 'students' 
    ? studentLeads.length 
    : activeTab === 'tutors' 
      ? tutorLeads.length
      : activeTab === 'hirings'
        ? jobs.length
        : blogs.length;

  const pendingCount = activeTab === 'students'
    ? studentLeads.filter((l) => l.status === 'Pending').length
    : activeTab === 'tutors'
      ? tutorLeads.filter((l) => l.recruitmentStatus === 'Shortlisted').length
      : activeTab === 'hirings'
        ? jobs.filter((j) => j.dept === 'Academics').length
        : blogs.filter((b) => b.tag === 'STUDY TIPS').length;

  const stat3Label = activeTab === 'students'
    ? 'Consultations'
    : activeTab === 'tutors'
      ? 'Interviewed'
      : activeTab === 'hirings'
        ? 'Operations'
        : 'SAT/ACT Tags';
  const stat3Val = activeTab === 'students'
    ? studentLeads.filter((l) => l.type === 'Consultation').length
    : activeTab === 'tutors'
      ? tutorLeads.filter((l) => l.recruitmentStatus === 'Interviewed').length
      : activeTab === 'hirings'
        ? jobs.filter((j) => j.dept === 'Operations').length
        : blogs.filter((b) => b.tag === 'SAT' || b.tag === 'ACT').length;

  const stat4Label = activeTab === 'students'
    ? 'Newsletter'
    : activeTab === 'tutors'
      ? 'Selected / Onboarded'
      : activeTab === 'hirings'
        ? 'Marketing & Others'
        : 'Other Tags';
  const stat4Val = activeTab === 'students'
    ? studentLeads.filter((l) => l.type === 'Newsletter').length
    : activeTab === 'tutors'
      ? tutorLeads.filter((l) => l.recruitmentStatus === 'Selected' || l.onboardingStatus === 'Onboarded').length
      : activeTab === 'hirings'
        ? jobs.filter((j) => j.dept !== 'Academics' && j.dept !== 'Operations').length
        : blogs.filter((b) => b.tag !== 'STUDY TIPS' && b.tag !== 'SAT' && b.tag !== 'ACT').length;

  return (
    <div className="admin-root">
      <div className="admin-shell">
        <div className="admin-topbar">
          <div>
            <div className="admin-logo">
              ACT SAT GO
            </div>
            <h1>Leads &amp; CMS Panel</h1>
            <p className="admin-muted">Manage website consultation queries, tutor applicants, job openings, and blog contents.</p>
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
          <button 
            type="button"
            className={`admin-view-tab ${activeTab === 'hirings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('hirings'); setStatusFilter('All'); setSearch(''); }}
          >
            Manage Hirings
          </button>
          <button 
            type="button"
            className={`admin-view-tab ${activeTab === 'blogs' ? 'active' : ''}`}
            onClick={() => { setActiveTab('blogs'); setStatusFilter('All'); setSearch(''); }}
          >
            Manage Blogs
          </button>
        </div>

        <div className="admin-stats">
          <div className="admin-stat is-total">
            <strong>{totalCount}</strong>
            <span>
              {activeTab === 'students' 
                ? 'Total leads' 
                : activeTab === 'tutors' 
                  ? 'Total applicants' 
                  : activeTab === 'hirings' 
                    ? 'Total Job Roles' 
                    : 'Total Blog Posts'}
            </span>
          </div>
          <div className="admin-stat is-pending">
            <strong>{pendingCount}</strong>
            <span>
              {activeTab === 'students'
                ? 'Pending'
                : activeTab === 'tutors'
                  ? 'Shortlisted'
                  : activeTab === 'hirings'
                    ? 'Academics'
                    : 'Study Tips'}
            </span>
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
            placeholder={
              activeTab === 'students' 
                ? "Search by name, email, phone, exam…" 
                : activeTab === 'tutors'
                  ? "Search by name, subject, city, grade…"
                  : activeTab === 'hirings'
                    ? "Search job openings by title, dept…"
                    : "Search blogs by title, tag, keywords…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(activeTab === 'students' || activeTab === 'tutors') && (
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | LeadStatus | TutorRecruitmentStatus)}>
              <option value="All">All statuses</option>
              {(activeTab === 'tutors' ? TUTOR_RECRUITMENT_STATUSES : LEAD_STATUSES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {activeTab === 'students' && (
            <button className="admin-add-btn" onClick={() => { setAddForm(EMPTY_FORM); setAddError(''); setShowAddModal(true); }}>
              + Add Lead
            </button>
          )}
          {activeTab === 'tutors' && (
            <button
              className="admin-add-btn"
              onClick={() => {
                setAddTutorForm(EMPTY_TUTOR_FORM);
                setAddTutorCvFile(null);
                setAddTutorError('');
                setShowAddTutorModal(true);
              }}
            >
              + Add Applicant
            </button>
          )}
          {activeTab === 'hirings' && (
            <button className="admin-add-btn" onClick={() => { setAddJobForm(EMPTY_JOB_FORM); setAddJobError(''); setShowAddJobModal(true); }}>
              + Add Job
            </button>
          )}
          {activeTab === 'blogs' && (
            <button className="admin-add-btn" onClick={() => { setAddBlogForm(EMPTY_BLOG_FORM); setAddBlogError(''); setShowAddBlogModal(true); }}>
              + Add Blog Post
            </button>
          )}
        </div>

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-wrap">
          {loading ? (
            <div className="admin-loading">Loading data…</div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">
              No listings found matching your parameters.
            </div>
          ) : (
            <table className="admin-table">
              {activeTab === 'students' && (
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
                    {(filtered as Lead[]).map((l) => (
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
              )}

              {activeTab === 'tutors' && (
                <>
                  <thead>
                    <tr>
                      <th>Tutor Name</th>
                      <th>Contact &amp; Location</th>
                      <th>Expertise / Test Prep</th>
                      <th>Grades &amp; Rate (INR)</th>
                      <th>CV &amp; Video</th>
                      <th>Companies Worked With</th>
                      <th>Remarks</th>
                      <th>Applied Date</th>
                      <th>Status 1</th>
                      <th>Status 2</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filtered as Lead[]).map((l) => (
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
                          {l.companiesWorkedWith || <span className="admin-muted">—</span>}
                        </td>
                        <td className="admin-msg">
                          {l.remarks || <span className="admin-muted">—</span>}
                        </td>
                        <td className="admin-contact">{formatDate(l.createdAt)}</td>
                        <td>
                          <select
                            className={`admin-status-select ${statusClass(l.recruitmentStatus || 'Shortlisted')}`}
                            value={l.recruitmentStatus || 'Shortlisted'}
                            onChange={(e) => handleRecruitmentStatusChange(l.id, e.target.value as TutorRecruitmentStatus)}
                          >
                            {TUTOR_RECRUITMENT_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className={`admin-status-select ${statusClass(l.onboardingStatus || 'not-set')}`}
                            value={l.onboardingStatus || ''}
                            onChange={(e) => handleOnboardingStatusChange(l.id, e.target.value as TutorOnboardingStatus | '')}
                          >
                            <option value="">Not set</option>
                            {TUTOR_ONBOARDING_STATUSES.map((s) => (
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

              {activeTab === 'hirings' && (
                <>
                  <thead>
                    <tr>
                      <th>Dept</th>
                      <th>Job Title</th>
                      <th>Location</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Date Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filtered as Job[]).map((j) => (
                      <tr key={j.id}>
                        <td><span className="admin-tag">{j.dept}</span></td>
                        <td className="admin-name">{j.title}</td>
                        <td>{j.location}</td>
                        <td>{j.type}</td>
                        <td className="admin-msg">{j.desc}</td>
                        <td className="admin-contact">{formatDate(j.createdAt)}</td>
                        <td>
                          <button className="admin-del" onClick={() => handleDeleteJob(j.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {activeTab === 'blogs' && (
                <>
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th>Blog Title</th>
                      <th>Excerpt / Text</th>
                      <th>Read Time</th>
                      <th>Keywords</th>
                      <th>Posted Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filtered as BlogPost[]).map((b) => (
                      <tr key={b.id}>
                        <td><span className="admin-tag">{b.tag}</span></td>
                        <td className="admin-name">{b.title}</td>
                        <td className="admin-msg">{b.text}</td>
                        <td>{b.read}</td>
                        <td>
                          {b.tags && b.tags.length > 0 ? (
                            <div className="admin-tutor-tags">
                              {b.tags.map((t) => (
                                <span key={t} className="admin-tutor-tag">{t}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="admin-muted">—</span>
                          )}
                        </td>
                        <td className="admin-contact">{b.date}</td>
                        <td>
                          <button className="admin-del" onClick={() => handleDeleteBlog(b.id)}>
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

      {/* ── Add Tutor Applicant Modal ── */}
      {showAddTutorModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowAddTutorModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add Applicant Manually</h2>
              <button className="admin-modal-close" onClick={() => setShowAddTutorModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddTutor} className="admin-modal-form">
              {addTutorError && <div className="admin-error">{addTutorError}</div>}
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Name *</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={addTutorForm.name}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="admin-form-field">
                  <label>Email *</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={addTutorForm.email}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Phone</label>
                  <input
                    type="tel"
                    placeholder="+1 98765 43210"
                    value={addTutorForm.phone}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label>City</label>
                  <input
                    type="text"
                    placeholder="e.g. New York, USA"
                    value={addTutorForm.city}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Subject / Role</label>
                  <input
                    type="text"
                    placeholder="e.g. SAT Math Tutor"
                    value={addTutorForm.subject}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, subject: e.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Grades / Target Audience</label>
                  <input
                    type="text"
                    placeholder="e.g. Grades 9-12, College"
                    value={addTutorForm.grades}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, grades: e.target.value }))}
                  />
                </div>
              </div>
              <div className="admin-form-field">
                <label>Test Prep Specializations</label>
                <div className="test-prep-checklist">
                  {TEST_PREP_OPTIONS.map((option) => (
                    <label key={option} className="checklist-item">
                      <input
                        type="checkbox"
                        checked={addTutorForm.testPrep.includes(option)}
                        onChange={() => handleTutorTestPrepChange(option)}
                      />
                      <span className="checklist-label">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Hourly Rate (INR)</label>
                  <input
                    type="text"
                    placeholder="e.g. ₹500/hr"
                    value={addTutorForm.hourlyRate}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Companies Worked With</label>
                  <input
                    type="text"
                    placeholder="e.g. Byju's, Vedantu"
                    value={addTutorForm.companiesWorkedWith}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, companiesWorkedWith: e.target.value }))}
                  />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Status 1 (Recruitment)</label>
                  <select
                    value={addTutorForm.recruitmentStatus}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, recruitmentStatus: e.target.value as TutorRecruitmentStatus }))}
                  >
                    {TUTOR_RECRUITMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="admin-form-field">
                  <label>Status 2 (Onboarding)</label>
                  <select
                    value={addTutorForm.onboardingStatus}
                    onChange={(e) => setAddTutorForm((f) => ({ ...f, onboardingStatus: e.target.value as TutorOnboardingStatus | '' }))}
                  >
                    <option value="">Not set</option>
                    {TUTOR_ONBOARDING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-form-field">
                <label>Video URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={addTutorForm.videoUrl}
                  onChange={(e) => setAddTutorForm((f) => ({ ...f, videoUrl: e.target.value }))}
                />
              </div>
              <div className="admin-form-field">
                <label>Upload CV (PDF, DOC, DOCX - Max 5MB)</label>
                <div className="file-uploader-box">
                  <input
                    type="file"
                    id="admin-tutor-cv-upload"
                    accept=".pdf,.doc,.docx"
                    onChange={handleTutorFileChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="admin-tutor-cv-upload" className="file-select-btn">Choose File</label>
                  <span className="file-name-display">{addTutorCvFile?.name || 'No file selected'}</span>
                </div>
              </div>
              <div className="admin-form-field">
                <label>Remarks</label>
                <textarea
                  rows={3}
                  placeholder="Any notes about this applicant…"
                  value={addTutorForm.remarks}
                  onChange={(e) => setAddTutorForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setShowAddTutorModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary" disabled={addTutorLoading}>
                  {addTutorLoading ? 'Adding…' : 'Add Applicant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Job Modal ── */}
      {showAddJobModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowAddJobModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add Job Opening</h2>
              <button className="admin-modal-close" onClick={() => setShowAddJobModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddJob} className="admin-modal-form">
              {addJobError && <div className="admin-error">{addJobError}</div>}
              
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Job Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Math Tutor"
                    value={addJobForm.title}
                    onChange={(e) => setAddJobForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Department *</label>
                  <select
                    value={addJobForm.dept}
                    onChange={(e) => setAddJobForm((f) => ({ ...f, dept: e.target.value }))}
                  >
                    <option value="Academics">Academics</option>
                    <option value="Operations">Operations</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Student Success">Student Success</option>
                    <option value="Technology">Technology</option>
                    <option value="Design">Design</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Remote (Global)"
                    value={addJobForm.location}
                    onChange={(e) => setAddJobForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Job Type *</label>
                  <select
                    value={addJobForm.type}
                    onChange={(e) => setAddJobForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Remote">Remote</option>
                    <option value="Internship">Internship</option>
                  </select>
                </div>
              </div>

              <div className="admin-form-field">
                <label>Job Description *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Explain the role, requirements, and responsibilities..."
                  value={addJobForm.desc}
                  onChange={(e) => setAddJobForm((f) => ({ ...f, desc: e.target.value }))}
                />
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setShowAddJobModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary" disabled={addJobLoading}>
                  {addJobLoading ? 'Adding...' : 'Add Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Blog Modal ── */}
      {showAddBlogModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowAddBlogModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add Blog Post</h2>
              <button className="admin-modal-close" onClick={() => setShowAddBlogModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddBlog} className="admin-modal-form">
              {addBlogError && <div className="admin-error">{addBlogError}</div>}
              
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Blog Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tips to Crack the SAT Math"
                    value={addBlogForm.title}
                    onChange={(e) => setAddBlogForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Tag / Category *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. STUDY TIPS, SAT, COLLEGE ADMISSIONS"
                    value={addBlogForm.tag}
                    onChange={(e) => setAddBlogForm((f) => ({ ...f, tag: e.target.value }))}
                  />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-field">
                  <label>Read Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5 min read"
                    value={addBlogForm.read}
                    onChange={(e) => setAddBlogForm((f) => ({ ...f, read: e.target.value }))}
                  />
                </div>
                <div className="admin-form-field">
                  <label>Date (Default: Today)</label>
                  <input
                    type="text"
                    placeholder="e.g. June 10, 2026"
                    value={addBlogForm.date}
                    onChange={(e) => setAddBlogForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="admin-form-field">
                <label>Keywords (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. sat prep, math tips, study habits"
                  value={addBlogForm.tagsString}
                  onChange={(e) => setAddBlogForm((f) => ({ ...f, tagsString: e.target.value }))}
                />
              </div>

              <div className="admin-form-field">
                <label>Image URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={addBlogForm.image}
                  onChange={(e) => setAddBlogForm((f) => ({ ...f, image: e.target.value }))}
                />
              </div>

              <div className="admin-form-field">
                <label>Excerpt / Content *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Write a brief excerpt or summary of the blog post..."
                  value={addBlogForm.text}
                  onChange={(e) => setAddBlogForm((f) => ({ ...f, text: e.target.value }))}
                />
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn-secondary" onClick={() => setShowAddBlogModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn-primary" disabled={addBlogLoading}>
                  {addBlogLoading ? 'Adding...' : 'Add Blog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
