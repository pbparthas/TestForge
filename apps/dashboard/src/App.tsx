/**
 * App Component
 * Main application with routing
 */

import { useEffect, Suspense } from 'react';
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
  CodeAnalysisPage,
  TestEvolutionPage,
  TestPilotPage,
  FlakyTestsPage,
  JenkinsIntegrationsPage,
  ReportsPage,
  ApprovalsPage,
  AuditLogsPage,
  AdminFeedbackPage,
  MaestroSmithPage,
  CodeReviewPage,
  GitSettingsPage,
} from './pages';

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}

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
          <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
            <Route path="test-cases" element={<Suspense fallback={<PageLoader />}><TestCasesPage /></Suspense>} />
            <Route path="test-suites" element={<Suspense fallback={<PageLoader />}><TestSuitesPage /></Suspense>} />
            <Route path="requirements" element={<Suspense fallback={<PageLoader />}><RequirementsPage /></Suspense>} />
            <Route path="executions" element={<Suspense fallback={<PageLoader />}><ExecutionsPage /></Suspense>} />
            <Route path="bugs" element={<Suspense fallback={<PageLoader />}><BugsPage /></Suspense>} />
            <Route path="coverage" element={<Suspense fallback={<PageLoader />}><CoveragePage /></Suspense>} />
            {/* AI Agent Pages */}
            <Route path="scriptsmith-pro" element={<Suspense fallback={<PageLoader />}><ScriptSmithProPage /></Suspense>} />
            <Route path="ai-generator" element={<Suspense fallback={<PageLoader />}><AIGeneratorPage /></Suspense>} />
            <Route path="code-guardian" element={<Suspense fallback={<PageLoader />}><CodeGuardianPage /></Suspense>} />
            <Route path="flowpilot" element={<Suspense fallback={<PageLoader />}><FlowPilotPage /></Suspense>} />
            <Route path="self-healing" element={<Suspense fallback={<PageLoader />}><SelfHealingPage /></Suspense>} />
            <Route path="visual-testing" element={<Suspense fallback={<PageLoader />}><VisualTestingPage /></Suspense>} />
            <Route path="recorder" element={<Suspense fallback={<PageLoader />}><RecorderPage /></Suspense>} />
            <Route path="bug-patterns" element={<Suspense fallback={<PageLoader />}><BugPatternsPage /></Suspense>} />
            <Route path="code-analysis" element={<Suspense fallback={<PageLoader />}><CodeAnalysisPage /></Suspense>} />
            <Route path="test-evolution" element={<Suspense fallback={<PageLoader />}><TestEvolutionPage /></Suspense>} />
            <Route path="testpilot" element={<Suspense fallback={<PageLoader />}><TestPilotPage /></Suspense>} />
            <Route path="flaky-tests" element={<Suspense fallback={<PageLoader />}><FlakyTestsPage /></Suspense>} />
            <Route path="jenkins" element={<Suspense fallback={<PageLoader />}><JenkinsIntegrationsPage /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
            <Route path="approvals" element={<Suspense fallback={<PageLoader />}><ApprovalsPage /></Suspense>} />
            <Route path="audit-logs" element={<Suspense fallback={<PageLoader />}><AuditLogsPage /></Suspense>} />
            <Route path="admin-feedback" element={<Suspense fallback={<PageLoader />}><AdminFeedbackPage /></Suspense>} />
            <Route path="maestrosmith" element={<Suspense fallback={<PageLoader />}><MaestroSmithPage /></Suspense>} />
            <Route path="code-review/:artifactId" element={<Suspense fallback={<PageLoader />}><CodeReviewPage /></Suspense>} />
            <Route path="git-settings" element={<Suspense fallback={<PageLoader />}><GitSettingsPage /></Suspense>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
