/**
 * Hooks Index
 */

export { useExecutionPolling, useMultiExecutionPolling, type ExecutionStatus } from './useExecutionPolling';
export {
  queryKeys,
  // Core entities
  useTestCases,
  useCreateTestCase,
  useUpdateTestCase,
  useTestSuites,
  useCreateTestSuite,
  useUpdateTestSuite,
  useDuplicateTestSuite,
  useRequirements,
  useCreateRequirement,
  useUpdateRequirement,
  useExecutions,
  useEnvironments,
  useExecutionTestSuites,
  useTriggerExecution,
  useBugs,
  useProjects,
  // Dashboard
  useDashboardStats,
  // Coverage
  useCoverage,
  useCoverageGaps,
  // Flaky Tests
  useFlakyTests,
  useFlakySummary,
  useFlakyPatterns,
  useFlakyTrends,
  useQuarantineTest,
  useUnquarantineTest,
  useMarkTestFixed,
  // Audit Logs
  useAuditLogs,
  // Reports & Quality Gates
  useReports,
  useReportTemplates,
  useReportSchedules,
  useQualityGates,
  useQualityGateSummary,
  useGenerateReport,
  useDeleteReport,
  useCreateQualityGate,
  useSetDefaultQualityGate,
  useDeleteQualityGate,
  // Approvals
  useReviewQueue,
  useArtifacts,
  useClaimArtifact,
  useApproveArtifact,
  useRejectArtifact,
  // Jenkins
  useJenkinsIntegrations,
  useJenkinsBuilds,
  useCreateJenkinsIntegration,
  useUpdateJenkinsIntegration,
  useDeleteJenkinsIntegration,
  useTriggerJenkinsBuild,
  // Admin Feedback
  useAdminConversations,
  useConversation,
  useAdminReply,
  useUpdateConversationStatus,
  // ScriptSmith
  useScriptSmithSessions,
  useCreateScriptSmithSession,
  useDeleteScriptSmithSession,
  useUpdateScriptSmithInput,
  useTransformScriptSmithSession,
  useSaveScriptSmithSession,
  // AI Generator (TestWeaver)
  useGenerateTestWeaver,
  useBatchTestWeaver,
  useEvolveTestCases,
  // CodeGuardian
  useGenerateUnitTests,
  // Self-Healing
  useDiagnoseFailure,
  useFixLocator,
  // Recorder
  useRecorderConvert,
  useRecorderOptimize,
  useRecorderAssertions,
  useRecorderProcess,
  // Visual Testing
  useVisualCompare,
  useVisualAnalyzeRegression,
  useVisualDetectElements,
  useVisualGenerateTestCase,
  // Bug Patterns
  useBugPatternAnalyze,
  useBugPatternRootCause,
  useBugPatternPredict,
  useBugPatternReport,
  useBugPatternCluster,
  // Code Analysis
  useCodeAnalysisComplexity,
  useCodeAnalysisArchitecture,
  useCodeAnalysisBestPractices,
  useCodeAnalysisTechnicalDebt,
  // Test Evolution
  useTestEvolutionHealth,
  useTestEvolutionCoverage,
  useTestEvolutionStale,
  useTestEvolutionRisk,
  // TestPilot
  useTestPilotWorkflows,
  useTestPilotExecutions,
  useTestPilotCustomWorkflows,
  useTestPilotEstimate,
  useTestPilotExecute,
  useCreateTestPilotWorkflow,
  useDeleteTestPilotWorkflow,
} from './queries';
