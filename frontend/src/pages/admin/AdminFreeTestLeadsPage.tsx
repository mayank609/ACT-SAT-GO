import { useState, useEffect, useMemo } from 'react';
import {
  Search, RefreshCw, Download, MessageSquare,
  Phone, Mail, ExternalLink, CheckCircle2, Clock, XCircle,
  Settings, X, Sparkles,
  Award, TrendingUp, Users, Eye, Trash2, Edit3, Check, Save
} from 'lucide-react';
import { api, type FreeTestLead, type FreeTestConfig } from '../../lib/api';
import { Modal } from '../../components/common/Modal';

const EXAM_OPTIONS = ['All', 'SAT', 'ACT', 'AP', 'GENERAL'];
const LEAD_STATUS_OPTIONS = ['All', 'New', 'Contacted', 'Follow-Up', 'Enrolled', 'Archived'];
const TEST_STATUS_OPTIONS = ['All', 'Completed', 'In-Progress', 'Registered'];

export function AdminFreeTestLeadsPage() {
  const [activeTab, setActiveTab] = useState<'leads' | 'config'>('leads');
  const [leads, setLeads] = useState<FreeTestLead[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState('All');
  const [leadStatusFilter, setLeadStatusFilter] = useState('All');
  const [testStatusFilter, setTestStatusFilter] = useState('All');

  // Selected lead for detailed attempt view
  const [selectedLead, setSelectedLead] = useState<FreeTestLead | null>(null);

  // Edit Note state
  const [noteEditingLead, setNoteEditingLead] = useState<FreeTestLead | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Delete lead state
  const [deleteConfirmLead, setDeleteConfirmLead] = useState<FreeTestLead | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Config State
  const [config, setConfig] = useState<FreeTestConfig | null>(null);
  const [availableTests, setAvailableTests] = useState<Array<{ id: string; title: string; category?: string; subCategory?: string }>>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [leadsRes, configRes] = await Promise.all([
        api.getFreeTestLeads().catch(() => ({ leads: [] })),
        api.getFreeTestConfig().catch(() => ({
          config: {
            activeTestId: null,
            examTests: { SAT: null, ACT: null, AP: null },
            bannerTitle: 'Free Full-Length Diagnostic Test',
            bannerSubtitle: 'Experience the real exam interface, get instant detailed analytics, and identify your exact strengths and weak areas.',
            instructions: 'This is a timed diagnostic test designed to simulate official exam conditions. Work carefully and manage your time wisely.',
            activeOnWebsite: true,
          },
          activeTestDetails: {},
          availableTests: [],
        })),
      ]);
      setLeads(leadsRes.leads || []);
      setConfig(configRes.config);
      setAvailableTests(configRes.availableTests || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (examFilter !== 'All' && l.exam !== examFilter) return false;
      if (leadStatusFilter !== 'All' && l.leadStatus !== leadStatusFilter) return false;
      if (testStatusFilter !== 'All' && l.status !== testStatusFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = l.name.toLowerCase().includes(q);
        const matchEmail = l.email.toLowerCase().includes(q);
        const matchPhone = l.phone.toLowerCase().includes(q);
        const matchSchool = (l.school || '').toLowerCase().includes(q);
        const matchTest = (l.testTitle || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchSchool && !matchTest) return false;
      }

      return true;
    });
  }, [leads, examFilter, leadStatusFilter, testStatusFilter, search]);

  // KPI Metrics
  const stats = useMemo(() => {
    const total = leads.length;
    const completed = leads.filter((l) => l.status === 'Completed').length;
    const registered = leads.filter((l) => l.status === 'Registered' || l.status === 'In-Progress').length;
    const enrolled = leads.filter((l) => l.leadStatus === 'Enrolled').length;
    const scores = leads.filter((l) => l.percentage != null).map((l) => l.percentage!);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const conversionRate = total > 0 ? Math.round((enrolled / total) * 100) : 0;

    return { total, completed, registered, enrolled, avgScore, conversionRate };
  }, [leads]);

  // Update Lead Status
  const handleUpdateStatus = async (leadId: string, newStatus: string) => {
    try {
      await api.updateFreeTestLead(leadId, { leadStatus: newStatus });
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, leadStatus: newStatus as any } : l))
      );
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, leadStatus: newStatus as any } : null));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update lead status');
    }
  };

  // Save Note
  const handleSaveNote = async () => {
    if (!noteEditingLead) return;
    setSavingNote(true);
    try {
      await api.updateFreeTestLead(noteEditingLead.id, { notes: noteInput });
      setLeads((prev) =>
        prev.map((l) => (l.id === noteEditingLead.id ? { ...l, notes: noteInput } : l))
      );
      if (selectedLead && selectedLead.id === noteEditingLead.id) {
        setSelectedLead((prev) => (prev ? { ...prev, notes: noteInput } : null));
      }
      setNoteEditingLead(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  // Delete Lead
  const handleDeleteLead = async () => {
    if (!deleteConfirmLead) return;
    setDeleting(true);
    try {
      await api.deleteFreeTestLead(deleteConfirmLead.id);
      setLeads((prev) => prev.filter((l) => l.id !== deleteConfirmLead.id));
      if (selectedLead?.id === deleteConfirmLead.id) {
        setSelectedLead(null);
      }
      setDeleteConfirmLead(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete lead');
    } finally {
      setDeleting(false);
    }
  };

  // Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSavingConfig(true);
    setConfigSuccess(false);
    try {
      await api.updateFreeTestConfig(config);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (!leads.length) return;
    const headers = [
      'Lead ID', 'Student Name', 'Email', 'Phone', 'Exam', 'Grade', 'School', 'Target Score',
      'Test Title', 'Test Status', 'Score', 'Max Score', 'Accuracy %', 'Time (Minutes)',
      'Lead Status', 'Registered At', 'Completed At', 'Notes'
    ];
    const rows = leads.map((l) => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.email}"`,
      `"${l.phone}"`,
      l.exam,
      `"${l.grade || ''}"`,
      `"${l.school || ''}"`,
      `"${l.targetScore || ''}"`,
      `"${(l.testTitle || '').replace(/"/g, '""')}"`,
      l.status,
      l.totalScore != null ? l.totalScore : '',
      l.maxScore != null ? l.maxScore : '',
      l.percentage != null ? `${l.percentage}%` : '',
      l.timeSpentSeconds ? Math.round(l.timeSpentSeconds / 60) : 0,
      l.leadStatus,
      l.registeredAt ? new Date(l.registeredAt).toLocaleString() : '',
      l.completedAt ? new Date(l.completedAt).toLocaleString() : '',
      `"${(l.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `free-test-leads-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'New':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">New</span>;
      case 'Contacted':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Contacted</span>;
      case 'Follow-Up':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Follow-Up</span>;
      case 'Enrolled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Enrolled</span>;
      case 'Archived':
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">{s}</span>;
    }
  };

  const testStatusBadge = (s: string) => {
    switch (s) {
      case 'Completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><CheckCircle2 size={12} /> Completed</span>;
      case 'In-Progress':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Clock size={12} /> In Progress</span>;
      case 'Registered':
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"><Users size={12} /> Registered</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Free Test Leads & Management</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              <Sparkles size={12} className="mr-1 text-blue-600" /> Website Leads
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track prospective students taking the free diagnostic test on the website, view their performance scores, and configure active tests.
          </p>
        </div>

        {/* Tab Switcher & Export */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              onClick={() => setActiveTab('leads')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'leads'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Leads & Test Results ({leads.length})
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'config'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings size={13} /> Website Free Test Setup
            </button>
          </div>

          {activeTab === 'leads' && (
            <button
              onClick={handleExportCsv}
              disabled={leads.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm disabled:opacity-50"
            >
              <Download size={14} /> Export CSV
            </button>
          )}

          <button
            onClick={loadData}
            title="Refresh Data"
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {activeTab === 'leads' ? (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total Leads</span>
                <Users size={16} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</p>
              <span className="text-[11px] text-slate-400">All registered website users</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Tests Completed</span>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600 mt-2">{stats.completed}</p>
              <span className="text-[11px] text-emerald-600 font-medium">
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% completion
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">In-Progress / Reg</span>
                <Clock size={16} className="text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600 mt-2">{stats.registered}</p>
              <span className="text-[11px] text-slate-400">Pending test submission</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Enrolled Students</span>
                <Award size={16} className="text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-purple-600 mt-2">{stats.enrolled}</p>
              <span className="text-[11px] text-purple-600 font-medium">Converted to paid</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Avg Test Accuracy</span>
                <TrendingUp size={16} className="text-indigo-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stats.avgScore}%</p>
              <span className="text-[11px] text-slate-400">Across completed tests</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Conversion Rate</span>
                <Sparkles size={16} className="text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stats.conversionRate}%</p>
              <span className="text-[11px] text-slate-400">Lead → Enrolled</span>
            </div>
          </div>

          {/* Search and Filters Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, email, phone, school..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {/* Exam Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Exam:</label>
                <select
                  value={examFilter}
                  onChange={(e) => setExamFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {EXAM_OPTIONS.map((ex) => (
                    <option key={ex} value={ex}>{ex}</option>
                  ))}
                </select>
              </div>

              {/* Lead Stage Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Stage:</label>
                <select
                  value={leadStatusFilter}
                  onChange={(e) => setLeadStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {LEAD_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Test Status Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Test:</label>
                <select
                  value={testStatusFilter}
                  onChange={(e) => setTestStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {TEST_STATUS_OPTIONS.map((ts) => (
                    <option key={ts} value={ts}>{ts}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Leads Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Registered Students & Test Attempts ({filteredLeads.length})
              </h2>
              <span className="text-xs text-slate-400">Click student name or report icon to inspect detailed answers</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-sm">Loading registered leads...</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold text-slate-600">No free test leads found</p>
                <p className="text-xs mt-1">When prospective students register for the free test on the website, they will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Student & Contact</th>
                      <th className="py-3 px-3">Exam / Grade</th>
                      <th className="py-3 px-3">Test Taken</th>
                      <th className="py-3 px-3 text-center">Test Status</th>
                      <th className="py-3 px-3 text-center">Score & Accuracy</th>
                      <th className="py-3 px-3">Time Spent</th>
                      <th className="py-3 px-3">Lead Stage</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredLeads.map((lead) => {
                      const cleanPhone = lead.phone.replace(/[^0-9+]/g, '');
                      const waHref = cleanPhone.startsWith('+')
                        ? `https://wa.me/${cleanPhone.slice(1)}`
                        : `https://wa.me/${cleanPhone}`;

                      return (
                        <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Student Info */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{lead.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span className="flex items-center gap-1 truncate max-w-[140px]" title={lead.email}>
                                <Mail size={11} className="text-slate-400 shrink-0" /> {lead.email}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-mono">
                                <Phone size={11} className="text-slate-400 shrink-0" /> {lead.phone}
                              </span>
                            </div>
                            {lead.school && (
                              <div className="text-[10px] text-slate-400 mt-0.5">School: {lead.school}</div>
                            )}
                          </td>

                          {/* Exam / Grade */}
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                              {lead.exam || 'SAT'}
                            </span>
                            {lead.grade && (
                              <div className="text-[11px] text-slate-500 mt-0.5">Grade: {lead.grade}</div>
                            )}
                          </td>

                          {/* Test Title */}
                          <td className="py-3 px-3 max-w-[180px]">
                            <div className="font-medium text-slate-800 truncate" title={lead.testTitle}>
                              {lead.testTitle || 'Diagnostic Test'}
                            </div>
                            {lead.targetScore && (
                              <div className="text-[10px] text-slate-400">Target: {lead.targetScore}</div>
                            )}
                          </td>

                          {/* Test Status */}
                          <td className="py-3 px-3 text-center">
                            {testStatusBadge(lead.status)}
                          </td>

                          {/* Score & Accuracy */}
                          <td className="py-3 px-3 text-center">
                            {lead.status === 'Completed' && lead.totalScore != null ? (
                              <div>
                                <span className="font-bold text-sm text-emerald-700">
                                  {lead.totalScore} <span className="text-[10px] font-normal text-slate-400">/ {lead.maxScore || 1600}</span>
                                </span>
                                {lead.percentage != null && (
                                  <div className="text-[10px] text-slate-500 font-medium">
                                    {lead.percentage}% accuracy
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Pending</span>
                            )}
                          </td>

                          {/* Time Spent */}
                          <td className="py-3 px-3">
                            {lead.timeSpentSeconds ? (
                              <span className="font-mono text-slate-600 text-[11px]">
                                {Math.floor(lead.timeSpentSeconds / 60)}m {lead.timeSpentSeconds % 60}s
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Lead Stage Dropdown */}
                          <td className="py-3 px-3">
                            <select
                              value={lead.leadStatus || 'New'}
                              onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                              className="text-[11px] font-semibold rounded-lg px-2 py-1 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                            >
                              <option value="New">New</option>
                              <option value="Contacted">Contacted</option>
                              <option value="Follow-Up">Follow-Up</option>
                              <option value="Enrolled">Enrolled</option>
                              <option value="Archived">Archived</option>
                            </select>
                          </td>

                          {/* Date */}
                          <td className="py-3 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                            {new Date(lead.registeredAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Direct Chat */}
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Chat on WhatsApp"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                              >
                                <MessageSquare size={14} />
                              </a>

                              {/* View Detailed Test Report */}
                              <button
                                onClick={() => setSelectedLead(lead)}
                                title="View Full Test Attempt & Answers"
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              >
                                <Eye size={14} />
                              </button>

                              {/* Edit Note */}
                              <button
                                onClick={() => {
                                  setNoteEditingLead(lead);
                                  setNoteInput(lead.notes || '');
                                }}
                                title="Add/Edit Counselor Note"
                                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                              >
                                <Edit3 size={14} />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setDeleteConfirmLead(lead)}
                                title="Delete Lead"
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Configuration Tab ("Make and Add to Website") */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-3xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Website Free Diagnostic Test Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select which published test(s) in your system will be served to prospective students on the public website.
              </p>
            </div>
            <a
              href="/free-test"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
            >
              Preview on Website <ExternalLink size={12} />
            </a>
          </div>

          {config ? (
            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="font-semibold text-xs text-slate-900">Enable Free Test on Website</div>
                  <div className="text-[11px] text-slate-500">When enabled, students can take the diagnostic test directly from the website</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.activeOnWebsite}
                    onChange={(e) => setConfig({ ...config, activeOnWebsite: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Selected Tests by Exam */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Active Tests for Website</h3>

                {/* Default / SAT Test */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    SAT Free Diagnostic Test:
                  </label>
                  <select
                    value={config.examTests?.SAT || config.activeTestId || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        activeTestId: e.target.value,
                        examTests: { ...config.examTests, SAT: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">— Select a Published SAT Test —</option>
                    {availableTests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} {t.category ? `(${t.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ACT Test */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ACT Free Diagnostic Test:
                  </label>
                  <select
                    value={config.examTests?.ACT || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        examTests: { ...config.examTests, ACT: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">— Select a Published ACT Test (Optional) —</option>
                    {availableTests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} {t.category ? `(${t.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AP Test */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    AP Free Diagnostic Test:
                  </label>
                  <select
                    value={config.examTests?.AP || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        examTests: { ...config.examTests, AP: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">— Select a Published AP Test (Optional) —</option>
                    {availableTests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} {t.category ? `(${t.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Banner Text Customization */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Website Banner & Instructions</h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Landing Page Banner Headline:
                  </label>
                  <input
                    type="text"
                    value={config.bannerTitle || ''}
                    onChange={(e) => setConfig({ ...config, bannerTitle: e.target.value })}
                    placeholder="e.g. Free Full-Length Diagnostic Test"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Landing Page Subtitle:
                  </label>
                  <textarea
                    rows={2}
                    value={config.bannerSubtitle || ''}
                    onChange={(e) => setConfig({ ...config, bannerSubtitle: e.target.value })}
                    placeholder="e.g. Experience the real exam interface and get instant detailed analytics..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pre-Test Student Instructions:
                  </label>
                  <textarea
                    rows={3}
                    value={config.instructions || ''}
                    onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
                    placeholder="e.g. This is a timed diagnostic test. Work carefully..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div>
                  {configSuccess && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <Check size={14} /> Free test settings saved successfully!
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  <Save size={14} />
                  {savingConfig ? 'Saving Settings...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-8 text-center text-slate-500">Loading settings...</div>
          )}
        </div>
      )}

      {/* Slide-over Drawer / Modal: Detailed Test Report & Answer Inspection */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="p-6 bg-slate-900 text-white sticky top-0 z-10 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {selectedLead.exam || 'SAT'}
                  </span>
                  <h3 className="text-lg font-bold">{selectedLead.name}</h3>
                </div>
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                  <span>{selectedLead.email}</span>
                  <span>•</span>
                  <span>{selectedLead.phone}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {/* Score Header Card */}
              {selectedLead.status === 'Completed' && selectedLead.totalScore != null ? (
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Test Score Result</span>
                      <div className="text-3xl font-extrabold text-emerald-900 mt-1">
                        {selectedLead.totalScore} <span className="text-base font-normal text-emerald-700">/ {selectedLead.maxScore || 1600}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-800">{selectedLead.percentage}%</div>
                      <span className="text-xs text-emerald-600 font-medium">Overall Accuracy</span>
                    </div>
                  </div>

                  {/* Section Breakdown if available */}
                  {selectedLead.sectionScores && selectedLead.sectionScores.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-emerald-200/60 grid grid-cols-2 gap-3">
                      {selectedLead.sectionScores.map((sec) => (
                        <div key={sec.sectionId} className="bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                          <div className="text-xs font-bold text-slate-800">{sec.sectionName}</div>
                          <div className="flex items-center justify-between mt-1 text-xs text-slate-600">
                            <span>Score: <b>{sec.score} / {sec.maxScore}</b></span>
                            <span className="text-emerald-700 font-semibold">{sec.accuracy}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center text-slate-500 text-xs">
                  Student registered on {new Date(selectedLead.registeredAt).toLocaleDateString()} but has not submitted the test yet.
                </div>
              )}

              {/* Lead CRM Details & Notes */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Lead Information & Notes</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Current Stage:</span>
                    <div className="mt-1">{statusBadge(selectedLead.leadStatus)}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Target Score:</span>
                    <div className="font-semibold text-slate-800 mt-1">{selectedLead.targetScore || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Grade:</span>
                    <div className="font-semibold text-slate-800 mt-1">{selectedLead.grade || 'Not specified'}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">School:</span>
                    <div className="font-semibold text-slate-800 mt-1">{selectedLead.school || 'Not specified'}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-600">Counselor Note:</span>
                  <p className="text-xs text-slate-700 mt-1 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    {selectedLead.notes || 'No notes added yet.'}
                  </p>
                </div>
              </div>

              {/* Question-by-Question Attempt Breakdown */}
              {selectedLead.answers && Object.keys(selectedLead.answers).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Question-by-Question Breakdown ({Object.keys(selectedLead.answers).length} questions)
                  </h4>

                  <div className="space-y-3">
                    {Object.values(selectedLead.answers).map((ans, idx) => (
                      <div
                        key={ans.questionId || idx}
                        className={`p-4 rounded-xl border ${
                          ans.isCorrect
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : ans.answerGiven
                            ? 'bg-red-50/40 border-red-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-bold text-slate-800">
                            Question {idx + 1} {ans.topic ? `• ${ans.topic}` : ''}
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-xs">
                            {ans.isCorrect ? (
                              <span className="text-emerald-700 flex items-center gap-1"><CheckCircle2 size={13} /> Correct</span>
                            ) : ans.answerGiven ? (
                              <span className="text-red-600 flex items-center gap-1"><XCircle size={13} /> Incorrect</span>
                            ) : (
                              <span className="text-slate-400">Skipped</span>
                            )}
                          </span>
                        </div>

                        {ans.questionText && (
                          <p className="text-xs text-slate-700 mb-2 font-medium">{ans.questionText}</p>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/50">
                          <div>
                            <span className="text-slate-400">Student Answer:</span>
                            <div className="font-semibold text-slate-800 mt-0.5">
                              {ans.answerGiven !== null && ans.answerGiven !== undefined ? String(ans.answerGiven) : '—'}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Correct Answer:</span>
                            <div className="font-semibold text-emerald-700 mt-0.5">
                              {typeof ans.correctAnswer === 'object'
                                ? ans.correctAnswer?.key || ans.correctAnswer?.value || JSON.stringify(ans.correctAnswer)
                                : String(ans.correctAnswer || '—')}
                            </div>
                          </div>
                        </div>

                        {ans.explanation && (
                          <div className="mt-2.5 text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                            <b>Explanation:</b> {ans.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">Lead ID: {selectedLead.id}</span>
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Editing Modal */}
      <Modal
        isOpen={!!noteEditingLead}
        onClose={() => setNoteEditingLead(null)}
        title={`Edit Counselor Note for ${noteEditingLead?.name || 'Lead'}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Counselor Note / Follow-up Status</label>
            <textarea
              rows={4}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. Called parent on 2nd Sept. Student scored 1380, interested in SAT 1-on-1 private tutoring program."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setNoteEditingLead(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={savingNote}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {savingNote ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmLead}
        onClose={() => setDeleteConfirmLead(null)}
        title="Delete Free Test Lead"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to permanently delete the lead record for <b>{deleteConfirmLead?.name}</b> ({deleteConfirmLead?.email})?
            This will remove their test score and attempt history.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmLead(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteLead}
              disabled={deleting}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Lead'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminFreeTestLeadsPage;
