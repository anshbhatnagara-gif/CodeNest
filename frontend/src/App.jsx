import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded Route Components for Code Splitting
const Welcome = lazy(() => import('./pages/Welcome'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));

const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MyLearning = lazy(() => import('./pages/MyLearning'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'));
const OwnerCourses = lazy(() => import('./pages/OwnerCourses'));
const OwnerModules = lazy(() => import('./pages/OwnerModules'));

const OwnerNotes = lazy(() => import('./pages/OwnerNotes'));

// Consistent Page-Level Loading Fallback
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="text-center space-y-3">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-xs text-gray-400 font-medium tracking-wide">Loading page...</p>
    </div>
  </div>
);

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
};

const App = () => {
  return (
    <AuthProvider>
      <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
        <ScrollToTop />
        <Navbar />
        <main className="flex-grow">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:id" element={<CourseDetail />} />

              {/* Student Protected Routes */}
              <Route
                path="/home"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/privacy-policy"
                element={
                  <ProtectedRoute>
                    <PrivacyPolicy />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-learning"
                element={
                  <ProtectedRoute>
                    <MyLearning />
                  </ProtectedRoute>
                }
              />

              {/* Owner Protected Routes */}
              <Route
                path="/owner-dashboard"
                element={
                  <ProtectedRoute ownerOnly={true}>
                    <OwnerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner-courses"
                element={
                  <ProtectedRoute ownerOnly={true}>
                    <OwnerCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner-courses/:courseId/modules"
                element={
                  <ProtectedRoute ownerOnly={true}>
                    <OwnerModules />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner-notes"
                element={
                  <ProtectedRoute ownerOnly={true}>
                    <OwnerNotes />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default App;
