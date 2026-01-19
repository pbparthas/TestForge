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
  TestSuitesPage,
  RequirementsPage,
  ExecutionsPage,
  BugsPage,
  CoveragePage,
  ScriptSmithProPage,
  AIGeneratorPage,
  CodeGuardianPage,
  FlowPilotPage,
  SelfHealingPage,
  VisualTestingPage,
  RecorderPage,
  BugPatternsPage,
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
            <Route path="coverage" element={<CoveragePage />} />
            {/* AI Agent Pages */}
            <Route path="scriptsmith-pro" element={<ScriptSmithProPage />} />
            <Route path="ai-generator" element={<AIGeneratorPage />} />
            <Route path="code-guardian" element={<CodeGuardianPage />} />
            <Route path="flowpilot" element={<FlowPilotPage />} />
            <Route path="self-healing" element={<SelfHealingPage />} />
            <Route path="visual-testing" element={<VisualTestingPage />} />
            <Route path="recorder" element={<RecorderPage />} />
            <Route path="bug-patterns" element={<BugPatternsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
