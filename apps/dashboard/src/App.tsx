/**
 * App Component
 * Main application with routing
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth';
import { Layout } from './components/Layout';
import {
  LoginPage,
  DashboardPage,
  TestCasesPage,
  ExecutionsPage,
  BugsPage,
  AiAgentsPage,
  CoveragePage,
} from './pages';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="test-cases" element={<TestCasesPage />} />
            <Route path="test-suites" element={<TestSuitesPage />} />
            <Route path="requirements" element={<RequirementsPage />} />
            <Route path="executions" element={<ExecutionsPage />} />
            <Route path="bugs" element={<BugsPage />} />
            <Route path="ai" element={<AiAgentsPage />} />
            <Route path="coverage" element={<CoveragePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// Placeholder pages for Test Suites and Requirements
function TestSuitesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Test Suites</h1>
      <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
        Test Suites management coming soon
      </div>
    </div>
  );
}

function RequirementsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Requirements</h1>
      <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
        Requirements management coming soon
      </div>
    </div>
  );
}

export default App;
