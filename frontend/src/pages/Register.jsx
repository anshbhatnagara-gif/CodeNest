import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Phone, Eye, EyeOff, BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  // Password strength
  const getStrength = (pwd) => {
    if (!pwd) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-400' };
    if (score <= 3) return { level: 2, label: 'Medium', color: 'bg-amber-400' };
    return { level: 3, label: 'Strong', color: 'bg-emerald-400' };
  };

  const strength = getStrength(form.password);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      return setError('Name is required.');
    }

    const normalizedEmail = form.email.toLowerCase().trim();
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return setError('Please enter a valid email address.');
    }

    if (form.password.length < 8) return setError('Password must be at least 8 characters.');

    const payload = {
      name: trimmedName,
      email: normalizedEmail,
      phone: form.phone ? form.phone.trim() : '',
      password: form.password
    };

    setLoading(true);
    try {
      const data = await register(payload);
      if (data && data.success) {
        navigate('/dashboard');
      } else {
        setError(data?.message || 'Registration failed. Please try again.');
      }
    } catch (err) {
      const backendMessage = err.response?.data?.message;
      const errorMsg = backendMessage ||
        (err.message === 'Network Error'
          ? 'Cannot connect to backend server. Please make sure the backend server is running.'
          : err.message) ||
        'Registration failed. Try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12 relative overflow-hidden page-enter">
      {/* Decorative orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-200/40 to-indigo-200/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-purple-200/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 justify-center group">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-xl group-hover:shadow-indigo-500/30 transition-shadow duration-300">
              <BookOpen size={22} className="text-white" />
            </div>
            <span className="text-xl font-bold">Code<span className="text-gradient">Nest</span></span>
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900 mt-6">Create Free Account</h1>
          <p className="text-gray-500 text-sm mt-1.5">Start your coding journey today — it's 100% free</p>
        </div>

        {/* Perks - cards style */}
        <div className="flex justify-center gap-3 mb-7">
          {[
            { text: 'No credit card', icon: '💳' },
            { text: 'Free forever', icon: '🎯' },
            { text: '10+ courses', icon: '📚' },
          ].map(t => (
            <div key={t.text} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-full px-3 py-1.5 text-[11px] text-gray-600 font-medium shadow-sm">
              <span>{t.icon}</span> {t.text}
            </div>
          ))}
        </div>

        <div className="card-static p-8 space-y-6 shadow-xl shadow-gray-900/5 border border-gray-100">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 animate-fadeIn">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" name="name" value={form.name} onChange={handle} required placeholder="Your full name" className="input pl-10" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="email" name="email" value={form.email} onChange={handle} required placeholder="you@example.com" className="input pl-10" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="tel" name="phone" value={form.phone} onChange={handle} placeholder="+91 9876543210" className="input pl-10" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handle}
                  required
                  placeholder="Min. 8 characters"
                  className="input pl-10 pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength bar */}
              {form.password && (
                <div className="mt-2 space-y-1 animate-fadeIn">
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= strength.level ? strength.color : 'bg-gray-200'
                      }`} />
                    ))}
                  </div>
                  <p className={`text-[10px] font-medium ${
                    strength.level === 1 ? 'text-red-500' : strength.level === 2 ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {strength.label} password
                  </p>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-sm">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating Account...</>
              ) : (
                'Create Free Account 🚀'
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-gray-400 font-medium">or</span>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
              Sign In <ArrowRight size={12} className="inline" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;


