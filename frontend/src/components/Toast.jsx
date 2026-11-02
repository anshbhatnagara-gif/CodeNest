import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const Toast = ({ toast, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (toast && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose, duration]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium border animate-fadeIn transition-all duration-300 ${
        toast.type === 'success'
          ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
          : 'bg-rose-900 text-rose-100 border-rose-700'
      }`}
    >
      {toast.type === 'success' ? (
        <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
      ) : (
        <AlertCircle size={18} className="text-rose-400 flex-shrink-0" />
      )}
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 hover:opacity-75 focus:outline-none"
        aria-label="Close notification"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;

