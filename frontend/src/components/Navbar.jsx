import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LayoutDashboard, GraduationCap, LogOut, LogIn, Menu, X, BookMarked, Shield, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  const isOwner = user && user.role === 'owner';

  const navLink = (to, label, icon) => (
    <Link
      to={to}
      onClick={() => setMenuOpen(false)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive(to)
          ? 'bg-indigo-50 text-indigo-700 shadow-sm'
          : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/95 backdrop-blur-lg border-b border-gray-200/60 shadow-md shadow-gray-900/5'
        : 'bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm'
    }`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={user ? "/home" : "/"} className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:shadow-lg group-hover:shadow-indigo-500/30 transition-shadow duration-300">
              <BookOpen className="text-white" size={18} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-gray-900">
                Code<span className="text-gradient">Nest</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Free
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {user && navLink('/home', 'Home', <BookOpen size={15} />)}
            {navLink('/courses', 'Courses', <BookMarked size={15} />)}
            {user && navLink('/dashboard', 'Dashboard', <LayoutDashboard size={15} />)}
            {user && navLink('/my-learning', 'My Learning', <GraduationCap size={15} />)}
            {isOwner && navLink('/owner-courses', 'Manage Courses', <BookOpen size={15} />)}
            {isOwner && navLink('/owner-notes', 'Notes', <FileText size={15} />)}
            {isOwner && navLink('/owner-dashboard', 'Owner Dashboard', <Shield size={15} />)}
          </div>

          {/* Right Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-indigo-500/20">
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                    {user.role === 'owner' && (
                      <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
                        <Shield size={8} className="text-amber-800" />
                      </div>
                    )}
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-gray-800 leading-none">{user.name?.split(' ')[0]}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user.xp} XP · Lv {user.level}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-600 hover:text-indigo-600 font-medium px-3 py-2 rounded-lg hover:bg-gray-50 transition-all duration-200 flex items-center gap-1.5">
                  <LogIn size={15} />
                  Login
                </Link>
                <Link to="/register" className="btn-primary text-sm py-2 px-5">
                  Get Started Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            className="lg:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu — animated */}
        {menuOpen && (
          <div className="lg:hidden py-3 border-t border-gray-100 space-y-1 animate-slideDown overflow-hidden">
            {user && navLink('/home', 'Home', <BookOpen size={15} />)}
            {navLink('/courses', 'Courses', <BookMarked size={15} />)}
            {user && navLink('/dashboard', 'Dashboard', <LayoutDashboard size={15} />)}
            {user && navLink('/my-learning', 'My Learning', <GraduationCap size={15} />)}
            {isOwner && navLink('/owner-courses', 'Manage Courses', <BookOpen size={15} />)}
            {isOwner && navLink('/owner-notes', 'Notes', <FileText size={15} />)}
            {isOwner && navLink('/owner-dashboard', 'Owner Dashboard', <Shield size={15} />)}
            {user ? (
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="w-full flex items-center gap-1.5 text-sm text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} /> Logout
              </button>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link to="/login" onClick={() => setMenuOpen(false)} className="flex-1 text-center btn-secondary text-sm py-2">Login</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="flex-1 text-center btn-primary text-sm py-2">Register</Link>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
