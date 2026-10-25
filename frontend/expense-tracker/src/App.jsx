import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import AiAssistant from './components/AiAssistant';
import Goals from './pages/Dashboard/Goals'; 
import PaisaBuddy from './components/PaisaBuddy';

// Layouts
import AuthLayout from './components/layouts/AuthLayout';

// Pages
import Login from './pages/Auth/Login';
import SignUp from './pages/Auth/SignUp';
import Home from './pages/Dashboard/Home';
import Income from './pages/Dashboard/Income';
import Expense from './pages/Dashboard/Expense';
import Budgets from './pages/Dashboard/Budgets';
import Reports from './pages/Dashboard/Reports';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { token } = useFinance();
  return token ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { token } = useFinance();
  return token ? <Navigate to="/dashboard" replace /> : children;
};

function App() {
  return (
    <FinanceProvider>
      <Router>
        <div className="App">
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                theme: 'dark',
              },
              error: {
                duration: 4000,
                theme: 'dark',
              },
            }}
          />
          <Routes>
            {/* Public Routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <AuthLayout>
                    <Login />
                  </AuthLayout>
                </PublicRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <AuthLayout>
                    <SignUp />
                  </AuthLayout>
                </PublicRoute>
              }
            />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/income"
              element={
                <ProtectedRoute>
                  <Income />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expense"
              element={
                <ProtectedRoute>
                  <Expense />
                </ProtectedRoute>
              }
            />
            <Route
              path="/budgets"
              element={
                <ProtectedRoute>
                  <Budgets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route path="/goals" element={<ProtectedRoute><Goals /></ProtectedRoute>} />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <AiAssistant /> 
          <PaisaBuddy />  
        </div>
      </Router>
    </FinanceProvider>
  );
}

export default App;
