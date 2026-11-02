import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Users,
  Clock,
  Trash2,
  Edit3,
  Plus,
  Search,
  X,
  Shield,
  FileText,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  LayoutGrid,
  List,
  Layers,
  Filter,
  AlertTriangle,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import Toast from '../components/Toast';
import useEscapeKey from '../hooks/useEscapeKey';
import { getOwnerDifficultyBadge as getDifficultyBadge } from '../utils/formatters';

const FALLBACK_THUMBNAIL = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];
const COMMON_CATEGORIES = [
  'Web Development',
  'Programming',
  'Data Science',
  'Database & Cloud',
  'DevOps',
  'Cybersecurity'
];

const OwnerCourses = () => {
  const { api } = useAuth();

  // Data states
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'published' | 'draft'
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'title' | 'enrolled' | 'modules'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null); // null = create, object = edit
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Course Form State
  const [form, setForm] = useState({
    title: '',
    category: 'Web Development',
    difficulty: 'Beginner',
    duration: '10 hours',
    instructor: 'CodeNest Team',
    thumbnail: '',
    description: '',
    status: 'draft'
  });

  // Action Confirmation Modals
  const [statusModalCourse, setStatusModalCourse] = useState(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [deleteModalCourse, setDeleteModalCourse] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Handle Escape key to close modals
  useEscapeKey(() => {
    if (isFormModalOpen && !formSubmitting) setIsFormModalOpen(false);
    if (statusModalCourse && !statusSubmitting) setStatusModalCourse(null);
    if (deleteModalCourse && !deleteSubmitting) setDeleteModalCourse(null);
  }, Boolean(isFormModalOpen || statusModalCourse || deleteModalCourse));

  // Fetch Courses from Backend
  const fetchCourses = async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data } = await api.get('/owner/courses');
      if (data.success && Array.isArray(data.courses)) {
        setCourses(data.courses);
      } else {
        throw new Error(data.message || 'Failed to load courses.');
      }
    } catch (err) {
      console.error('Fetch Owner Courses Error:', err);
      const msg = err.response?.data?.message || err.message || 'Unable to connect to course service.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Compute Metrics
  const metrics = useMemo(() => {
    const total = courses.length;
    const published = courses.filter(c => c.status === 'published').length;
    const drafts = courses.filter(c => c.status === 'draft').length;
    const totalModules = courses.reduce((acc, c) => acc + (Number(c.total_modules) || 0), 0);
    const totalEnrolled = courses.reduce((acc, c) => acc + (Number(c.total_enrolled) || 0), 0);

    return { total, published, drafts, totalModules, totalEnrolled };
  }, [courses]);

  // Extract unique categories
  const categoriesList = useMemo(() => {
    const set = new Set(COMMON_CATEGORIES);
    courses.forEach(c => {
      if (c.category && c.category.trim()) set.add(c.category.trim());
    });
    return Array.from(set);
  }, [courses]);

  // Filtered & Sorted Courses
  const filteredCourses = useMemo(() => {
    return courses
      .filter(course => {
        // Status filter
        if (statusFilter !== 'all' && course.status !== statusFilter) return false;

        // Difficulty filter
        if (difficultyFilter !== 'all' && course.difficulty !== difficultyFilter) return false;

        // Category filter
        if (categoryFilter !== 'all' && course.category !== categoryFilter) return false;

        // Search term
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const matchTitle = (course.title || '').toLowerCase().includes(q);
          const matchCategory = (course.category || '').toLowerCase().includes(q);
          const matchInstructor = (course.instructor || '').toLowerCase().includes(q);
          const matchDesc = (course.description || '').toLowerCase().includes(q);
          if (!matchTitle && !matchCategory && !matchInstructor && !matchDesc) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return (b.id || 0) - (a.id || 0);
        if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
        if (sortBy === 'enrolled') return (Number(b.total_enrolled) || 0) - (Number(a.total_enrolled) || 0);
        if (sortBy === 'modules') return (Number(b.total_modules) || 0) - (Number(a.total_modules) || 0);
        return 0;
      });
  }, [courses, statusFilter, difficultyFilter, categoryFilter, search, sortBy]);

  // Open Create Form Modal
  const handleOpenCreateModal = () => {
    setEditingCourse(null);
    setForm({
      title: '',
      category: 'Web Development',
      difficulty: 'Beginner',
      duration: '10 hours',
      instructor: 'CodeNest Team',
      thumbnail: '',
      description: '',
      status: 'draft' // default new course to draft
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Open Edit Form Modal
  const handleOpenEditModal = (course) => {
    setEditingCourse(course);
    setForm({
      title: course.title || '',
      category: course.category || 'Web Development',
      difficulty: course.difficulty || 'Beginner',
      duration: course.duration || '10 hours',
      instructor: course.instructor || 'CodeNest Team',
      thumbnail: course.thumbnail || '',
      description: course.description || '',
      status: course.status || 'draft'
    });
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Save Course (Create or Update)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.title.trim()) {
      setFormError('Course title is required.');
      return;
    }
    if (form.title.trim().length > 200) {
      setFormError('Course title must not exceed 200 characters.');
      return;
    }

    setFormSubmitting(true);

    try {
      const payload = {
        title: form.title.trim(),
        category: form.category.trim() || 'General',
        difficulty: form.difficulty,
        duration: form.duration.trim() || 'Self-paced',
        instructor: form.instructor.trim() || 'CodeNest Team',
        thumbnail: form.thumbnail.trim() || FALLBACK_THUMBNAIL,
        description: form.description.trim() || '',
        status: form.status
      };

      if (editingCourse) {
        // Update Course
        const { data } = await api.put(`/owner/courses/${editingCourse.id}`, payload);
        if (data.success) {
          setToast({ type: 'success', message: `Course "${payload.title}" updated successfully.` });
          setIsFormModalOpen(false);
          fetchCourses(true);
        } else {
          setFormError(data.message || 'Failed to update course.');
        }
      } else {
        // Create Course
        const { data } = await api.post('/owner/courses', payload);
        if (data.success) {
          setToast({ type: 'success', message: `Course "${payload.title}" created successfully as ${payload.status}.` });
          setIsFormModalOpen(false);
          fetchCourses(true);
        } else {
          setFormError(data.message || 'Failed to create course.');
        }
      }
    } catch (err) {
      console.error('Course Form Submit Error:', err);
      const msg = err.response?.data?.message || err.message || 'An error occurred while saving the course.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Status Action
  const handleToggleStatusClick = (course) => {
    setStatusModalCourse(course);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusModalCourse) return;
    setStatusSubmitting(true);
    const newStatus = statusModalCourse.status === 'published' ? 'draft' : 'published';

    try {
      const { data } = await api.patch(`/owner/courses/${statusModalCourse.id}/status`, {
        status: newStatus
      });

      if (data.success) {
        setToast({
          type: 'success',
          message: `Course status changed to ${newStatus.toUpperCase()}.`
        });
        setStatusModalCourse(null);
        fetchCourses(true);
      } else {
        setToast({ type: 'error', message: data.message || 'Failed to update status.' });
      }
    } catch (err) {
      console.error('Status Update Error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to update status.';
      setToast({ type: 'error', message: msg });
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Delete Course Action
  const handleDeleteClick = (course) => {
    setDeleteModalCourse(course);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalCourse) return;
    setDeleteSubmitting(true);
    setDeleteError('');

    try {
      const { data } = await api.delete(`/owner/courses/${deleteModalCourse.id}`);
      if (data.success) {
        setToast({
          type: 'success',
          message: `Course "${deleteModalCourse.title}" deleted successfully.`
        });
        setDeleteModalCourse(null);
        fetchCourses(true);
      } else {
        setDeleteError(data.message || 'Failed to delete course.');
      }
    } catch (err) {
      console.error('Delete Course Error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to delete course.';
      setDeleteError(msg);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-left page-enter">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white overflow-hidden shadow-lg shadow-indigo-500/10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
              <BookOpen className="text-white" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Course Management</h1>
                <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-indigo-100/80 text-sm mt-0.5">
                Create, curate, publish, and monitor courses across CodeNest
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleOpenCreateModal}
              title="Add New Course"
              className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <Plus size={16} />
              Add New Course
            </button>
            <button
              onClick={() => fetchCourses(true)}
              disabled={refreshing}
              title="Refresh course data"
              className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl border border-white/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <Link
              to="/owner-dashboard"
              className="glass px-3.5 py-2.5 text-xs font-bold text-white hover:bg-white/20 flex items-center gap-1.5 transition-all"
            >
              <Shield size={14} />
              Dashboard
            </Link>
            <Link
              to="/owner-notes"
              className="glass px-3.5 py-2.5 text-xs font-bold text-white hover:bg-white/20 flex items-center gap-1.5 transition-all"
            >
              <FileText size={14} />
              Notes
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Courses', value: metrics.total, icon: <Layers size={18} className="text-indigo-600" />, accent: 'border-l-indigo-500', bg: 'from-indigo-50 to-indigo-100/40' },
          { label: 'Published Courses', value: metrics.published, icon: <CheckCircle2 size={18} className="text-emerald-600" />, accent: 'border-l-emerald-500', bg: 'from-emerald-50 to-emerald-100/40' },
          { label: 'Draft Courses', value: metrics.drafts, icon: <Clock size={18} className="text-amber-600" />, accent: 'border-l-amber-500', bg: 'from-amber-50 to-amber-100/40' },
          { label: 'Total Modules', value: metrics.totalModules, icon: <BookOpen size={18} className="text-blue-600" />, accent: 'border-l-blue-500', bg: 'from-blue-50 to-blue-100/40' },
          { label: 'Enrolled Students', value: metrics.totalEnrolled, icon: <Users size={18} className="text-purple-600" />, accent: 'border-l-purple-500', bg: 'from-purple-50 to-purple-100/40' },
        ].map((card) => (
          <div key={card.label} className={`card-static p-4 border-l-4 ${card.accent} bg-gradient-to-r ${card.bg} flex items-center gap-3`}>
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-xs flex-shrink-0">
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-gray-900 leading-tight">{card.value}</p>
              <p className="text-[11px] text-gray-500 font-medium truncate">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls Bar: Search, Status Tabs, Dropdowns & View Mode */}
      <div className="card-static p-4 sm:p-5 space-y-4">
        {/* Top Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl overflow-x-auto self-start">
            {[
              { id: 'all', label: 'All Courses', count: metrics.total },
              { id: 'published', label: 'Published', count: metrics.published },
              { id: 'draft', label: 'Drafts', count: metrics.drafts }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === tab.id
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'bg-gray-200/70 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Right Controls: Sort & View Mode */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="title">Title (A-Z)</option>
                <option value="enrolled">Most Enrolled</option>
                <option value="modules">Most Modules</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50 p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
                title="Grid View"
                aria-label="Grid View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-colors ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
                title="Table View"
                aria-label="Table View"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Dropdowns Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-1">
          {/* Search Box */}
          <div className="lg:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              id="owner-course-search"
              type="text"
              placeholder="Search courses by title, category, instructor, or description..."
              aria-label="Search courses by title, category, instructor, or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Difficulty Dropdown */}
          <div className="lg:col-span-3">
            <select
              id="owner-difficulty-filter"
              aria-label="Filter by difficulty"
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-gray-700"
            >
              <option value="all">All Difficulties</option>
              {DIFFICULTIES.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="lg:col-span-3">
            <select
              id="owner-category-filter"
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer text-gray-700"
            >
              <option value="all">All Categories</option>
              {categoriesList.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Clear Badge */}
        {(search || statusFilter !== 'all' || difficultyFilter !== 'all' || categoryFilter !== 'all') && (
          <div className="flex items-center gap-2 pt-1 text-xs text-gray-500">
            <span>Showing {filteredCourses.length} of {courses.length} courses</span>
            <span>·</span>
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setDifficultyFilter('all');
                setCategoryFilter('all');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold underline text-xs"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-gray-100 p-12">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Loading Course Management System...</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-left space-y-3">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
            <AlertCircle size={18} />
            Failed to Load Courses
          </div>
          <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
          <button
            onClick={() => fetchCourses()}
            className="btn-secondary text-xs py-1.5 px-4 inline-flex items-center gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw size={13} />
            Try Again
          </button>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="card-static p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen size={28} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-gray-900">No Courses Found</h3>
            <p className="text-xs text-gray-500">
              {search || statusFilter !== 'all' || difficultyFilter !== 'all' || categoryFilter !== 'all'
                ? 'No courses matched your current filter criteria. Try clearing some filters.'
                : 'There are no courses created yet in CodeNest. Get started by adding your first course.'}
            </p>
          </div>
          {search || statusFilter !== 'all' || difficultyFilter !== 'all' || categoryFilter !== 'all' ? (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setDifficultyFilter('all');
                setCategoryFilter('all');
              }}
              className="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={handleOpenCreateModal}
              className="btn-primary text-xs py-2 px-5 inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              Add First Course
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="card overflow-hidden flex flex-col justify-between group hover:border-indigo-200 transition-all duration-300"
            >
              <div>
                {/* Course Thumbnail & Status Overlays */}
                <div className="relative h-44 bg-gray-100 overflow-hidden">
                  <img
                    src={course.thumbnail || FALLBACK_THUMBNAIL}
                    alt={course.title}
                    onError={(e) => { e.target.src = FALLBACK_THUMBNAIL; }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

                  {/* Badges on Thumbnail */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border shadow-xs ${
                      course.status === 'published'
                        ? 'bg-emerald-500 text-white border-emerald-400'
                        : 'bg-amber-500 text-white border-amber-400'
                    }`}>
                      {course.status}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-xs bg-white/90 backdrop-blur text-gray-800`}>
                      {course.difficulty}
                    </span>
                  </div>

                  {/* Category Pill */}
                  <div className="absolute bottom-3 left-3">
                    <span className="text-[11px] font-semibold text-white/90 bg-black/40 backdrop-blur px-2.5 py-0.5 rounded-md">
                      {course.category}
                    </span>
                  </div>

                  {/* Public Link Shortcut */}
                  <Link
                    to={`/courses/${course.id}`}
                    target="_blank"
                    rel="noreferrer"
                    title="View Public Course Page"
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-gray-700 flex items-center justify-center backdrop-blur shadow-md transition-all active:scale-95"
                  >
                    <ExternalLink size={13} />
                  </Link>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {course.title}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      by {course.instructor || 'CodeNest Team'}
                    </p>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {course.description || 'No description provided.'}
                  </p>

                  {/* Course Metrics Pills */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-[11px] text-gray-600">
                    <div className="flex items-center gap-1.5" title="Modules in course">
                      <BookOpen size={13} className="text-indigo-500 flex-shrink-0" />
                      <span>{course.total_modules || 0} mods</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Enrolled students">
                      <Users size={13} className="text-purple-500 flex-shrink-0" />
                      <span>{course.total_enrolled || 0} students</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Duration">
                      <Clock size={13} className="text-gray-400 flex-shrink-0" />
                      <span className="truncate">{course.duration || '10h'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-2">
                {/* Publish / Unpublish Toggle Action */}
                <button
                  onClick={() => handleToggleStatusClick(course)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                    course.status === 'published'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                  title={course.status === 'published' ? 'Switch to Draft' : 'Publish Course'}
                >
                  {course.status === 'published' ? (
                    <>
                      <ToggleRight size={14} className="text-amber-600" />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <ToggleLeft size={14} className="text-emerald-600" />
                      Publish
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5">
                  {/* Manage Modules Button */}
                  <Link
                    to={`/owner-courses/${course.id}/modules`}
                    className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-colors"
                    title="Manage Course Modules"
                  >
                    <BookOpen size={15} />
                  </Link>

                  {/* Edit Button */}
                  <button
                    onClick={() => handleOpenEditModal(course)}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Edit course metadata"
                  >
                    <Edit3 size={15} />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteClick(course)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title={Number(course.total_enrolled) > 0 ? "Deletion guarded (active enrollments)" : "Delete course"}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card-static overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">Course</th>
                  <th className="py-3.5 px-3">Category</th>
                  <th className="py-3.5 px-3">Difficulty</th>
                  <th className="py-3.5 px-3 text-center">Modules</th>
                  <th className="py-3.5 px-3 text-center">Enrolled</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCourses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Course Identity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={course.thumbnail || FALLBACK_THUMBNAIL}
                          alt={course.title}
                          onError={(e) => { e.target.src = FALLBACK_THUMBNAIL; }}
                          className="w-12 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate max-w-xs sm:max-w-sm">
                            {course.title}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            by {course.instructor || 'CodeNest Team'} · {course.duration || '10h'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-3 text-gray-700 whitespace-nowrap">
                      {course.category}
                    </td>

                    {/* Difficulty */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getDifficultyBadge(course.difficulty)}`}>
                        {course.difficulty}
                      </span>
                    </td>

                    {/* Module Count */}
                    <td className="py-3.5 px-3 text-center font-semibold text-gray-700 whitespace-nowrap">
                      {course.total_modules || 0}
                    </td>

                    {/* Enrolled Count */}
                    <td className="py-3.5 px-3 text-center font-semibold text-gray-700 whitespace-nowrap">
                      {course.total_enrolled || 0}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        course.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {course.status}
                      </span>
                    </td>

                    {/* Row Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Toggle Status Button */}
                        <button
                          onClick={() => handleToggleStatusClick(course)}
                          className={`p-1.5 rounded-lg text-xs font-semibold border ${
                            course.status === 'published'
                              ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title={course.status === 'published' ? 'Switch to Draft' : 'Publish Course'}
                        >
                          {course.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>

                        {/* Manage Modules Button */}
                        <Link
                          to={`/owner-courses/${course.id}/modules`}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="Manage Modules"
                          aria-label={`Manage modules for ${course.title}`}
                        >
                          <BookOpen size={15} />
                        </Link>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(course)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="Edit Course"
                          aria-label={`Edit course ${course.title}`}
                        >
                          <Edit3 size={15} />
                        </button>

                        {/* View Public Button */}
                        <Link
                          to={`/courses/${course.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                          title="View Public Page"
                          aria-label={`View public page for ${course.title}`}
                        >
                          <ExternalLink size={15} />
                        </Link>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteClick(course)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete Course"
                          aria-label={`Delete course ${course.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT COURSE MODAL */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-form-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-gray-100 my-8 text-left">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  {editingCourse ? <Edit3 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h2 id="course-form-modal-title" className="text-lg font-bold text-gray-900">
                    {editingCourse ? 'Edit Course Details' : 'Create New Course'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {editingCourse ? `Updating course ID #${editingCourse.id}` : 'Fill in the course properties below'}
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

            {/* Course Form */}
            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* Title Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="course-form-title" className="font-semibold text-gray-800">
                    Course Title <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400">{form.title.length}/200</span>
                </div>
                <input
                  id="course-form-title"
                  type="text"
                  required
                  maxLength={200}
                  placeholder="e.g., Master Full-Stack Web Development in 2026"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              {/* Category & Difficulty Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="course-form-category" className="font-semibold text-gray-800">Category</label>
                  <input
                    id="course-form-category"
                    type="text"
                    list="categories-datalist"
                    placeholder="e.g., Web Development"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                  <datalist id="categories-datalist">
                    {categoriesList.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label htmlFor="course-form-difficulty" className="font-semibold text-gray-800">Difficulty Level</label>
                  <select
                    id="course-form-difficulty"
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs cursor-pointer"
                  >
                    {DIFFICULTIES.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration & Instructor Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="course-form-duration" className="font-semibold text-gray-800">Duration</label>
                  <input
                    id="course-form-duration"
                    type="text"
                    maxLength={50}
                    placeholder="e.g., 12 hours, 6 weeks"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="course-form-instructor" className="font-semibold text-gray-800">Instructor Name</label>
                  <input
                    id="course-form-instructor"
                    type="text"
                    maxLength={100}
                    placeholder="e.g., CodeNest Team, John Doe"
                    value={form.instructor}
                    onChange={(e) => setForm({ ...form, instructor: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
              </div>

              {/* Thumbnail URL with Live Preview */}
              <div className="space-y-1.5">
                <label htmlFor="course-form-thumbnail" className="font-semibold text-gray-800">Thumbnail Image URL</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-14 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                    <img
                      src={form.thumbnail || FALLBACK_THUMBNAIL}
                      alt="Thumbnail Preview"
                      onError={(e) => { e.target.src = FALLBACK_THUMBNAIL; }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    id="course-form-thumbnail"
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={form.thumbnail}
                    onChange={(e) => setForm({ ...form, thumbnail: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>
                <p className="text-[10px] text-gray-400">Leave blank to use the default high-resolution CodeNest cover image.</p>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label htmlFor="course-form-description" className="font-semibold text-gray-800">Course Description</label>
                <textarea
                  id="course-form-description"
                  rows={4}
                  placeholder="Provide a thorough summary of syllabus, learning outcomes, and prerequisites..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs leading-relaxed"
                />
              </div>

              {/* Status Radio / Selector */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/70 space-y-2">
                <label className="font-semibold text-gray-800 block">Initial Status</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="course_status"
                      value="draft"
                      checked={form.status === 'draft'}
                      onChange={() => setForm({ ...form, status: 'draft' })}
                      className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-medium text-gray-800">Draft (Hidden from students)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="course_status"
                      value="published"
                      checked={form.status === 'published'}
                      onChange={() => setForm({ ...form, status: 'published' })}
                      className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="font-medium text-gray-800">Published (Public in catalog)</span>
                  </label>
                </div>
              </div>

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
                  <span>{editingCourse ? 'Save Changes' : 'Create Course'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRM STATUS CHANGE MODAL */}
      {/* ========================================================================= */}
      {statusModalCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100 text-left">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                statusModalCourse.status === 'published'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}>
                {statusModalCourse.status === 'published' ? <ToggleRight size={22} /> : <CheckCircle2 size={22} />}
              </div>
              <div>
                <h3 id="status-modal-title" className="text-base font-bold text-gray-900">
                  {statusModalCourse.status === 'published' ? 'Unpublish Course?' : 'Publish Course?'}
                </h3>
                <p className="text-xs text-gray-500">
                  Course: <span className="font-semibold text-gray-700">{statusModalCourse.title}</span>
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-600 space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
              {statusModalCourse.status === 'published' ? (
                <>
                  <p>
                    Switching this course to <strong>Draft</strong> will hide it from the public course catalog and block new student enrollments.
                  </p>
                  <p className="text-emerald-700 font-medium">
                    ✓ Existing enrolled students ({statusModalCourse.total_enrolled || 0}) will still be able to continue their learning and view lessons.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Switching this course to <strong>Published</strong> will make it immediately visible to all students in the public course directory.
                  </p>
                  <p className="text-indigo-700 font-medium">
                    ✓ Students will be able to discover and enroll in this course right away.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusModalCourse(null)}
                disabled={statusSubmitting}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={statusSubmitting}
                className={`text-xs font-bold px-4 py-2 rounded-xl text-white flex items-center gap-1.5 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  statusModalCourse.status === 'published'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                }`}
              >
                {statusSubmitting && <RefreshCw size={13} className="animate-spin" />}
                <span>
                  {statusModalCourse.status === 'published' ? 'Confirm Unpublish' : 'Confirm Publish'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteModalCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-course-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 id="delete-course-modal-title" className="text-base font-bold text-gray-900">
                  Delete Course Confirmation
                </h3>
                <p className="text-xs text-gray-500">
                  Course: <span className="font-semibold text-gray-700">{deleteModalCourse.title}</span>
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                {deleteError}
              </div>
            )}

            {/* If Course Has Active Enrollments, Warn that backend strictly guards it */}
            {Number(deleteModalCourse.total_enrolled) > 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <AlertCircle size={16} />
                  Deletion Strictly Blocked
                </div>
                <p className="text-amber-800 leading-relaxed">
                  This course currently has <strong>{deleteModalCourse.total_enrolled} enrolled student(s)</strong>.
                  The backend security policy strictly prevents deleting courses with active enrollments to protect student certificates, progress, and learning history.
                </p>
                <p className="text-amber-700 font-medium">
                  Recommendation: Unpublish this course instead. This removes it from the public catalog while preserving existing student progress.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const c = deleteModalCourse;
                      setDeleteModalCourse(null);
                      handleToggleStatusClick(c);
                    }}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors"
                  >
                    Unpublish Course Instead
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-600 space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <p>
                  Are you sure you want to permanently delete <strong>"{deleteModalCourse.title}"</strong>?
                </p>
                <p className="text-rose-600 font-semibold">
                  ⚠️ This action is permanent and cannot be undone. All modules ({deleteModalCourse.total_modules || 0}) will be removed.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalCourse(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              {Number(deleteModalCourse.total_enrolled) === 0 && (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteSubmitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {deleteSubmitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>Delete Permanently</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerCourses;
