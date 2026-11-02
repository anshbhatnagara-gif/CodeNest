import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Users,
  Plus,
  Trash2,
  Edit3,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Layers,
  X,
  ExternalLink,
  Shield,
  HelpCircle
} from 'lucide-react';
import Toast from '../components/Toast';
import useEscapeKey from '../hooks/useEscapeKey';

const OwnerModules = () => {
  const { courseId } = useParams();
  const { api } = useAuth();

  // Data states
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null); // null = create, object = edit
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form State
  const [form, setForm] = useState({
    title: '',
    duration: '15 min'
  });

  // Delete Confirmation Modal State
  const [deleteModalModule, setDeleteModalModule] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Handle Escape key to close modals
  useEscapeKey(() => {
    if (isFormModalOpen && !formSubmitting) setIsFormModalOpen(false);
    if (deleteModalModule && !deleteSubmitting) setDeleteModalModule(null);
  }, Boolean(isFormModalOpen || deleteModalModule));

  // Fetch Course & Modules
  const fetchCourseModules = async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data } = await api.get(`/owner/courses/${courseId}/modules`);
      if (data.success) {
        setCourse(data.course);
        // Ensure sorted by order_index
        const sorted = (data.modules || []).slice().sort((a, b) => a.order_index - b.order_index);
        setModules(sorted);
      } else {
        throw new Error(data.message || 'Failed to load course modules.');
      }
    } catch (err) {
      console.error('Fetch Course Modules Error:', err);
      const msg = err.response?.data?.message || err.message || 'Unable to connect to module service.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchCourseModules();
    }
  }, [courseId]);

  // Total completions across all modules
  const totalCompletions = useMemo(() => {
    return modules.reduce((acc, m) => acc + (Number(m.completed_count) || 0), 0);
  }, [modules]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingModule(null);
    setForm({
      title: '',
      duration: '15 min'
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (mod) => {
    setEditingModule(mod);
    setForm({
      title: mod.title || '',
      duration: mod.duration || '15 min'
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Submit Create or Edit Module
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.title.trim()) {
      setFormError('Module title is required.');
      return;
    }
    if (form.title.trim().length > 200) {
      setFormError('Module title must not exceed 200 characters.');
      return;
    }
    if (form.duration && form.duration.trim().length > 50) {
      setFormError('Duration must not exceed 50 characters.');
      return;
    }

    setFormSubmitting(true);

    try {
      const payload = {
        title: form.title.trim(),
        duration: form.duration.trim() || '15 min'
      };

      if (editingModule) {
        // Edit module
        const { data } = await api.put(`/owner/modules/${editingModule.id}`, payload);
        if (data.success) {
          setToast({ type: 'success', message: `Module "${payload.title}" updated successfully.` });
          setIsFormModalOpen(false);
          fetchCourseModules(true);
        } else {
          setFormError(data.message || 'Failed to update module.');
        }
      } else {
        // Create module
        const { data } = await api.post(`/owner/courses/${courseId}/modules`, payload);
        if (data.success) {
          setToast({ type: 'success', message: `Module "${payload.title}" created successfully at position #${data.module?.order_index || modules.length + 1}.` });
          setIsFormModalOpen(false);
          fetchCourseModules(true);
        } else {
          setFormError(data.message || 'Failed to create module.');
        }
      }
    } catch (err) {
      console.error('Module Form Submit Error:', err);
      const msg = err.response?.data?.message || err.message || 'An error occurred while saving the module.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Reorder: Move Up / Down
  const handleMoveModule = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    // Create optimistic reordered copy
    const reordered = modules.slice();
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Reassign order_index 1..N for optimistic display
    const updatedWithIndices = reordered.map((m, idx) => ({
      ...m,
      order_index: idx + 1
    }));

    const previousModules = modules;
    setModules(updatedWithIndices);
    setReordering(true);

    try {
      const payload = {
        module_ids: updatedWithIndices.map(m => m.id)
      };

      const { data } = await api.put(`/owner/courses/${courseId}/modules/reorder`, payload);
      if (data.success) {
        setToast({ type: 'success', message: 'Module sequence updated successfully.' });
        if (Array.isArray(data.modules)) {
          setModules(data.modules);
        }
      } else {
        throw new Error(data.message || 'Failed to update module sequence.');
      }
    } catch (err) {
      console.error('Reorder Modules Error:', err);
      const msg = err.response?.data?.message || err.message || 'Reorder failed. Original order restored.';
      setToast({ type: 'error', message: msg });
      // Rollback to previous order
      setModules(previousModules);
    } finally {
      setReordering(false);
    }
  };

  // Open Delete Confirmation Modal
  const handleDeleteClick = (mod) => {
    setDeleteModalModule(mod);
    setDeleteError('');
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteModalModule) return;
    setDeleteSubmitting(true);
    setDeleteError('');

    try {
      const { data } = await api.delete(`/owner/modules/${deleteModalModule.id}`);
      if (data.success) {
        setToast({
          type: 'success',
          message: `Module "${deleteModalModule.title}" deleted and remaining sequence compacted.`
        });
        setDeleteModalModule(null);
        fetchCourseModules(true);
      } else {
        setDeleteError(data.message || 'Failed to delete module.');
      }
    } catch (err) {
      console.error('Delete Module Error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to delete module.';
      setDeleteError(msg);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-left page-enter">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Top Navigation Bar: Back Button */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/owner-courses"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Courses</span>
        </Link>

        {course && (
          <Link
            to={`/courses/${course.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors font-medium"
          >
            <ExternalLink size={14} />
            <span>View Public Course</span>
          </Link>
        )}
      </div>

      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white overflow-hidden shadow-lg shadow-indigo-500/10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
              <Layers className="text-white" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                  {course ? course.title : `Course #${courseId} Modules`}
                </h1>
                {course?.status && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border shadow-xs ${
                    course.status === 'published'
                      ? 'bg-emerald-500 text-white border-emerald-400'
                      : 'bg-amber-500 text-white border-amber-400'
                  }`}>
                    {course.status}
                  </span>
                )}
              </div>
              <p className="text-indigo-100/80 text-sm mt-0.5">
                Manage curriculum modules, lesson sequence, and monitor student progress
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleOpenCreateModal}
              title="Add New Module"
              className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <Plus size={16} />
              Add Module
            </button>
            <button
              onClick={() => fetchCourseModules(true)}
              disabled={refreshing || reordering}
              title="Refresh modules"
              className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl border border-white/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing || reordering ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card-static p-4 border-l-4 border-l-indigo-500 bg-gradient-to-r from-indigo-50 to-indigo-100/40 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-xs flex-shrink-0">
            <BookOpen size={20} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-gray-900 leading-tight">{modules.length}</p>
            <p className="text-[11px] text-gray-500 font-medium">Curriculum Modules</p>
          </div>
        </div>

        <div className="card-static p-4 border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50 to-purple-100/40 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-xs flex-shrink-0">
            <Users size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-gray-900 leading-tight">{totalCompletions}</p>
            <p className="text-[11px] text-gray-500 font-medium">Total Lesson Completions</p>
          </div>
        </div>

        <div className="card-static p-4 border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-emerald-100/40 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-xs flex-shrink-0">
            <Shield size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-gray-900 leading-tight">100%</p>
            <p className="text-[11px] text-gray-500 font-medium">Progress Protected</p>
          </div>
        </div>
      </div>

      {/* Reordering Banner / Helper */}
      {modules.length > 1 && (
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between gap-4 text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <HelpCircle size={15} className="text-indigo-600 flex-shrink-0" />
            <span>
              Use the <strong>Move Up</strong> and <strong>Move Down</strong> buttons to rearrange module sequence. Changes are saved automatically with atomic constraint protection.
            </span>
          </div>
          {reordering && (
            <span className="inline-flex items-center gap-1.5 font-bold text-indigo-600 whitespace-nowrap">
              <RefreshCw size={13} className="animate-spin" />
              Saving sequence...
            </span>
          )}
        </div>
      )}

      {/* Main Modules List Area */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-gray-100 p-12">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Loading Course Curriculum Modules...</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-left space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertCircle size={18} />
            Failed to Load Modules
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
          <button
            onClick={() => fetchCourseModules()}
            className="btn-secondary text-xs py-1.5 px-4 inline-flex items-center gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw size={13} />
            Try Again
          </button>
        </div>
      ) : modules.length === 0 ? (
        <div className="card-static p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen size={28} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-gray-900">No Modules in this Course</h3>
            <p className="text-xs text-gray-500">
              This course does not have any curriculum modules yet. Add the first module to start structuring the syllabus.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="btn-primary text-xs py-2 px-5 inline-flex items-center gap-1.5"
          >
            <Plus size={14} />
            Add First Module
          </button>
        </div>
      ) : (
        /* MODULES LIST */
        <div className="space-y-3">
          {modules.map((mod, index) => {
            const hasProgress = Number(mod.completed_count) > 0;
            return (
              <div
                key={mod.id}
                className="card-static p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-200 transition-all duration-200 bg-white"
              >
                {/* Left: Sequence Badge + Title + Duration */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  {/* Sequence Position Badge */}
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 font-extrabold text-sm flex items-center justify-center border border-indigo-100 flex-shrink-0 shadow-xs">
                    #{mod.order_index}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-1">
                      {mod.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-gray-400" />
                        {mod.duration || '15 min'}
                      </span>
                      <span>·</span>
                      <span className={`inline-flex items-center gap-1 font-medium ${
                        hasProgress ? 'text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200' : 'text-gray-400'
                      }`}>
                        <Users size={12} />
                        {mod.completed_count || 0} student completions
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Reorder Controls & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                  {/* Move Up / Move Down Reordering Controls (minimum 44x44px touch targets) */}
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <button
                      onClick={() => handleMoveModule(index, 'up')}
                      disabled={index === 0 || reordering}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-indigo-600 hover:bg-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      title={index === 0 ? 'First module' : 'Move Up'}
                      aria-label={`Move module ${mod.title} up`}
                    >
                      <ChevronUp size={18} />
                    </button>
                    <div className="w-[1px] h-6 bg-gray-200" />
                    <button
                      onClick={() => handleMoveModule(index, 'down')}
                      disabled={index === modules.length - 1 || reordering}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-600 hover:text-indigo-600 hover:bg-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      title={index === modules.length - 1 ? 'Last module' : 'Move Down'}
                      aria-label={`Move module ${mod.title} down`}
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>

                  {/* Edit Module Button (minimum 44x44px touch target) */}
                  <button
                    onClick={() => handleOpenEditModal(mod)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    title="Edit module"
                    aria-label={`Edit module ${mod.title}`}
                  >
                    <Edit3 size={16} />
                  </button>

                  {/* Delete Module Button (minimum 44x44px touch target) */}
                  <button
                    onClick={() => handleDeleteClick(mod)}
                    className={`p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                      hasProgress
                        ? 'text-amber-600 border-amber-200 hover:bg-amber-50'
                        : 'text-gray-400 border-gray-200 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50'
                    }`}
                    title={hasProgress ? "Cannot delete: student progress exists" : "Delete module"}
                    aria-label={`Delete module ${mod.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT MODULE MODAL */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="module-form-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-6 shadow-2xl border border-gray-100 my-8 text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  {editingModule ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h2 id="module-form-modal-title" className="text-base font-bold text-gray-900">
                    {editingModule ? `Edit Module #${editingModule.order_index}` : 'Add New Module'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {editingModule ? `Updating module ID #${editingModule.id}` : `Module position will automatically be #${modules.length + 1}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                aria-label="Close dialog"
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Error Banner */}
            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* Title Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="module-form-title" className="font-semibold text-gray-800">
                    Module Title <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400">{form.title.length}/200</span>
                </div>
                <input
                  id="module-form-title"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="e.g., Introduction to React Components"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              {/* Duration Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="module-form-duration" className="font-semibold text-gray-800">Estimated Duration</label>
                  <span className="text-[10px] text-gray-400">{form.duration.length}/50</span>
                </div>
                <input
                  id="module-form-duration"
                  type="text"
                  maxLength={50}
                  placeholder="e.g., 15 min, 25 mins"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              {editingModule && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-indigo-800 text-[11px] leading-relaxed">
                  ✓ Preserves module ID #{editingModule.id} and sequence index #{editingModule.order_index}. Existing student completion records remain intact.
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="btn-primary text-xs py-2 px-5 flex items-center gap-2 disabled:opacity-50"
                >
                  {formSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>{editingModule ? 'Save Changes' : 'Create Module'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteModalModule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-module-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 id="delete-module-modal-title" className="text-base font-bold text-gray-900">
                  Delete Module Confirmation
                </h3>
                <p className="text-xs text-gray-500">
                  Module: <span className="font-semibold text-gray-700">{deleteModalModule.title}</span>
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                {deleteError}
              </div>
            )}

            {/* Guard against student progress loss */}
            {Number(deleteModalModule.completed_count) > 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertCircle size={16} />
                  Module Deletion Blocked
                </div>
                <p className="text-amber-800 leading-relaxed">
                  This module has <strong>{deleteModalModule.completed_count} recorded student completion(s)</strong>.
                  Deleting this module would destroy student learning records and progress history.
                </p>
                <p className="text-amber-700 font-medium">
                  To safeguard student progress, the system strictly forbids deleting modules with completed progress.
                </p>
              </div>
            ) : (
              <div className="text-xs text-gray-600 space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p>
                  Are you sure you want to permanently delete module <strong>"{deleteModalModule.title}"</strong>?
                </p>
                <p className="text-gray-500">
                  Remaining modules in this course will automatically have their sequence indices compacted (1..N).
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalModule(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              {Number(deleteModalModule.completed_count) === 0 && (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteSubmitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {deleteSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>Delete Module</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerModules;

