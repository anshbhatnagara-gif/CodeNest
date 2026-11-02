import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, BookOpen, Clock, Trash2, ShieldAlert, Calendar, 
  Activity, Zap, Search, Eye, X, FileText,
  AlertTriangle, RefreshCw
} from 'lucide-react';
import Toast from '../components/Toast';
import useEscapeKey from '../hooks/useEscapeKey';

const OwnerDashboard = () => {
  const { api } = useAuth();
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // In-app modal and toast feedback
  const [deleteModalStudent, setDeleteModalStudent] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Handle Escape key to close modal or student preview
  useEscapeKey(() => {
    if (deleteModalStudent && !deleteSubmitting) setDeleteModalStudent(null);
    if (selectedStudent) setSelectedStudent(null);
  }, Boolean(deleteModalStudent || selectedStudent));

  const fetchDashboardData = async () => {
    try {
      const resStats = await api.get('/owner/dashboard');
      if (resStats.data.success) {
        setStats(resStats.data.stats);
        setActivity(resStats.data.recent_activity);
      }

      const resStudents = await api.get('/owner/students');
      if (resStudents.data.success) {
        setStudents(resStudents.data.students);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleStudentView = async (id) => {
    setViewLoading(true);
    try {
      const { data } = await api.get(`/owner/students/${id}`);
      if (data.success) {
        setSelectedStudent(data.student);
      }
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: 'Error fetching student details.' });
    } finally {
      setViewLoading(false);
    }
  };

  const handleStudentDelete = (id, name) => {
    setDeleteModalStudent({ id, name });
  };

  const handleConfirmStudentDelete = async () => {
    if (!deleteModalStudent) return;
    setDeleteSubmitting(true);
    try {
      const { data } = await api.delete(`/owner/students/${deleteModalStudent.id}`);
      if (data.success) {
        setToast({ type: 'success', message: data.message || 'Student account deleted successfully.' });
        fetchDashboardData();
        if (selectedStudent?.id === deleteModalStudent.id) setSelectedStudent(null);
        setDeleteModalStudent(null);
      } else {
        setToast({ type: 'error', message: data.message || 'Delete failed.' });
      }
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: e.response?.data?.message || 'Delete failed.' });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                        s.email.toLowerCase().includes(search.toLowerCase()) ||
                        (s.phone && s.phone.includes(search));
    const matchStatus = filterStatus === 'All' || s.regularity === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 font-medium">Fetching Owner Metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 text-left page-enter">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header Banner */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center border border-white/20">
              <ShieldAlert className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold">Owner Dashboard</h1>
              <p className="text-indigo-200/80 text-sm mt-0.5">Private monitoring & student management</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <Link
              to="/owner-courses"
              className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <BookOpen size={15} />
              Manage Courses
            </Link>
            <Link
              to="/owner-notes"
              className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <FileText size={15} />
              Notes Management
            </Link>
            <div className="glass px-4 py-2 text-xs font-bold flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Owner Portal Active
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: stats?.total_students || 0, icon: <Users size={20} className="text-indigo-600" />, gradient: 'from-indigo-50 to-indigo-100/50', accent: 'border-l-indigo-500' },
          { label: 'Enrollments', value: stats?.total_enrollments || 0, icon: <BookOpen size={20} className="text-blue-600" />, gradient: 'from-blue-50 to-blue-100/50', accent: 'border-l-blue-500' },
          { label: 'Regular', value: stats?.regular || 0, icon: <Zap size={20} className="text-emerald-600" />, gradient: 'from-emerald-50 to-emerald-100/50', accent: 'border-l-emerald-500' },
          { label: 'Inactive', value: stats?.inactive || 0, icon: <Clock size={20} className="text-rose-600" />, gradient: 'from-rose-50 to-rose-100/50', accent: 'border-l-rose-500' },
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

      {/* Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Col: Students Database & Activity Logs (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="card-static p-6 space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
                <h2 className="text-lg font-bold text-gray-900">Student Directory</h2>
                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{students.length} total</span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:flex-initial">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name/email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input pl-8 py-2 text-xs w-full sm:w-52"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {/* Filter */}
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer"
                >
                  <option value="All">All Statuses</option>
                  <option value="Regular">🟢 Regular</option>
                  <option value="Less Active">🟡 Less Active</option>
                  <option value="Inactive">🔴 Inactive</option>
                </select>
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto border border-gray-200/80 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] text-gray-500 font-bold uppercase tracking-wider">
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Joined / Active</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-center">XP & Level</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-12 text-center">
                        <div className="space-y-2">
                          <Users className="w-8 h-8 text-gray-300 mx-auto" />
                          <p className="text-gray-400 font-medium text-sm">No students found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, idx) => (
                      <tr key={student.id} className={`hover:bg-indigo-50/30 transition-colors duration-150 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                              {student.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-xs">{student.name}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">{student.email}</p>
                              {student.phone && <p className="text-[11px] text-gray-400">{student.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-[11px] text-gray-500">
                          <p>📅 {new Date(student.created_at).toLocaleDateString()}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Last: {student.last_active_at ? new Date(student.last_active_at).toLocaleString() : 'Never'}
                          </p>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 font-bold rounded-full border text-[10px] ${
                            student.regularity === 'Regular'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : student.regularity === 'Less Active'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {student.regularity === 'Regular' ? '🟢' : student.regularity === 'Less Active' ? '🟡' : '🔴'} {student.regularity}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <p className="font-bold text-gray-800 text-xs">{student.xp} XP</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">Level {student.level}</p>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => handleStudentView(student.id)}
                            className="p-2 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 text-indigo-600 rounded-lg transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            title="View student data"
                            aria-label={`View data for student ${student.name}`}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleStudentDelete(student.id, student.name)}
                            className="p-2 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 text-rose-500 rounded-lg transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            title="Delete student"
                            aria-label={`Delete student ${student.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity Logs Console */}
          <div className="card-static p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Activity size={18} className="text-indigo-600" /> Activity Console
              </h2>
            </div>
            <div className="space-y-0 max-h-72 overflow-y-auto pr-2 border border-gray-100 rounded-xl bg-gray-50/30">
              {activity.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Activity className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-xs text-gray-400 font-medium">No actions logged yet.</p>
                </div>
              ) : (
                activity.map((act, idx) => (
                  <div key={idx} className={`flex justify-between items-start gap-4 p-3.5 text-xs border-b border-gray-100/80 last:border-0 ${idx % 2 === 0 ? 'bg-white/50' : ''}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        act.action?.includes('enrolled') ? 'bg-blue-400' :
                        act.action?.includes('completed') ? 'bg-emerald-400' :
                        act.action?.includes('registered') ? 'bg-purple-400' : 'bg-gray-400'
                      }`} />
                      <div className="space-y-0.5">
                        <p className="font-semibold text-gray-700">{act.action}</p>
                        <p className="text-[11px] text-gray-400">By {act.name} ({act.email})</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium">{new Date(act.created_at).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Student Details Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card-static p-6 space-y-5 sticky top-24">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Academic Checkpoint</h2>
              </div>
              {selectedStudent && (
                <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>

            {viewLoading ? (
              <div className="text-center py-16">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-gray-400 mt-3">Loading details...</p>
              </div>
            ) : selectedStudent ? (
              <div className="space-y-5 animate-fadeIn">
                {/* Basic info */}
                <div className="border-b border-gray-100 pb-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-indigo-500/20">
                      {selectedStudent.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-extrabold text-gray-900">{selectedStudent.name}</p>
                      <p className="text-[11px] text-gray-400">{selectedStudent.email}</p>
                    </div>
                  </div>
                  {selectedStudent.phone && (
                    <p className="text-[11px] text-gray-400">📱 {selectedStudent.phone}</p>
                  )}
                  <div className="flex gap-2 items-center">
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                      Lv {selectedStudent.level}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                      {selectedStudent.xp} XP
                    </span>
                  </div>
                </div>

                {/* Enrolled Courses Progress */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Courses In Progress</p>
                  {selectedStudent.courses.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">No courses enrolled.</p>
                  ) : (
                    selectedStudent.courses.map(course => (
                      <div key={course.id} className="border border-gray-100 rounded-xl p-3.5 space-y-2 bg-gray-50/30 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-bold text-gray-800 text-xs line-clamp-1">{course.title}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            course.progress_percent === 100
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>{course.progress_percent}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${course.progress_percent}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {course.completed_modules} / {course.total_modules} modules completed
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Activity log — timeline style */}
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Recent Activity</p>
                  <div className="space-y-0 max-h-48 overflow-y-auto pr-1">
                    {selectedStudent.activity_log.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">No logged activity.</p>
                    ) : (
                      selectedStudent.activity_log.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                            log.action?.includes('completed') ? 'bg-emerald-400' :
                            log.action?.includes('enrolled') ? 'bg-blue-400' : 'bg-gray-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-700 text-[11px] leading-snug">{log.action}</p>
                            <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-gray-400 space-y-3">
                <div className="mx-auto w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center">
                  <Users className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-xs font-medium text-gray-400 max-w-[180px] mx-auto leading-relaxed">
                  Select a student from the directory to view their academic profile
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Delete Student Confirmation Modal */}
      {deleteModalStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-student-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-gray-100 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 id="delete-student-modal-title" className="text-base font-bold text-gray-900">
                  Delete Student Confirmation
                </h3>
                <p className="text-xs text-gray-500">
                  Student: <span className="font-semibold text-gray-700">{deleteModalStudent.name}</span>
                </p>
              </div>
            </div>

            <div className="text-xs text-gray-600 space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p>
                Are you sure you want to permanently delete student <strong>"{deleteModalStudent.name}"</strong>?
              </p>
              <p className="text-rose-600 font-semibold">
                ⚠️ This action is permanent and will remove the student profile, enrollments, and learning progress.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalStudent(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStudentDelete}
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

export default OwnerDashboard;
