import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, GraduationCap, Zap, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import api from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyCourses = async () => {
      try {
        const { data } = await api.get('/progress/my-courses');
        if (data.success) setCourses(data.courses);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchMyCourses();
  }, []);

  const completedCount = courses.filter(c => c.progress_percent === 100).length;
  const inProgressCount = courses.filter(c => c.progress_percent > 0 && c.progress_percent < 100).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 page-enter">
      {/* Welcome Banner */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-2xl p-8 text-white overflow-hidden">
        {/* Texture */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-indigo-200 text-sm font-medium flex items-center gap-1.5">
              <Sparkles size={13} className="text-yellow-300" /> Welcome back!
            </p>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-1">Hello, {user?.name?.split(' ')[0]} 👋</h1>
            <p className="text-indigo-100/80 text-sm mt-1">Keep learning and growing every day!</p>
          </div>
          <div className="flex gap-3">
            <div className="glass px-5 py-3 text-center min-w-[90px]">
              <p className="text-2xl font-extrabold">{user?.xp || 0}</p>
              <p className="text-[10px] text-indigo-200/80 font-medium">XP Points</p>
            </div>
            <div className="glass px-5 py-3 text-center min-w-[90px]">
              <p className="text-2xl font-extrabold">Lv {user?.level || 1}</p>
              <p className="text-[10px] text-indigo-200/80 font-medium">Level</p>
            </div>
          </div>
        </div>

        {/* XP Progress */}
        <div className="relative mt-6">
          <div className="flex justify-between text-[11px] text-indigo-200/80 mb-1.5">
            <span className="font-medium">Level {user?.level || 1}</span>
            <span>{(user?.xp || 0) % 500} / 500 XP to Level {(user?.level || 1) + 1}</span>
          </div>
          <div
            className="h-2.5 bg-white/15 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(((user?.xp || 0) % 500) / 500 * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`XP Progress: ${(user?.xp || 0) % 500} of 500 XP to next level`}
          >
            <div
              className="h-full bg-gradient-to-r from-white/90 to-yellow-200/90 rounded-full transition-all duration-700 animate-pulseGlow"
              style={{ width: `${((user?.xp || 0) % 500) / 500 * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Enrolled', value: courses.length, icon: <BookOpen className="text-indigo-600" size={20} />, gradient: 'from-indigo-50 to-indigo-100/50', accent: 'border-l-indigo-500' },
          { label: 'In Progress', value: inProgressCount, icon: <TrendingUp className="text-blue-600" size={20} />, gradient: 'from-blue-50 to-blue-100/50', accent: 'border-l-blue-500' },
          { label: 'Completed', value: completedCount, icon: <GraduationCap className="text-emerald-600" size={20} />, gradient: 'from-emerald-50 to-emerald-100/50', accent: 'border-l-emerald-500' },
          { label: 'XP Earned', value: user?.xp || 0, icon: <Zap className="text-amber-600" size={20} />, gradient: 'from-amber-50 to-amber-100/50', accent: 'border-l-amber-500' },
        ].map(stat => (
          <div key={stat.label} className={`card-static p-5 flex items-center gap-3 border-l-4 ${stat.accent} bg-gradient-to-r ${stat.gradient}`}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              {stat.icon}
            </div>
            <div>
              <p className="text-xl font-extrabold text-gray-900">{stat.value}</p>
              <p className="text-[11px] text-gray-500 font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Courses */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-7 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
            <h2 className="text-xl font-bold text-gray-900">Continue Learning</h2>
          </div>
          <Link to="/my-learning" className="text-sm text-indigo-600 font-semibold flex items-center gap-1 hover:text-indigo-700 transition-colors group">
            View All <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="card-static p-5 animate-pulse space-y-3">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-2.5 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="card-static p-14 text-center space-y-4 animate-fadeIn">
            <div className="mx-auto w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-700">No courses enrolled yet</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">Start with a free course and begin your coding journey today!</p>
            <Link to="/courses" className="btn-primary inline-flex items-center gap-2 text-sm">
              Browse Free Courses <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.slice(0, 3).map(course => (
              <Link to={`/courses/${course.id}`} key={course.id} className="card p-5 border space-y-3 group">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{course.category}</span>
                <h3 className="font-bold text-gray-900 text-sm line-clamp-2 group-hover:text-indigo-600 transition-colors duration-200">{course.title}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-500 font-medium">Progress</span>
                    <span className="font-bold text-indigo-600">{course.progress_percent}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${course.progress_percent}%` }} />
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium">{course.completed_modules}/{course.total_modules} modules completed</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
