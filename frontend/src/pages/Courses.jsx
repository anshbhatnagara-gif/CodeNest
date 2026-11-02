import { useEffect, useState } from 'react';
import { Search, BookMarked, SlidersHorizontal, X } from 'lucide-react';
import CourseCard from '../components/CourseCard';
import api from '../context/AuthContext';

const categories = ['All', 'Web Development', 'Frontend', 'Backend', 'Database', 'Programming', 'Tools', 'Computer Science'];

const Courses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data } = await api.get('/courses');
        if (data.success) setCourses(data.courses);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const filtered = courses.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || c.category === category;
    return matchSearch && matchCat;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 page-enter">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-indigo-100">
          <BookMarked size={13} />
          {courses.length} Free Courses Available
        </div>
        <h1 className="section-heading text-4xl">All Free Courses</h1>
        <p className="section-sub mx-auto">
          Learn programming from scratch. Every course is 100% free, forever.
        </p>
        {/* Accent bar */}
        <div className="mx-auto mt-4 w-20 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            id="courses-search"
            type="text"
            placeholder="Search courses by name or topic..."
            aria-label="Search courses by name or topic"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-11 py-3.5 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search query"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none w-full max-w-full" role="tablist" aria-label="Course categories">
        <SlidersHorizontal size={14} className="text-gray-400 flex-shrink-0 mr-1" />
        {categories.map(cat => (
          <button
            key={cat}
            role="tab"
            aria-selected={category === cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 text-xs font-semibold rounded-full border whitespace-nowrap transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${category === cat
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm'
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="card-static overflow-hidden animate-pulse">
              <div className="aspect-video bg-gray-200" />
              <div className="p-5 space-y-3">
                <div className="h-2 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-9 bg-gray-200 rounded-xl mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 space-y-4 animate-fadeIn">
          <div className="mx-auto w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center">
            <BookMarked className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-700">No courses found</h3>
          <p className="text-sm text-gray-400 max-w-sm mx-auto">Try searching with different keywords or clearing the filters.</p>
          <button onClick={() => { setSearch(''); setCategory('All'); }} className="btn-secondary text-sm inline-flex items-center gap-2">
            <X size={14} /> Clear Filters
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-5 font-medium">
            Showing <span className="font-bold text-gray-600">{filtered.length}</span> course{filtered.length !== 1 ? 's' : ''}
            {category !== 'All' && <> in <span className="text-indigo-600 font-bold">{category}</span></>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Courses;
