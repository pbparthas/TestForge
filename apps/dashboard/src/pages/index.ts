/**
 * Pages Index — Lazy-loaded for code splitting
 */

import { lazy } from 'react';

export const LoginPage = lazy(() => import('./Login').then(m => ({ default: m.LoginPage })));
export const DashboardPage = lazy(() => import('./Dashboard').then(m => ({ default: m.DashboardPage })));
export const TestCasesPage = lazy(() => import('./TestCases').then(m => ({ default: m.TestCasesPage })));
export const TestSuitesPage = lazy(() => import('./TestSuites').then(m => ({ default: m.TestSuitesPage })));
export const RequirementsPage = lazy(() => import('./Requirements').then(m => ({ default: m.RequirementsPage })));
export const ExecutionsPage = lazy(() => import('./Executions').then(m => ({ default: m.ExecutionsPage })));
export const BugsPage = lazy(() => import('./Bugs').then(m => ({ default: m.BugsPage })));
export const CoveragePage = lazy(() => import('./Coverage').then(m => ({ default: m.CoveragePage })));

// AI Agent Pages
export const ScriptSmithProPage = lazy(() => import('./ScriptSmithPro').then(m => ({ default: m.ScriptSmithProPage })));
export const AIGeneratorPage = lazy(() => import('./AIGenerator').then(m => ({ default: m.AIGeneratorPage })));
export const CodeGuardianPage = lazy(() => import('./CodeGuardian').then(m => ({ default: m.CodeGuardianPage })));
export const FlowPilotPage = lazy(() => import('./FlowPilot').then(m => ({ default: m.FlowPilotPage })));
export const SelfHealingPage = lazy(() => import('./SelfHealing').then(m => ({ default: m.SelfHealingPage })));
export const VisualTestingPage = lazy(() => import('./VisualTesting').then(m => ({ default: m.VisualTestingPage })));
export const RecorderPage = lazy(() => import('./Recorder').then(m => ({ default: m.RecorderPage })));
export const BugPatternsPage = lazy(() => import('./BugPatterns').then(m => ({ default: m.BugPatternsPage })));
export const CodeAnalysisPage = lazy(() => import('./CodeAnalysis').then(m => ({ default: m.CodeAnalysisPage })));
export const TestEvolutionPage = lazy(() => import('./TestEvolution').then(m => ({ default: m.TestEvolutionPage })));
export const TestPilotPage = lazy(() => import('./TestPilot').then(m => ({ default: m.TestPilotPage })));
export const FlakyTestsPage = lazy(() => import('./FlakyTests').then(m => ({ default: m.FlakyTestsPage })));
export const JenkinsIntegrationsPage = lazy(() => import('./JenkinsIntegrations').then(m => ({ default: m.JenkinsIntegrationsPage })));
export const ReportsPage = lazy(() => import('./Reports').then(m => ({ default: m.ReportsPage })));
export const ApprovalsPage = lazy(() => import('./Approvals').then(m => ({ default: m.ApprovalsPage })));
export const AuditLogsPage = lazy(() => import('./AuditLogs').then(m => ({ default: m.AuditLogsPage })));
export const AdminFeedbackPage = lazy(() => import('./AdminFeedback').then(m => ({ default: m.AdminFeedbackPage })));
export const MaestroSmithPage = lazy(() => import('./MaestroSmith').then(m => ({ default: m.MaestroSmithPage })));
export const CodeReviewPage = lazy(() => import('./CodeReview').then(m => ({ default: m.CodeReviewPage })));
export const GitSettingsPage = lazy(() => import('./GitSettings').then(m => ({ default: m.GitSettingsPage })));
