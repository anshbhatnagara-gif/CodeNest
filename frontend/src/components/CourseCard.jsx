import { Link } from 'react-router-dom';
import { Clock, Users, ArrowRight, CheckCircle2, Star } from 'lucide-react';
import { difficultyColor } from '../utils/formatters';

const CourseCard = ({ course }) => {
  const progress = course.progress_percent || 0;
  const isEnrolled = course.is_enrolled;


  return (
    <div className="card flex flex-col overflow-hidden group">
      {/* Thumbnail */}
      <div className="relative overflow-hidden aspect-video">
        <img
          src={course.thumbnail}
          alt={course.title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = `https://placehold.co/600x340/6366f1/white?text=${encodeURIComponent(course.title)}`;
          }}
        />
        <div className="absolute top-3 left-3">
          <span className="badge-free">
            <CheckCircle2 size={11} />
            FREE COURSE
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${difficultyColor[course.difficulty] || difficultyColor.Beginner}`}>
            {course.difficulty}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <span className="text-xs font-medium text-indigo-600 uppercase tracking-wider">{course.category}</span>

        <h3 className="text-base font-bold text-gray-900 mt-1 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
          {course.title}
        </h3>

        <p className="text-sm text-gray-500 line-clamp-2 flex-1 mb-4">
          {course.description}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {course.duration}
          </span>
          <span className="flex items-center gap-1">
            <Star size={12} className="text-amber-400 fill-amber-400" />
            {course.total_modules || 0} modules
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} />
            {course.total_enrolled || 0}
          </span>
        </div>

        {/* Instructor */}
        <div className="text-xs text-gray-500 mb-4">
          By <span className="font-semibold text-gray-700">{course.instructor}</span>
        </div>

        {/* Progress (if enrolled) */}
        {isEnrolled && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-gray-600 font-medium">Progress</span>
              <span className="font-semibold text-indigo-600">{progress}%</span>
            </div>
            <div
              className="progress-bar"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress for ${course.title}: ${progress}%`}
            >
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Button */}
        <Link
          to={`/courses/${course.id}`}
          className="flex items-center justify-center gap-2 w-full btn-primary text-sm py-2.5 mt-auto"
        >
          {isEnrolled ? (progress === 100 ? '🎉 Completed' : 'Continue Learning') : 'Start Learning'}
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
};

export default CourseCard;
