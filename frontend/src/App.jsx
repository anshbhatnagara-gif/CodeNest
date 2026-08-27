import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import Welcome from './pages/Welcome';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MyLearning from './pages/MyLearning';
import PrivacyPolicy from './pages/PrivacyPolicy';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerNotes from './pages/OwnerNotes';

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
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Welcome />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

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
              path="/courses"
              element={
                <ProtectedRoute>
                  <Courses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courses/:id"
              element={
                <ProtectedRoute>
                  <CourseDetail />
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
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
};

export default App;
