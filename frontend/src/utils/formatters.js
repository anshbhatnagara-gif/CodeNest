/**
 * CodeNest Formatting and Badge Utilities
 */

export const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const getFileTypeBadge = (fileType) => {
  const type = (fileType || '').toUpperCase();
  if (type === 'PDF') return 'bg-red-50 text-red-700 border-red-200';
  if (type.includes('DOC')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (type.includes('PPT')) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (type.includes('TXT')) return 'bg-gray-50 text-gray-700 border-gray-200';
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'IMAGE'].includes(type)) return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
};

export const difficultyColor = {
  Beginner: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Intermediate: 'bg-blue-50 text-blue-700 border-blue-200',
  Advanced: 'bg-purple-50 text-purple-700 border-purple-200',
};

export const getOwnerDifficultyBadge = (level) => {
  if (level === 'Beginner') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (level === 'Intermediate') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  if (level === 'Advanced') return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
};

