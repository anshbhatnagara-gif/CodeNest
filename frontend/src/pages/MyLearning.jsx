import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  BookOpen,
  Layers,
  TrendingUp,
  Trophy,
  PlayCircle,
  Sparkles,
  Award,
  Filter,
  RotateCcw
} from 'lucide-react';
import api from '../context/AuthContext';
import { difficultyColor } from '../utils/formatters';

const getCourseStats = (c) => {
  const total = Math.max(0, parseInt(c?.total_modules, 10) || 0);
  const rawCompleted = Math.max(0, parseInt(c?.completed_modules, 10) || 0);
  const completed = Math.min(rawCompleted, total);
  const percent = total > 0 ? Math.min(100, Math.max(0, Math.round((completed / total) * 100))) : 0;
  const isCompleted = total > 0 && completed >= total;
  const isStarted = completed > 0;
  const nextLesson = total > 0 ? Math.min(completed + 1, total) : 0;
  const remaining = Math.max(0, total - completed);

  return { total, completed, percent, isCompleted, isStarted, nextLesson, remaining };
};

const MyLearning = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/progress/my-courses');
      if (data && data.success && Array.isArray(data.courses)) {
        setCourses(data.courses);
      } else {
        setCourses([]);
      }
    } catch (e) {
      console.error('Fetch My Learning Courses Error:', e);
      setError('Unable to load your courses. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Aggregate statistics
  const totalEnrolled = courses.length;
  const completedCourses = courses.filter(c => getCourseStats(c).isCompleted).length;
  const inProgressCourses = courses.filter(c => {
    const s = getCourseStats(c);
    return s.isStarted && !s.isCompleted;
  }).length;
  const notStartedCourses = courses.filter(c => {
    const s = getCourseStats(c);
    return !s.isStarted && !s.isCompleted;
  }).length;

  const totalAllLessons = courses.reduce((sum, c) => sum + getCourseStats(c).total, 0);
  const totalCompletedLessons = courses.reduce((sum, c) => sum + getCourseStats(c).completed, 0);
  const overallProgressPercent = totalAllLessons > 0
    ? Math.min(100, Math.max(0, Math.round((totalCompletedLessons / totalAllLessons) * 100)))
    : 0;

  // Identify active course for spotlight: first in-progress course, or first not-started course
  const spotlightCourse = courses.find(c => {
    const s = getCourseStats(c);
    return s.isStarted && !s.isCompleted;
  }) || courses.find(c => {
    const s = getCourseStats(c);
    return !s.isCompleted && s.total > 0;
  });

  const spotlightStats = spotlightCourse ? getCourseStats(spotlightCourse) : null;

  // Filtered courses
  const filtered = courses.filter(c => {
    const s = getCourseStats(c);
    if (filter === 'completed') return s.isCompleted;
    if (filter === 'in-progress') return s.isStarted && !s.isCompleted;
    if (filter === 'not-started') return !s.isStarted && !s.isCompleted;
    return true;
  });

  const filterButtons = [
    { key: 'all', label: 'All Courses', count: totalEnrolled },
    { key: 'in-progress', label: 'In Progress', count: inProgressCourses },
    { key: 'completed', label: 'Completed', count: completedCourses },
    { key: 'not-started', label: 'Not Started', count: notStartedCourses },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 page-enter">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full" />
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center gap-2">
              My Learning Dashboard
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Track course completion, lesson progress, and resume your learning
            </p>
          </div>
        </div>
        <Link to="/courses" className="btn-primary text-sm flex items-center gap-2 self-start sm:self-auto">
          Explore All Courses <ArrowRight size={15} />
        </Link>
      </div>

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center justify-between gap-4">
          <span className="text-sm font-medium">{error}</span>
          <button
            onClick={fetchCourses}
            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Retry
          </button>
        </div>
      )}

      {/* 1. Overall Learning Statistics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Enrolled Courses',
            value: totalEnrolled,
            sub: totalAllLessons > 0 ? `${totalAllLessons} total lessons` : 'Catalog ready',
            icon: <BookOpen className="text-indigo-600" size={20} />,
            gradient: 'from-indigo-50 to-indigo-100/50',
            accent: 'border-l-indigo-500'
          },
          {
            label: 'In Progress',
            value: inProgressCourses,
            sub: inProgressCourses === 1 ? '1 active course' : `${inProgressCourses} active courses`,
            icon: <TrendingUp className="text-blue-600" size={20} />,
            gradient: 'from-blue-50 to-blue-100/50',
            accent: 'border-l-blue-500'
          },
          {
            label: 'Completed',
            value: completedCourses,
            sub: completedCourses === 1 ? '1 course finished' : `${completedCourses} courses finished`,
            icon: <Trophy className="text-emerald-600" size={20} />,
            gradient: 'from-emerald-50 to-emerald-100/50',
            accent: 'border-l-emerald-500'
          },
          {
            label: 'Overall Progress',
            value: `${overallProgressPercent}%`,
            sub: `${totalCompletedLessons} of ${totalAllLessons} lessons done`,
            icon: <Award className="text-purple-600" size={20} />,
            gradient: 'from-purple-50 to-purple-100/50',
            accent: 'border-l-purple-500'
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className={`card-static p-5 flex items-center gap-3.5 border-l-4 ${stat.accent} bg-gradient-to-r ${stat.gradient} transition-transform hover:-translate-y-0.5`}
          >
            <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100">
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black text-gray-900 leading-tight">{stat.value}</p>
              <p className="text-xs font-bold text-gray-800 truncate">{stat.label}</p>
              <p className="text-[11px] text-gray-500 truncate">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. "Continue Where You Left Off" Spotlight Banner */}
      {!loading && spotlightCourse && spotlightStats && (
        <div className="relative bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl shadow-indigo-950/15 border border-indigo-800/40 overflow-hidden">
          {/* Ambient Glow Orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none translate-y-1/2 -translate-x-1/4" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-yellow-300 text-[11px] font-bold tracking-wide uppercase">
                  <Sparkles size={12} className="text-yellow-400" /> Continue Where You Left Off
                </span>
                <span className="text-xs text-indigo-200/80 font-medium">
                  {spotlightCourse.category}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                {spotlightCourse.title}
              </h2>

              <p className="text-xs sm:text-sm text-indigo-100/80">
                Instructor: {spotlightCourse.instructor || 'CodeNest Faculty'} • Enrolled on {new Date(spotlightCourse.enrolled_at).toLocaleDateString()}
              </p>

              {/* Spotlight Progress Bar */}
              <div className="space-y-1.5 max-w-xl pt-1">
                <div className="flex justify-between text-xs font-semibold text-indigo-200">
                  <span>
                    Lesson {spotlightStats.nextLesson} of {spotlightStats.total}
                    {spotlightStats.remaining > 0 && ` (${spotlightStats.remaining} remaining)`}
                  </span>
                  <span className="text-white font-bold">{spotlightStats.percent}% Complete</span>
                </div>
                <div
                  className="h-3 bg-white/15 rounded-full overflow-hidden p-0.5"
                  role="progressbar"
                  aria-valuenow={spotlightStats.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progress for ${spotlightCourse.title}: ${spotlightStats.percent}%`}
                >
                  <div
                    className="h-full bg-gradient-to-r from-yellow-300 via-amber-300 to-emerald-400 rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${spotlightStats.percent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Resume Next Lesson Button */}
            <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-3 flex-shrink-0">
              <Link
                to={`/courses/${spotlightCourse.id}?resume=true`}
                className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-indigo-50 text-indigo-950 font-bold rounded-xl text-sm shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-white"
              >
                <PlayCircle size={18} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>
                  {spotlightStats.isStarted
                    ? `Resume Lesson ${spotlightStats.nextLesson}`
                    : 'Start Lesson 1'}
                </span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 3. Filter Buttons with Count Badges */}
      <div className="flex gap-2 flex-wrap items-center" role="tablist" aria-label="Course filters">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1 hidden sm:inline">Filter:</span>
        {filterButtons.map(f => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all duration-200 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              filter === f.key
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm'
            }`}
          >
            {f.label}
            <span
              className={`text-[10px] font-bold rounded-full px-2 py-0.5 min-w-[20px] text-center ${
                filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* 4. Course Cards Grid / Loading / Empty States */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card-static p-6 animate-pulse space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                </div>
                <div className="w-20 h-20 bg-gray-200 rounded-xl" />
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full" />
              <div className="h-10 bg-gray-200 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-static p-12 sm:p-16 text-center space-y-4 animate-fadeIn border border-dashed border-gray-200">
          <div className="mx-auto w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600">
            {courses.length === 0 ? (
              <BookOpen className="w-10 h-10 text-indigo-400" />
            ) : (
              <Filter className="w-10 h-10 text-gray-400" />
            )}
          </div>
          {courses.length === 0 ? (
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-gray-900">No courses enrolled yet</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Explore our catalog of free, structured programming courses with interactive modules, study notes, and certificates!
              </p>
              <div className="pt-2">
                <Link to="/courses" className="btn-primary inline-flex items-center gap-2 text-sm">
                  Browse Free Courses <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-800">No courses match this filter</h3>
              <p className="text-sm text-gray-500">
                You currently do not have any courses in the selected category.
              </p>
              <button
                onClick={() => setFilter('all')}
                className="px-4 py-2 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <RotateCcw size={13} /> Reset Filter to All
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map(course => {
            const stats = getCourseStats(course);
            const formattedDate = course.enrolled_at
              ? new Date(course.enrolled_at).toLocaleDateString()
              : 'Recently';

            return (
              <div
                key={course.id}
                className="card p-6 flex flex-col justify-between space-y-4 border border-gray-100 hover:border-indigo-200 group transition-all duration-300"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                        {course.category || 'General'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          difficultyColor[course.difficulty] || difficultyColor.Beginner
                        }`}
                      >
                        {course.difficulty || 'Beginner'}
                      </span>
                    </div>

                    {stats.isCompleted ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={11} className="text-emerald-600" /> Completed 🎉
                      </span>
                    ) : stats.isStarted ? (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Clock size={11} className="text-indigo-600" /> In Progress
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full">
                        Not Started
                      </span>
                    )}
                  </div>

                  {/* Course Title & Thumbnail Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link to={`/courses/${course.id}`}>
                        <h3 className="font-extrabold text-gray-900 text-base leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors duration-200">
                          {course.title}
                        </h3>
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> Enrolled {formattedDate}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="flex items-center gap-1">
                          <Layers size={12} /> {stats.total} {stats.total === 1 ? 'lesson' : 'lessons'}
                        </span>
                      </div>
                    </div>

                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      loading="lazy"
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-gray-100 shadow-sm group-hover:shadow-md transition-shadow duration-200"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `https://placehold.co/80x80/6366f1/white?text=${encodeURIComponent(
                          course.title ? course.title.charAt(0) : 'C'
                        )}`;
                      }}
                    />
                  </div>
                </div>

                {/* Progress Indicators & Actions */}
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600 font-semibold">
                        {stats.completed} of {stats.total} lessons completed
                      </span>
                      <span
                        className={`font-black ${
                          stats.isCompleted ? 'text-emerald-600' : 'text-indigo-600'
                        }`}
                      >
                        {stats.percent}%
                      </span>
                    </div>

                    <div
                      className="progress-bar"
                      role="progressbar"
                      aria-valuenow={stats.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Progress for ${course.title}: ${stats.percent}%`}
                    >
                      <div
                        className={
                          stats.isCompleted
                            ? 'h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700 ease-out'
                            : 'progress-fill'
                        }
                        style={{ width: `${stats.percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                      {stats.isCompleted ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={11} /> All lessons completed! Certificate unlocked.
                        </span>
                      ) : stats.isStarted ? (
                        <span>
                          Next up: Lesson {stats.nextLesson} • {stats.remaining} {stats.remaining === 1 ? 'lesson' : 'lessons'} left
                        </span>
                      ) : (
                        <span>
                          Ready to begin • {stats.total} {stats.total === 1 ? 'lesson' : 'lessons'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Link Button */}
                  {stats.isCompleted ? (
                    <Link
                      to={`/courses/${course.id}`}
                      className="flex items-center justify-center gap-2 w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold py-2.5 rounded-xl text-xs border border-emerald-200 transition-all duration-200 shadow-sm"
                    >
                      <Sparkles size={14} className="text-emerald-600" />
                      <span>🎉 Review Course & Certificate</span>
                      <ArrowRight size={13} />
                    </Link>
                  ) : stats.isStarted ? (
                    <Link
                      to={`/courses/${course.id}?resume=true`}
                      className="flex items-center justify-center gap-2 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2.5 rounded-xl text-xs border border-indigo-200 transition-all duration-200 shadow-sm group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600"
                    >
                      <PlayCircle size={14} />
                      <span>Resume Lesson {stats.nextLesson}</span>
                      <ArrowRight size={13} />
                    </Link>
                  ) : (
                    <Link
                      to={`/courses/${course.id}?resume=true`}
                      className="btn-primary flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold"
                    >
                      <PlayCircle size={14} />
                      <span>Start Lesson 1</span>
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyLearning;
