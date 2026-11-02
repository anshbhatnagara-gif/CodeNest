import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  Eye,
  CheckCircle2,
  Clock,
  BookOpen,
  UploadCloud,
  File,
  X,
  Download,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import Toast from '../components/Toast';
import { formatBytes, getFileTypeBadge } from '../utils/formatters';
import useEscapeKey from '../hooks/useEscapeKey';

const OwnerNotes = () => {
  const { api } = useAuth();

  const [notes, setNotes] = useState([]);
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [previewNote, setPreviewNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // In-app delete modal & toast feedback
  const [deleteNoteModal, setDeleteNoteModal] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Handle Escape key to close modals
  useEscapeKey(() => {
    if (deleteNoteModal && !deleteSubmitting) setDeleteNoteModal(null);
    if (previewNote) setPreviewNote(null);
    if (modalOpen && !saving) setModalOpen(false);
  }, Boolean(deleteNoteModal || modalOpen || previewNote));

  // Course modules for active selection in modal
  const [selectedCourseModules, setSelectedCourseModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(false);

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    content: '',
    course_id: '',
    module_id: '',
    status: 'published'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const fetchNotes = async () => {
    try {
      const { data } = await api.get('/owner/notes');
      if (data.success) {
        setNotes(data.notes);
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Error fetching owner notes:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data } = await api.get('/courses');
      if (data.success) {
        setCourses(data.courses);
      }
    } catch (e) {
      console.error('Error fetching courses:', e);
    }
  };

  useEffect(() => {
    fetchNotes();
    fetchCourses();
  }, []);

  // Handle Escape key to close modals
  useEffect(() => {
    if (!modalOpen && !previewNote) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (modalOpen && !saving) setModalOpen(false);
        if (previewNote) setPreviewNote(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, previewNote, saving]);

  // Fetch modules when a course is chosen in the Create/Edit modal
  const fetchModulesForCourse = async (courseId) => {
    if (!courseId) {
      setSelectedCourseModules([]);
      return;
    }
    setLoadingModules(true);
    try {
      const { data } = await api.get(`/courses/${courseId}`);
      if (data.success && data.course?.modules) {
        setSelectedCourseModules(data.course.modules);
      } else {
        setSelectedCourseModules([]);
      }
    } catch (e) {
      console.error('Error fetching course modules:', e);
      setSelectedCourseModules([]);
    } finally {
      setLoadingModules(false);
    }
  };

  const openCreateModal = () => {
    setEditingNote(null);
    setForm({
      title: '',
      description: '',
      content: '',
      course_id: courses.length > 0 ? courses[0].id : '',
      module_id: '',
      status: 'published'
    });
    setSelectedFile(null);
    setRemoveExistingFile(false);
    setFormError('');
    if (courses.length > 0) {
      fetchModulesForCourse(courses[0].id);
    }
    setModalOpen(true);
  };

  const openEditModal = (note) => {
    setEditingNote(note);
    setForm({
      title: note.title || '',
      description: note.description || '',
      content: note.content || '',
      course_id: note.course_id || '',
      module_id: note.module_id || '',
      status: note.status || 'draft'
    });
    setSelectedFile(null);
    setRemoveExistingFile(false);
    setFormError('');
    fetchModulesForCourse(note.course_id);
    setModalOpen(true);
  };

  const handleCourseChange = (e) => {
    const courseId = e.target.value;
    setForm(p => ({ ...p, course_id: courseId, module_id: '' }));
    fetchModulesForCourse(courseId);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const maxMb = 25;
    if (file.size > maxMb * 1024 * 1024) {
      setFormError(`File size (${formatBytes(file.size)}) exceeds the allowed 25MB limit.`);
      return;
    }
    setFormError('');
    setSelectedFile(file);
    setRemoveExistingFile(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.title.trim()) {
      setFormError('Note title is required.');
      return;
    }

    if (!form.course_id) {
      setFormError('Please select a course.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title.trim());
      formData.append('description', form.description.trim());
      formData.append('content', form.content.trim());
      formData.append('course_id', form.course_id);
      if (form.module_id) formData.append('module_id', form.module_id);
      formData.append('status', form.status);

      if (selectedFile) {
        formData.append('file', selectedFile);
      } else if (removeExistingFile) {
        formData.append('remove_file', 'true');
      }

      if (editingNote) {
        const { data } = await api.put(`/owner/notes/${editingNote.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (data.success) {
          setToast({ type: 'success', message: `Note "${form.title}" updated successfully.` });
          setModalOpen(false);
          fetchNotes();
        }
      } else {
        const { data } = await api.post('/owner/notes', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (data.success) {
          setToast({ type: 'success', message: `Note "${form.title}" uploaded successfully.` });
          setModalOpen(false);
          fetchNotes();
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save note.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (note) => {
    const nextStatus = note.status === 'published' ? 'draft' : 'published';
    try {
      const { data } = await api.patch(`/owner/notes/${note.id}/status`, { status: nextStatus });
      if (data.success) {
        setToast({ type: 'success', message: `Note status updated to ${nextStatus}.` });
        fetchNotes();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to change status.' });
    }
  };

  const handleDelete = (note) => {
    setDeleteNoteModal(note);
  };

  const handleConfirmDeleteNote = async () => {
    if (!deleteNoteModal) return;
    setDeleteSubmitting(true);
    try {
      const { data } = await api.delete(`/owner/notes/${deleteNoteModal.id}`);
      if (data.success) {
        setToast({ type: 'success', message: `Note "${deleteNoteModal.title}" deleted successfully.` });
        fetchNotes();
        if (previewNote?.id === deleteNoteModal.id) setPreviewNote(null);
        setDeleteNoteModal(null);
      } else {
        setToast({ type: 'error', message: data.message || 'Failed to delete note.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete note.' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Filter notes
  const filteredNotes = notes.filter(n => {
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.description && n.description.toLowerCase().includes(search.toLowerCase())) ||
      (n.content && n.content.toLowerCase().includes(search.toLowerCase())) ||
      (n.course_title && n.course_title.toLowerCase().includes(search.toLowerCase()));

    const matchCourse = courseFilter === 'All' || n.course_id === parseInt(courseFilter, 10);
    const matchModule = moduleFilter === 'All' || (moduleFilter === 'none' ? !n.module_id : n.module_id === parseInt(moduleFilter, 10));
    const matchStatus = statusFilter === 'All' || n.status === statusFilter.toLowerCase();

    return matchSearch && matchCourse && matchModule && matchStatus;
  });

  const [downloadingNoteId, setDownloadingNoteId] = useState(null);

  const handleDownloadFile = async (note) => {
    if (!note || !note.id) return;
    setDownloadingNoteId(note.id);
    try {
      const response = await api.get(`/notes/${note.id}/download`, {
        responseType: 'blob'
      });

      let fileName = note.file_name || 'download';
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('File download error:', err);
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to download file.' });
    } finally {
      setDownloadingNoteId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 font-medium">Loading Notes Management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 page-enter text-left">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white overflow-hidden shadow-xl shadow-indigo-500/10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center border border-white/20 shadow-md">
              <FileText className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold">Notes Management</h1>
              <p className="text-indigo-200/90 text-sm mt-0.5">Create, upload, and organize study notes for your students.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openCreateModal}
              className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 text-sm active:scale-95"
            >
              <Plus size={18} />
              Upload Note
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Notes', value: stats?.total_notes || 0, icon: <FileText size={20} className="text-indigo-600" />, gradient: 'from-indigo-50 to-indigo-100/50', accent: 'border-l-indigo-500' },
          { label: 'Published', value: stats?.published_notes || 0, icon: <CheckCircle2 size={20} className="text-emerald-600" />, gradient: 'from-emerald-50 to-emerald-100/50', accent: 'border-l-emerald-500' },
          { label: 'Drafts', value: stats?.draft_notes || 0, icon: <Clock size={20} className="text-amber-600" />, gradient: 'from-amber-50 to-amber-100/50', accent: 'border-l-amber-500' },
          { label: 'Courses with Notes', value: stats?.courses_with_notes || 0, icon: <BookOpen size={20} className="text-blue-600" />, gradient: 'from-blue-50 to-blue-100/50', accent: 'border-l-blue-500' },
        ].map((s) => (
          <div key={s.label} className={`card-static p-5 flex items-center gap-3 border-l-4 ${s.accent} bg-gradient-to-r ${s.gradient}`}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Directory Card */}
      <div className="card-static p-6 space-y-6">
        {/* Controls / Filter Bar */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
            <h2 className="text-lg font-bold text-gray-900">Notes Directory</h2>
            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">{filteredNotes.length} notes</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="owner-notes-search"
                type="text"
                placeholder="Search notes, course, keywords..."
                aria-label="Search notes, course, keywords"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-8 py-2 text-xs w-full sm:w-56"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Course Filter */}
            <select
              aria-label="Filter by course"
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
            >
              <option value="All">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="published">🟢 Published</option>
              <option value="draft">🟡 Draft</option>
            </select>
          </div>
        </div>

        {/* Notes Table */}
        <div className="overflow-x-auto border border-gray-200/80 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                <th className="p-3.5">Note Title & Info</th>
                <th className="p-3.5">Course & Module</th>
                <th className="p-3.5">File Attached</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-14 text-center">
                    <div className="space-y-3">
                      <FileText className="w-10 h-10 text-gray-300 mx-auto" />
                      <p className="text-gray-500 font-bold text-sm">No notes found</p>
                      <p className="text-gray-400 text-xs max-w-sm mx-auto">Get started by creating your first lecture note or study guide.</p>
                      <button onClick={openCreateModal} className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 mt-2">
                        <Plus size={14} /> Upload First Note
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note, idx) => (
                  <tr key={note.id} className={`hover:bg-indigo-50/30 transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="p-3.5 max-w-xs">
                      <div className="space-y-1">
                        <p className="font-bold text-gray-900 text-xs leading-snug line-clamp-1">{note.title}</p>
                        {note.description && (
                          <p className="text-[11px] text-gray-400 line-clamp-1">{note.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-gray-800 text-xs block">{note.course_title}</span>
                        <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-medium inline-block">
                          {note.module_title ? `Module: ${note.module_title}` : 'General Course Note'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      {note.file_url ? (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getFileTypeBadge(note.file_type)}`}>
                            {note.file_type || 'FILE'}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium">{formatBytes(note.file_size)}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">Text only</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleToggleStatus(note)}
                        className={`px-2.5 py-1 font-bold rounded-full border text-[10px] inline-flex items-center gap-1.5 transition-all ${
                          note.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                        title="Click to toggle status"
                      >
                        {note.status === 'published' ? '🟢 Published' : '🟡 Draft'}
                      </button>
                    </td>
                    <td className="p-3.5 text-[11px] text-gray-400 whitespace-nowrap">
                      {new Date(note.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setPreviewNote(note)}
                        className="p-1.5 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 text-indigo-600 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        title="Preview note"
                        aria-label={`Preview note ${note.title}`}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => openEditModal(note)}
                        className="p-1.5 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 text-blue-600 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        title="Edit note"
                        aria-label={`Edit note ${note.title}`}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(note)}
                        className="p-1.5 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 text-rose-500 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        title="Delete note"
                        aria-label={`Delete note ${note.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CREATE / EDIT NOTE MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-form-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                  <FileText size={18} />
                </div>
                <h3 id="note-form-modal-title" className="font-extrabold text-gray-900 text-base">
                  {editingNote ? 'Edit Study Note' : 'Create New Study Note'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={15} className="flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label htmlFor="note-form-title" className="block text-xs font-bold text-gray-700 mb-1.5">Note Title *</label>
                <input
                  id="note-form-title"
                  type="text"
                  required
                  placeholder="e.g., Complete JavaScript DOM Manipulation Cheat Sheet"
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="input py-2.5 text-xs"
                />
              </div>

              {/* Course & Module Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="note-form-course" className="block text-xs font-bold text-gray-700 mb-1.5">Course *</label>
                  <select
                    id="note-form-course"
                    value={form.course_id}
                    onChange={handleCourseChange}
                    required
                    className="input py-2.5 text-xs bg-white"
                  >
                    <option value="">Select Course</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="note-form-module" className="block text-xs font-bold text-gray-700 mb-1.5">Module (Optional)</label>
                  <select
                    id="note-form-module"
                    value={form.module_id}
                    onChange={e => setForm(p => ({ ...p, module_id: e.target.value }))}
                    disabled={loadingModules || selectedCourseModules.length === 0}
                    className="input py-2.5 text-xs bg-white disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">Entire Course (No specific module)</option>
                    {selectedCourseModules.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label htmlFor="note-form-description" className="block text-xs font-bold text-gray-700 mb-1.5">Description (Optional)</label>
                <input
                  id="note-form-description"
                  type="text"
                  placeholder="Brief summary of key concepts covered in this note"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="input py-2 text-xs"
                />
              </div>

              {/* Content Area */}
              <div>
                <label htmlFor="note-form-content" className="block text-xs font-bold text-gray-700 mb-1.5">Note Content / Detailed Text</label>
                <textarea
                  id="note-form-content"
                  rows={5}
                  placeholder="Type or paste lecture notes, code snippets, reference guidelines, etc..."
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  className="input py-2 text-xs font-mono"
                />
              </div>

              {/* File Attachment Dropzone */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Attach Document / File <span className="text-gray-400 font-normal">(PDF, DOCX, PPTX, TXT, Images — Max 25MB)</span>
                </label>

                {/* Existing file display in edit mode */}
                {editingNote?.file_url && !removeExistingFile && !selectedFile && (
                  <div className="flex items-center justify-between p-3 border border-indigo-100 bg-indigo-50/50 rounded-xl mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getFileTypeBadge(editingNote.file_type)}`}>
                        {editingNote.file_type || 'FILE'}
                      </span>
                      <span className="text-xs font-medium text-gray-800 truncate max-w-xs">{editingNote.file_name || 'Attached File'}</span>
                      <span className="text-[10px] text-gray-400">({formatBytes(editingNote.file_size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemoveExistingFile(true)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1"
                    >
                      Remove File
                    </button>
                  </div>
                )}

                {/* Selected File (New) */}
                {selectedFile ? (
                  <div className="flex items-center justify-between p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <File className="text-emerald-600" size={18} />
                      <div>
                        <p className="text-xs font-bold text-emerald-900 truncate max-w-xs">{selectedFile.name}</p>
                        <p className="text-[10px] text-emerald-600">{formatBytes(selectedFile.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1"
                    >
                      Change File
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-indigo-500 bg-indigo-50/50'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-gray-700">Click to browse or drag & drop note file</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Supports PDF, DOCX, PPTX, TXT, Images up to 25MB</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileInput}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
                    />
                  </div>
                )}
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-800">Publish Immediately</p>
                  <p className="text-[10px] text-gray-400">Published notes are visible to enrolled students.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, status: p.status === 'published' ? 'draft' : 'published' }))}
                  className={`text-2xl transition-colors ${form.status === 'published' ? 'text-emerald-600' : 'text-gray-300'}`}
                >
                  {form.status === 'published' ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary text-xs py-2.5 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs py-2.5 px-5 flex items-center gap-2"
                >
                  {saving ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving Note...</>
                  ) : (
                    editingNote ? 'Save Changes' : 'Create Note'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PREVIEW NOTE MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {previewNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-preview-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                  previewNote.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {previewNote.status === 'published' ? '🟢 Published' : '🟡 Draft'}
                </span>
                <span className="text-xs text-gray-400">• {previewNote.course_title}</span>
              </div>
              <button
                onClick={() => setPreviewNote(null)}
                aria-label="Close dialog"
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-left">
              <div>
                <h2 id="note-preview-modal-title" className="text-xl font-extrabold text-gray-900">{previewNote.title}</h2>
                {previewNote.module_title && (
                  <p className="text-xs text-indigo-600 font-semibold mt-1">Module: {previewNote.module_title}</p>
                )}
                {previewNote.description && (
                  <p className="text-sm text-gray-600 mt-2">{previewNote.description}</p>
                )}
              </div>

              {/* File Download Banner if file is attached */}
              {previewNote.file_url && (
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/60 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-sm border ${getFileTypeBadge(previewNote.file_type)}`}>
                      {previewNote.file_type || 'FILE'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 truncate max-w-xs">{previewNote.file_name || 'Downloadable Note'}</p>
                      <p className="text-[11px] text-gray-400">{formatBytes(previewNote.file_size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadFile(previewNote)}
                    disabled={downloadingNoteId === previewNote.id}
                    className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                  >
                    {downloadingNoteId === previewNote.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    Download File
                  </button>
                </div>
              )}

              {/* Content Preview */}
              {previewNote.content && (
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Note Content</p>
                  <div className="p-4 bg-gray-50 rounded-xl text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed border border-gray-100">
                    {previewNote.content}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center px-6 py-3.5 bg-gray-50 border-t border-gray-100 text-xs">
              <span className="text-gray-400">Created: {new Date(previewNote.created_at).toLocaleString()}</span>
              <button
                onClick={() => { setPreviewNote(null); openEditModal(previewNote); }}
                className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1"
              >
                <Edit size={13} /> Edit Note
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Note Confirmation Modal */}
      {deleteNoteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-note-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 id="delete-note-modal-title" className="text-base font-bold text-gray-900">
                  Delete Note Confirmation
                </h3>
                <p className="text-xs text-gray-500 truncate max-w-xs">
                  Note: <span className="font-semibold text-gray-700">{deleteNoteModal.title}</span>
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-600 space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p>
                Are you sure you want to permanently delete note <strong>"{deleteNoteModal.title}"</strong>?
              </p>
              {deleteNoteModal.file_name && (
                <p className="text-gray-500">
                  Attached file: <span className="font-mono text-gray-700">{deleteNoteModal.file_name}</span> ({formatBytes(deleteNoteModal.file_size)})
                </p>
              )}
              <p className="text-rose-600 font-semibold">
                ⚠️ This action is permanent and cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteNoteModal(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteNote}
                disabled={deleteSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {deleteSubmitting && <RefreshCw size={13} className="animate-spin" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerNotes;
