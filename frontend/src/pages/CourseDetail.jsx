import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Clock,
  Users,
  CheckCircle2,
  Lock,
  PlayCircle,
  BookOpen,
  ChevronLeft,
  Zap,
  Layers,
  FileText,
  Download,
  Eye,
  X,
  FileCode,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../context/AuthContext';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileTypeBadge = (fileType) => {
  const type = (fileType || '').toUpperCase();
  if (type === 'PDF') return 'bg-red-50 text-red-700 border-red-200';
  if (type.includes('DOC')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (type.includes('PPT')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (type.includes('TXT')) return 'bg-gray-50 text-gray-700 border-gray-200';
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'IMAGE'].includes(type)) return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
};

const CourseDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [activeTab, setActiveTab] = useState('curriculum'); // 'curriculum' | 'notes'
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
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to download file. Please login and try again.' });
    } finally {
      setDownloadingNoteId(null);
    }
  };

  const fetchCourseData = async () => {
    try {
      const resCourse = await api.get(`/courses/${id}`);
      if (resCourse.data.success) {
        setCourse(resCourse.data.course);
      }

      // Fetch published notes for this course
      const resNotes = await api.get(`/notes?course_id=${id}`);
      if (resNotes.data.success) {
        setNotes(resNotes.data.notes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseData();
  }, [id]);

  const handleEnroll = async () => {
    if (!user) return;
    setEnrolling(true);
    try {
      const { data } = await api.post(`/courses/${id}/enroll`);
      setMessage({ type: 'success', text: data.message });
      fetchCourseData();
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Enrollment failed.' });
    } finally {
      setEnrolling(false);
    }
  };

  const handleComplete = async (moduleId) => {
    if (!user) return;
    setCompleting(moduleId);
    try {
      const { data } = await api.post('/progress/module-complete', { module_id: moduleId });
      if (!data.already_done) {
        setMessage({ type: 'success', text: data.message });
        if (data.course_completed) setMessage({ type: 'success', text: `🎉 Course Completed! +${data.bonus_xp} Bonus XP!` });
      }
      fetchCourseData();
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.message || 'Error.' });
    } finally {
      setCompleting(null);
    }
  };

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400 font-medium">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-32 space-y-4 page-enter">
        <div className="mx-auto w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-700">Course not found</h2>
        <p className="text-sm text-gray-400">This course might have been removed or doesn't exist.</p>
        <Link to="/courses" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
          <ChevronLeft size={15} /> Back to Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-enter text-left">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-800 text-white py-14 overflow-hidden">
        {/* Texture overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl translate-y-1/2" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/courses" className="inline-flex items-center gap-1 text-indigo-200 hover:text-white text-sm mb-8 transition-colors group">
            <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Back to Courses
          </Link>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-white/15 text-white px-3 py-1 rounded-full border border-white/20 uppercase tracking-wider">{course.category}</span>
                <span className="badge-free text-[10px]"><CheckCircle2 size={10} /> FREE</span>
                {notes.length > 0 && (
                  <span className="text-[10px] font-bold bg-indigo-400/30 text-white px-3 py-1 rounded-full border border-white/20 flex items-center gap-1">
                    <FileText size={10} /> {notes.length} Study Notes
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold leading-tight tracking-tight">{course.title}</h1>
              <p className="text-indigo-100/80 text-base leading-relaxed">{course.description}</p>
              <div className="flex flex-wrap gap-6 text-sm text-indigo-200/80">
                <span className="flex items-center gap-1.5"><Clock size={15} />{course.duration}</span>
                <span className="flex items-center gap-1.5"><Layers size={15} />{course.total_modules} Modules</span>
                <span className="flex items-center gap-1.5"><Users size={15} />By {course.instructor}</span>
              </div>
            </div>

            {/* Enroll Card */}
            <div className="bg-white/95 backdrop-blur-lg text-gray-900 rounded-2xl p-6 shadow-2xl shadow-black/10 border border-white/50 space-y-4">
              <img
                src={course.thumbnail}
                alt={course.title}
                className="w-full rounded-xl aspect-video object-cover"
                onError={(e) => { e.target.src = `https://placehold.co/400x225/6366f1/white?text=${encodeURIComponent(course.title)}`; }}
              />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-extrabold text-gradient">FREE</span>
                  <span className="text-xs font-bold text-gray-400 line-through">₹4,999</span>
                </div>
                {course.is_enrolled ? (
                  <div className="space-y-2.5">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${course.progress_percent}%` }} />
                    </div>
                    <p className="text-xs font-semibold text-indigo-600 text-center">
                      {course.progress_percent}% Complete — {course.completed_count}/{course.total_modules} modules
                    </p>
                  </div>
                ) : user ? (
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="btn-primary w-full text-sm py-3 flex items-center justify-center gap-2"
                  >
                    {enrolling ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enrolling...</>
                    ) : (
                      <><Zap size={15} className="fill-yellow-300 text-yellow-300" /> Enroll for Free</>
                    )}
                  </button>
                ) : (
                  <Link to="/register" className="btn-primary w-full text-sm py-3 flex items-center justify-center gap-2">
                    <Zap size={15} /> Register to Enroll Free
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Toast message */}
        {message && (
          <div className={`p-4 rounded-xl text-sm font-medium animate-fadeInUp flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.type === 'success' ? <CheckCircle2 size={16} /> : null}
            {message.text}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 border-b border-gray-200 pb-1">
          <button
            onClick={() => setActiveTab('curriculum')}
            className={`pb-3 font-bold text-sm flex items-center gap-2 transition-all border-b-2 -mb-1 px-3 ${
              activeTab === 'curriculum'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers size={16} />
            Course Curriculum ({course.total_modules})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-3 font-bold text-sm flex items-center gap-2 transition-all border-b-2 -mb-1 px-3 ${
              activeTab === 'notes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} />
            Study Notes ({notes.length})
          </button>
        </div>

        {/* TAB 1: CURRICULUM */}
        {activeTab === 'curriculum' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-1 h-7 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
              <h2 className="text-xl font-bold text-gray-900">Modules Timeline</h2>
            </div>

            <div className="space-y-0 relative">
              <div className="absolute left-[19px] top-4 bottom-4 w-px bg-gray-200" />
              {course.modules.map((mod, idx) => (
                <div
                  key={mod.id}
                  className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ml-0 mb-2 ${
                    mod.is_completed
                      ? 'bg-emerald-50/50 border-emerald-200/60'
                      : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-sm'
                  }`}
                >
                  <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
                    mod.is_completed
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-white border-2 border-gray-200 text-gray-500'
                  }`}>
                    {mod.is_completed ? <CheckCircle2 size={16} /> : idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${mod.is_completed ? 'text-emerald-800' : 'text-gray-800'}`}>
                      {mod.title}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{mod.duration}</p>
                  </div>

                  {course.is_enrolled && !mod.is_completed && (
                    <button
                      onClick={() => handleComplete(mod.id)}
                      disabled={completing === mod.id}
                      className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-lg border border-indigo-200 transition-all duration-200 active:scale-95 hover:shadow-sm"
                    >
                      {completing === mod.id ? (
                        <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <PlayCircle size={13} />
                      )}
                      Mark Done
                    </button>
                  )}
                  {!course.is_enrolled && (
                    <Lock size={14} className="text-gray-300 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: STUDY NOTES */}
        {activeTab === 'notes' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1 h-7 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Study Notes & Resources</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Downloadable cheat sheets, lecture summaries, and reference material.</p>
                </div>
              </div>
            </div>

            {notes.length === 0 ? (
              <div className="card-static p-14 text-center space-y-3">
                <FileText className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="text-gray-600 font-bold text-sm">No notes published for this course yet.</p>
                <p className="text-gray-400 text-xs max-w-sm mx-auto">Check back soon! Instructors regularly upload cheat sheets and study guides.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notes.map(note => (
                  <div
                    key={note.id}
                    className="card p-5 border border-gray-100 bg-white space-y-4 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        {note.file_type ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getFileTypeBadge(note.file_type)}`}>
                            {note.file_type} {note.file_size ? `• ${formatBytes(note.file_size)}` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                            READABLE NOTE
                          </span>
                        )}
                        {note.module_title && (
                          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded truncate max-w-[150px]">
                            {note.module_title}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-gray-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {note.title}
                      </h3>

                      {note.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {note.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-50 gap-2">
                      <span className="text-[11px] text-gray-400">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedNote(note)}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Eye size={13} />
                          Read Note
                        </button>
                        {note.file_url && (
                          <button
                            onClick={() => handleDownloadFile(note)}
                            disabled={downloadingNoteId === note.id}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                          >
                            {downloadingNoteId === note.id ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download size={13} />
                            )}
                            Download
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STUDENT NOTE PREVIEW MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-600">{course.title}</span>
                {selectedNote.module_title && (
                  <span className="text-xs text-gray-400">• {selectedNote.module_title}</span>
                )}
              </div>
              <button onClick={() => setSelectedNote(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-left">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900">{selectedNote.title}</h2>
                {selectedNote.description && (
                  <p className="text-sm text-gray-600 mt-2">{selectedNote.description}</p>
                )}
              </div>

              {/* File Attached Box */}
              {selectedNote.file_url && (
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/60 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-sm border ${getFileTypeBadge(selectedNote.file_type)}`}>
                      {selectedNote.file_type || 'FILE'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 truncate max-w-xs">{selectedNote.file_name || 'Study Material File'}</p>
                      <p className="text-[11px] text-gray-400">{formatBytes(selectedNote.file_size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadFile(selectedNote)}
                    disabled={downloadingNoteId === selectedNote.id}
                    className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                  >
                    {downloadingNoteId === selectedNote.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    Download File
                  </button>
                </div>
              )}

              {/* Content Preview */}
              {selectedNote.content && (
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Note Content</p>
                  <div className="p-4 bg-gray-50 rounded-xl text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed border border-gray-100">
                    {selectedNote.content}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center px-6 py-3.5 bg-gray-50 border-t border-gray-100 text-xs">
              <span className="text-gray-400">Published: {new Date(selectedNote.created_at).toLocaleDateString()}</span>
              <button
                onClick={() => setSelectedNote(null)}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetail;
