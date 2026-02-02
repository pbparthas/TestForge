/**
 * API Client
 * Centralized HTTP client with auth handling
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(identifier: string, password: string) {
    const { data } = await this.client.post('/auth/login', { identifier, password });
    return data;
  }

  async register(email: string, username: string, password: string, name: string) {
    const { data } = await this.client.post('/auth/register', { email, username, password, name });
    return data;
  }

  async getMe() {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  // Projects
  async getProjects(page = 1, limit = 10) {
    const { data } = await this.client.get('/projects', { params: { page, limit } });
    return data;
  }

  async getProject(id: string) {
    const { data } = await this.client.get(`/projects/${id}`);
    return data;
  }

  async createProject(project: { name: string; description?: string; framework?: string; language?: string }) {
    const { data } = await this.client.post('/projects', project);
    return data;
  }

  // Test Cases
  async getTestCases(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/test-cases', { params: { page, limit, projectId } });
    return data;
  }

  async getTestCase(id: string) {
    const { data } = await this.client.get(`/test-cases/${id}`);
    return data;
  }

  async createTestCase(testCase: { projectId: string; title: string; description?: string; steps?: unknown[] }) {
    const { data } = await this.client.post('/test-cases', testCase);
    return data;
  }

  async updateTestCase(id: string, updates: Record<string, unknown>) {
    const { data } = await this.client.patch(`/test-cases/${id}`, updates);
    return data;
  }

  // Test Suites
  async getTestSuites(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/test-suites', { params: { page, limit, projectId } });
    return data;
  }

  async getTestSuite(id: string) {
    const { data } = await this.client.get(`/test-suites/${id}`);
    return data;
  }

  async getTestSuiteWithCases(id: string) {
    const { data } = await this.client.get(`/test-suites/${id}/with-cases`);
    return data;
  }

  async createTestSuite(suite: { projectId: string; name: string; description?: string; tags?: string[] }) {
    const { data } = await this.client.post('/test-suites', suite);
    return data;
  }

  async updateTestSuite(id: string, updates: Record<string, unknown>) {
    const { data } = await this.client.patch(`/test-suites/${id}`, updates);
    return data;
  }

  async duplicateTestSuite(id: string) {
    const { data } = await this.client.post(`/test-suites/${id}/duplicate`);
    return data;
  }

  // Requirements
  async getRequirements(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/requirements', { params: { page, limit, projectId } });
    return data;
  }

  async getRequirement(id: string) {
    const { data } = await this.client.get(`/requirements/${id}`);
    return data;
  }

  async createRequirement(requirement: { projectId: string; title: string; description?: string; priority?: string; source?: string; externalId?: string }) {
    const { data } = await this.client.post('/requirements', requirement);
    return data;
  }

  async updateRequirement(id: string, updates: Record<string, unknown>) {
    const { data } = await this.client.patch(`/requirements/${id}`, updates);
    return data;
  }

  // Executions
  async getExecutions(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/executions', { params: { page, limit, projectId } });
    return data;
  }

  async triggerExecution(projectId: string, suiteId?: string) {
    const { data } = await this.client.post('/executions/trigger', { projectId, suiteId });
    return data;
  }

  async getExecutionStats(projectId: string, days = 30) {
    const { data } = await this.client.get(`/executions/project/${projectId}/stats`, { params: { days } });
    return data;
  }

  // Traceability
  async getCoverage(projectId: string) {
    const { data } = await this.client.get(`/traceability/coverage/${projectId}`);
    return data;
  }

  async getCoverageGaps(projectId: string) {
    const { data } = await this.client.get(`/traceability/gaps/${projectId}`);
    return data;
  }

  // Bugs
  async getBugs(page = 1, limit = 10, projectId?: string) {
    const { data } = await this.client.get('/bugs', { params: { page, limit, projectId } });
    return data;
  }

  async getBugStats(projectId: string) {
    const { data } = await this.client.get(`/bugs/project/${projectId}/stats`);
    return data;
  }

  // AI Agents
  async generateTestCases(projectId: string, specification: string, inputMethod = 'natural_language') {
    const { data } = await this.client.post('/ai/test-weaver/generate', { projectId, specification, inputMethod });
    return data;
  }

  async generateScript(projectId: string, testCase: { title: string; steps: unknown[] }) {
    const { data } = await this.client.post('/ai/script-smith/generate', { projectId, inputMethod: 'test_case', testCase });
    return data;
  }

  async getAiUsageSummary(projectId: string) {
    const { data } = await this.client.get(`/ai/usage/summary/${projectId}`);
    return data;
  }

  async getAiDailyCosts(projectId: string, days = 30) {
    const { data } = await this.client.get(`/ai/usage/daily/${projectId}`, { params: { days } });
    return data;
  }

  // Framework Agent
  async analyzeFramework(projectId: string, codeSnippet: string, language: string) {
    const { data } = await this.client.post('/ai/framework/analyze', { projectId, codeSnippet, language });
    return data;
  }

  async reviewCode(projectId: string, codeSnippet: string, language: string, reviewType: string) {
    const { data } = await this.client.post('/ai/framework/review', { projectId, codeSnippet, language, reviewType });
    return data;
  }

  // Self-Healing Agent
  async diagnoseFailure(projectId: string, testCaseId: string, errorMessage: string, screenshot?: string) {
    const { data } = await this.client.post('/ai/self-healing/diagnose', { projectId, testCaseId, errorMessage, screenshot });
    return data;
  }

  async fixLocator(projectId: string, testCaseId: string, oldLocator: string, pageHtml?: string) {
    const { data } = await this.client.post('/ai/self-healing/fix', { projectId, testCaseId, oldLocator, pageHtml });
    return data;
  }

  // FlowPilot Agent
  async generateApiTests(projectId: string, openApiSpec: string, endpoints?: string[]) {
    const { data } = await this.client.post('/ai/flow-pilot/generate', { projectId, openApiSpec, endpoints });
    return data;
  }

  async generateApiChain(projectId: string, userFlow: string, endpoints: { method: string; path: string; description: string }[]) {
    const { data } = await this.client.post('/ai/flow-pilot/chain', { projectId, userFlow, endpoints });
    return data;
  }

  // CodeGuardian Agent
  async generateUnitTests(projectId: string, sourceCode: string, language: string, framework?: string) {
    const { data } = await this.client.post('/ai/code-guardian/generate', { projectId, sourceCode, language, framework });
    return data;
  }

  async analyzeTestCoverage(projectId: string, sourceCode: string, existingTests: string) {
    const { data } = await this.client.post('/ai/code-guardian/analyze', { projectId, sourceCode, existingTests });
    return data;
  }

  // Bugs - Create
  async createBug(bug: { projectId: string; title: string; description?: string; priority?: string; linkedTestCaseId?: string }) {
    const { data } = await this.client.post('/bugs', bug);
    return data;
  }

  async updateBug(id: string, updates: Record<string, unknown>) {
    const { data } = await this.client.patch(`/bugs/${id}`, updates);
    return data;
  }

  // TestWeaver - Evolve test cases
  async evolveTestCases(projectId: string, existingTests: string, feedback: string) {
    const { data } = await this.client.post('/ai/test-weaver/evolve', { projectId, existingTests, feedback });
    return data;
  }

  // FlowPilot - Validate API flow
  async validateApiFlow(projectId: string, apiFlow: string, baseUrl?: string) {
    const { data } = await this.client.post('/ai/flow-pilot/validate', { projectId, apiFlow, baseUrl });
    return data;
  }

  // ==========================================================================
  // ScriptSmith Sessions (Sprint 13)
  // ==========================================================================

  // Create a new ScriptSmith session
  async createScriptSmithSession(input: {
    projectId?: string;
    inputMethod: 'record' | 'upload' | 'screenshot' | 'describe' | 'edit';
    projectPath?: string;
    deviceType?: string;
    deviceConfig?: Record<string, unknown>;
  }) {
    const { data } = await this.client.post('/scriptsmith/sessions', input);
    return data;
  }

  // Get user's ScriptSmith sessions
  async getScriptSmithSessions(params?: {
    page?: number;
    limit?: number;
    projectId?: string;
    status?: string;
    inputMethod?: string;
  }) {
    const { data } = await this.client.get('/scriptsmith/sessions', { params });
    return data;
  }

  // Get a specific session with files
  async getScriptSmithSession(sessionId: string) {
    const { data } = await this.client.get(`/scriptsmith/sessions/${sessionId}`);
    return data;
  }

  // Update session input (Step 2)
  async updateScriptSmithSessionInput(sessionId: string, input: Record<string, unknown>) {
    const { data } = await this.client.post(`/scriptsmith/sessions/${sessionId}/input`, input);
    return data;
  }

  // Transform session (Step 3)
  async transformScriptSmithSession(sessionId: string, projectId: string, options?: {
    framework?: 'playwright' | 'cypress';
    language?: 'typescript' | 'javascript';
    includePageObjects?: boolean;
    extractUtilities?: boolean;
    waitStrategy?: 'minimal' | 'standard' | 'conservative';
    selectorPreference?: 'role' | 'testid' | 'text' | 'css';
  }) {
    const { data } = await this.client.post(`/scriptsmith/sessions/${sessionId}/transform`, {
      projectId,
      options,
    });
    return data;
  }

  // Save session to framework (Step 4)
  async saveScriptSmithSession(sessionId: string, targetDir: string, overwrite?: boolean) {
    const { data } = await this.client.post(`/scriptsmith/sessions/${sessionId}/save`, {
      targetDir,
      overwrite,
    });
    return data;
  }

  // Delete a session
  async deleteScriptSmithSession(sessionId: string) {
    const { data } = await this.client.delete(`/scriptsmith/sessions/${sessionId}`);
    return data;
  }

  // Analyze project framework structure (ScriptSmith)
  async analyzeProjectFramework(projectPath: string) {
    const { data } = await this.client.post('/scriptsmith/analyze-framework', { projectPath });
    return data;
  }

  // Generic HTTP methods for Sprint 8 features
  async post<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<{ data: T }> {
    const { data } = await this.client.post(path, body);
    return { data };
  }

  async get<T = Record<string, unknown>>(path: string, params?: Record<string, unknown>): Promise<{ data: T }> {
    const { data } = await this.client.get(path, { params });
    return { data };
  }

  async delete<T = Record<string, unknown>>(path: string): Promise<{ data: T }> {
    const { data } = await this.client.delete(path);
    return { data };
  }

  async patch<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<{ data: T }> {
    const { data } = await this.client.patch(path, body);
    return { data };
  }

  // ==========================================================================
  // Flaky Tests (Sprint 14)
  // ==========================================================================

  // Get flaky tests for a project
  async getFlakyTests(projectId: string, params?: {
    threshold?: number;
    isQuarantined?: boolean;
    fixStatus?: string;
    patternType?: string;
  }) {
    const { data } = await this.client.get(`/flaky/${projectId}`, { params });
    return data;
  }

  // Get flaky test summary for a project
  async getFlakyTestSummary(projectId: string) {
    const { data } = await this.client.get(`/flaky/${projectId}/summary`);
    return data;
  }

  // Get flaky test trends
  async getFlakyTestTrends(projectId: string, days = 30) {
    const { data } = await this.client.get(`/flaky/${projectId}/trends`, { params: { days } });
    return data;
  }

  // Get quarantined tests
  async getQuarantinedTests(projectId: string) {
    const { data } = await this.client.get(`/flaky/${projectId}/quarantined`);
    return data;
  }

  // Get detected patterns
  async getFlakyPatterns(projectId: string) {
    const { data } = await this.client.get(`/flaky/${projectId}/patterns`);
    return data;
  }

  // Get single flaky test
  async getFlakyTest(id: string) {
    const { data } = await this.client.get(`/flaky/test/${id}`);
    return data;
  }

  // Quarantine a test
  async quarantineTest(id: string, reason: string) {
    const { data } = await this.client.post(`/flaky/test/${id}/quarantine`, { reason });
    return data;
  }

  // Unquarantine a test
  async unquarantineTest(id: string) {
    const { data } = await this.client.post(`/flaky/test/${id}/unquarantine`);
    return data;
  }

  // Update fix status
  async updateFlakyFixStatus(id: string, status: string) {
    const { data } = await this.client.post(`/flaky/test/${id}/fix-status`, { status });
    return data;
  }

  // Mark test as fixed
  async markTestAsFixed(id: string) {
    const { data } = await this.client.post(`/flaky/test/${id}/mark-fixed`);
    return data;
  }

  // Update pattern type
  async updateFlakyPatternType(id: string, patternType: string) {
    const { data } = await this.client.post(`/flaky/test/${id}/pattern`, { patternType });
    return data;
  }

  // Reset test metrics
  async resetFlakyMetrics(id: string) {
    const { data } = await this.client.post(`/flaky/test/${id}/reset`);
    return data;
  }

  // AI Analysis - Root cause analysis
  async analyzeRootCause(input: {
    testName: string;
    testCode: string;
    executionHistory: Array<{
      executionId: string;
      timestamp: string;
      status: 'passed' | 'failed';
      duration: number;
      errorMessage?: string;
    }>;
    flakinessScore: number;
    recentErrors: string[];
  }) {
    const { data } = await this.client.post('/flaky/ai/analyze', input);
    return data;
  }

  // AI Analysis - Detect patterns
  async detectFlakyPatterns(projectId: string, flakyTests: Array<{
    testName: string;
    flakinessScore: number;
    totalRuns: number;
    passRate: number;
    recentErrors: string[];
  }>) {
    const { data } = await this.client.post('/flaky/ai/patterns', { projectId, flakyTests });
    return data;
  }

  // AI Analysis - Generate report
  async generateFlakyReport(input: {
    projectId: string;
    projectName: string;
    flakyTests: Array<{
      testName: string;
      flakinessScore: number;
      patternType: string | null;
      isQuarantined: boolean;
      fixStatus: string;
    }>;
    patterns: Array<{
      patternType: string;
      description: string;
      affectedCount: number;
    }>;
    trends: {
      totalFlaky: number;
      newFlaky: number;
      fixed: number;
      quarantined: number;
      avgScore: number;
    };
  }) {
    const { data } = await this.client.post('/flaky/ai/report', input);
    return data;
  }

  // AI Analysis - Suggest fix
  async suggestFlakyFix(input: {
    testName: string;
    testCode: string;
    patternType: string;
    errorMessages: string[];
  }) {
    const { data } = await this.client.post('/flaky/ai/suggest-fix', input);
    return data;
  }

  // AI Analysis - Classify pattern
  async classifyFlakyPattern(testName: string, errorMessages: string[]) {
    const { data } = await this.client.post('/flaky/ai/classify', { testName, errorMessages });
    return data;
  }

  // ==========================================================================
  // Duplicate Detection (Sprint 14)
  // ==========================================================================

  // Check test case for duplicates
  async checkTestCaseDuplicate(content: string, projectId: string, testCaseId?: string) {
    const { data } = await this.client.post('/duplicate/test-case', { content, projectId, testCaseId });
    return data;
  }

  // Check script for duplicates
  async checkScriptDuplicate(code: string, projectId: string, scriptId?: string) {
    const { data } = await this.client.post('/duplicate/script', { code, projectId, scriptId });
    return data;
  }

  // Check session for duplicates
  async checkSessionDuplicate(sessionId: string) {
    const { data } = await this.client.post(`/duplicate/session/${sessionId}`);
    return data;
  }

  // Get duplicate check by ID
  async getDuplicateCheck(id: string) {
    const { data } = await this.client.get(`/duplicate/check/${id}`);
    return data;
  }

  // Get duplicate checks for project
  async getProjectDuplicateChecks(projectId: string, limit = 50) {
    const { data } = await this.client.get(`/duplicate/project/${projectId}`, { params: { limit } });
    return data;
  }

  // ==========================================================================
  // Jenkins Integration (Sprint 15)
  // ==========================================================================

  // Create Jenkins integration
  async createJenkinsIntegration(integration: {
    projectId: string;
    integrationName: string;
    serverUrl: string;
    username: string;
    apiToken: string;
    jobPath: string;
    defaultEnvironment?: string;
    defaultBrowser?: string;
    buildParameters?: Record<string, unknown>;
  }) {
    const { data } = await this.client.post('/jenkins/integrations', integration);
    return data;
  }

  // Get project integrations
  async getProjectJenkinsIntegrations(projectId: string, isActive?: boolean) {
    const { data } = await this.client.get(`/jenkins/integrations/${projectId}`, {
      params: isActive !== undefined ? { isActive } : undefined,
    });
    return data;
  }

  // Get single integration
  async getJenkinsIntegration(id: string) {
    const { data } = await this.client.get(`/jenkins/integration/${id}`);
    return data;
  }

  // Update integration
  async updateJenkinsIntegration(id: string, updates: {
    integrationName?: string;
    serverUrl?: string;
    username?: string;
    apiToken?: string;
    jobPath?: string;
    defaultEnvironment?: string;
    defaultBrowser?: string;
    buildParameters?: Record<string, unknown>;
    isActive?: boolean;
  }) {
    const { data } = await this.client.put(`/jenkins/integration/${id}`, updates);
    return data;
  }

  // Delete integration
  async deleteJenkinsIntegration(id: string) {
    const { data } = await this.client.delete(`/jenkins/integration/${id}`);
    return data;
  }

  // Test connection
  async testJenkinsConnection(params: {
    serverUrl: string;
    username: string;
    apiToken: string;
  }) {
    const { data } = await this.client.post('/jenkins/test-connection', params);
    return data;
  }

  // Trigger build
  async triggerJenkinsBuild(integrationId: string, params?: {
    environment?: string;
    browser?: string;
    testSuiteId?: string;
    testCaseIds?: string[];
    customParams?: Record<string, string>;
    executionId?: string;
  }) {
    const { data } = await this.client.post(`/jenkins/integration/${integrationId}/trigger`, params || {});
    return data;
  }

  // Get integration builds
  async getJenkinsBuilds(integrationId: string, params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const { data } = await this.client.get(`/jenkins/integration/${integrationId}/builds`, { params });
    return data;
  }

  // Get single build
  async getJenkinsBuild(buildId: string) {
    const { data } = await this.client.get(`/jenkins/build/${buildId}`);
    return data;
  }

  // Poll build status
  async pollJenkinsBuildStatus(buildId: string) {
    const { data } = await this.client.post(`/jenkins/build/${buildId}/poll`);
    return data;
  }

  // Get console log
  async getJenkinsBuildConsoleLog(buildId: string) {
    const { data } = await this.client.get(`/jenkins/build/${buildId}/console`);
    return data;
  }

  // ===========================================================================
  // Chat API (Sprint 16)
  // ===========================================================================

  // Create conversation
  async createConversation(input: {
    projectId?: string;
    contextType?: string;
    contextId?: string;
    title?: string;
    category?: 'help_question' | 'feature_request' | 'bug_report';
  }) {
    const { data } = await this.client.post('/chat/conversations', input);
    return data;
  }

  // Get user conversations
  async getConversations(params?: {
    status?: string;
    category?: string;
    projectId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { data } = await this.client.get('/chat/conversations', { params });
    return data;
  }

  // Get single conversation
  async getConversation(id: string) {
    const { data } = await this.client.get(`/chat/conversations/${id}`);
    return data;
  }

  // Update conversation
  async updateConversation(id: string, input: { title?: string; status?: string }) {
    const { data } = await this.client.patch(`/chat/conversations/${id}`, input);
    return data;
  }

  // Delete conversation
  async deleteConversation(id: string) {
    const { data } = await this.client.delete(`/chat/conversations/${id}`);
    return data;
  }

  // Send message
  async sendMessage(conversationId: string, content: string) {
    const { data } = await this.client.post(`/chat/conversations/${conversationId}/messages`, { content });
    return data;
  }

  // Get messages
  async getMessages(conversationId: string, params?: { limit?: number; offset?: number }) {
    const { data } = await this.client.get(`/chat/conversations/${conversationId}/messages`, { params });
    return data;
  }

  // Get suggestions
  async getSuggestions(conversationId: string, params?: { status?: string }) {
    const { data } = await this.client.get(`/chat/conversations/${conversationId}/suggestions`, { params });
    return data;
  }

  // Acknowledge suggestion
  async acknowledgeSuggestion(suggestionId: string) {
    const { data } = await this.client.post(`/chat/suggestions/${suggestionId}/acknowledge`);
    return data;
  }

  // Dismiss suggestion
  async dismissSuggestion(suggestionId: string) {
    const { data } = await this.client.post(`/chat/suggestions/${suggestionId}/dismiss`);
    return data;
  }

  // Get contextual help
  async getContextualHelp(contextType: string) {
    const { data } = await this.client.get(`/chat/help/${contextType}`);
    return data;
  }

  // Search help
  async searchHelp(query?: string) {
    const { data } = await this.client.get('/chat/help', { params: { q: query } });
    return data;
  }

  // ===========================================================================
  // Help/Feedback API (Sprint 16)
  // ===========================================================================

  // Submit feedback
  async submitFeedback(input: {
    feedbackType: 'bug' | 'feature' | 'question' | 'other';
    content: string;
    pageContext?: string;
    screenshotUrl?: string;
  }) {
    const { data } = await this.client.post('/help/feedback', input);
    return data;
  }

  // Get user's feedback
  async getMyFeedback(params?: {
    status?: string;
    feedbackType?: string;
    limit?: number;
    offset?: number;
  }) {
    const { data } = await this.client.get('/help/feedback/me', { params });
    return data;
  }

  // Get all feedback (admin)
  async getAllFeedback(params?: {
    status?: string;
    feedbackType?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { data } = await this.client.get('/help/feedback', { params });
    return data;
  }

  // Get feedback stats (admin)
  async getFeedbackStats() {
    const { data } = await this.client.get('/help/feedback/stats');
    return data;
  }

  // Update feedback status (admin)
  async updateFeedbackStatus(id: string, status: 'new_feedback' | 'reviewed' | 'resolved') {
    const { data } = await this.client.patch(`/help/feedback/${id}`, { status });
    return data;
  }

  // Delete feedback (admin)
  async deleteFeedback(id: string) {
    const { data } = await this.client.delete(`/help/feedback/${id}`);
    return data;
  }

  // ===========================================================================
  // Reports API (Sprint 17)
  // ===========================================================================

  // Generate report
  async generateReport(input: {
    projectId: string;
    type: 'execution_summary' | 'coverage' | 'flaky_analysis' | 'trend' | 'ai_cost' | 'custom';
    format?: 'pdf' | 'excel' | 'json';
    title?: string;
    description?: string;
    executionId?: string;
    templateId?: string;
    parameters?: {
      dateRange?: { startDate: string; endDate: string };
      trendDays?: number;
      includeFlaky?: boolean;
      includeCoverage?: boolean;
      includeTrends?: boolean;
    };
  }) {
    const { data } = await this.client.post('/reports/generate', input);
    return data;
  }

  // Get reports
  async getReports(params?: {
    page?: number;
    limit?: number;
    projectId?: string;
    type?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { data } = await this.client.get('/reports', { params });
    return data;
  }

  // Get single report
  async getReport(id: string) {
    const { data } = await this.client.get(`/reports/${id}`);
    return data;
  }

  // Download report
  async downloadReport(id: string) {
    const response = await this.client.get(`/reports/${id}/download`, { responseType: 'blob' });
    return response;
  }

  // Delete report
  async deleteReport(id: string) {
    const { data } = await this.client.delete(`/reports/${id}`);
    return data;
  }

  // Create template
  async createReportTemplate(input: {
    projectId: string;
    name: string;
    description?: string;
    type: 'execution_summary' | 'coverage' | 'flaky_analysis' | 'trend' | 'ai_cost' | 'custom';
    config: {
      sections: Array<{
        id: string;
        type: string;
        title: string;
        enabled: boolean;
        config?: Record<string, unknown>;
      }>;
      filters?: Record<string, unknown>;
      styling?: Record<string, unknown>;
    };
    isDefault?: boolean;
  }) {
    const { data } = await this.client.post('/reports/templates', input);
    return data;
  }

  // Get templates
  async getReportTemplates(projectId: string) {
    const { data } = await this.client.get('/reports/templates', { params: { projectId } });
    return data;
  }

  // Get template
  async getReportTemplate(id: string) {
    const { data } = await this.client.get(`/reports/templates/${id}`);
    return data;
  }

  // Update template
  async updateReportTemplate(id: string, input: {
    name?: string;
    description?: string;
    config?: Record<string, unknown>;
    isDefault?: boolean;
  }) {
    const { data } = await this.client.put(`/reports/templates/${id}`, input);
    return data;
  }

  // Delete template
  async deleteReportTemplate(id: string) {
    const { data } = await this.client.delete(`/reports/templates/${id}`);
    return data;
  }

  // Create schedule
  async createReportSchedule(input: {
    projectId: string;
    templateId: string;
    name: string;
    cronExpression: string;
    timezone?: string;
    format?: 'pdf' | 'excel' | 'json';
    parameters?: Record<string, unknown>;
    recipients?: string[];
  }) {
    const { data } = await this.client.post('/reports/schedules', input);
    return data;
  }

  // Get schedules
  async getReportSchedules(projectId: string) {
    const { data } = await this.client.get('/reports/schedules', { params: { projectId } });
    return data;
  }

  // Get schedule
  async getReportSchedule(id: string) {
    const { data } = await this.client.get(`/reports/schedules/${id}`);
    return data;
  }

  // Update schedule
  async updateReportSchedule(id: string, input: {
    name?: string;
    cronExpression?: string;
    format?: 'pdf' | 'excel' | 'json';
    recipients?: string[];
    isActive?: boolean;
  }) {
    const { data } = await this.client.put(`/reports/schedules/${id}`, input);
    return data;
  }

  // Delete schedule
  async deleteReportSchedule(id: string) {
    const { data } = await this.client.delete(`/reports/schedules/${id}`);
    return data;
  }

  // Trigger scheduled report
  async triggerScheduledReport(id: string) {
    const { data } = await this.client.post(`/reports/schedules/${id}/run`);
    return data;
  }

  // ===========================================================================
  // Quality Gates API (Sprint 17)
  // ===========================================================================

  // Create quality gate
  async createQualityGate(input: {
    projectId: string;
    name: string;
    description?: string;
    isDefault?: boolean;
    failOnBreach?: boolean;
    conditions: Array<{
      metric: 'pass_rate' | 'coverage' | 'flakiness' | 'duration' | 'failed_count' | 'critical_failures';
      operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq';
      threshold: number;
      severity?: 'error' | 'warning';
      description?: string;
    }>;
  }) {
    const { data } = await this.client.post('/quality-gates', input);
    return data;
  }

  // Get quality gates
  async getQualityGates(params?: {
    page?: number;
    limit?: number;
    projectId?: string;
    isActive?: boolean;
  }) {
    const { data } = await this.client.get('/quality-gates', { params });
    return data;
  }

  // Get quality gate
  async getQualityGate(id: string) {
    const { data } = await this.client.get(`/quality-gates/${id}`);
    return data;
  }

  // Get project quality gates
  async getProjectQualityGates(projectId: string) {
    const { data } = await this.client.get(`/quality-gates/project/${projectId}`);
    return data;
  }

  // Get project quality summary
  async getQualityGateSummary(projectId: string, days?: number) {
    const { data } = await this.client.get(`/quality-gates/project/${projectId}/summary`, {
      params: days ? { days } : undefined,
    });
    return data;
  }

  // Update quality gate
  async updateQualityGate(id: string, input: {
    name?: string;
    description?: string;
    isDefault?: boolean;
    isActive?: boolean;
    failOnBreach?: boolean;
    conditions?: Array<{
      metric: 'pass_rate' | 'coverage' | 'flakiness' | 'duration' | 'failed_count' | 'critical_failures';
      operator: 'gte' | 'lte' | 'gt' | 'lt' | 'eq';
      threshold: number;
      severity?: 'error' | 'warning';
    }>;
  }) {
    const { data } = await this.client.put(`/quality-gates/${id}`, input);
    return data;
  }

  // Delete quality gate
  async deleteQualityGate(id: string) {
    const { data } = await this.client.delete(`/quality-gates/${id}`);
    return data;
  }

  // Set quality gate as default
  async setDefaultQualityGate(id: string) {
    const { data } = await this.client.post(`/quality-gates/${id}/set-default`);
    return data;
  }

  // Evaluate execution against quality gate
  async evaluateQualityGate(executionId: string, qualityGateId?: string) {
    const { data } = await this.client.post('/quality-gates/evaluate', {
      executionId,
      qualityGateId,
    });
    return data;
  }

  // Get execution evaluations
  async getExecutionEvaluations(executionId: string) {
    const { data } = await this.client.get(`/quality-gates/evaluations/${executionId}`);
    return data;
  }

  // ============================================================================
  // HITL APPROVAL WORKFLOWS (Sprint 18)
  // ============================================================================

  // Get artifacts
  async getArtifacts(params: {
    page?: number;
    limit?: number;
    projectId?: string;
    type?: string;
    state?: string;
    riskLevel?: string;
  } = {}) {
    const { data } = await this.client.get('/approvals/artifacts', { params });
    return data;
  }

  // Get artifact by ID
  async getArtifact(id: string) {
    const { data } = await this.client.get(`/approvals/artifacts/${id}`);
    return data;
  }

  // Create artifact
  async createArtifact(input: {
    projectId: string;
    type: 'test_case' | 'script' | 'bug_analysis' | 'chat_suggestion' | 'self_healing_fix';
    title: string;
    description?: string;
    content: Record<string, unknown>;
    sourceAgent: string;
    aiConfidenceScore?: number;
  }) {
    const { data } = await this.client.post('/approvals/artifacts', input);
    return data;
  }

  // Delete artifact
  async deleteArtifact(id: string) {
    const { data } = await this.client.delete(`/approvals/artifacts/${id}`);
    return data;
  }

  // Submit artifact for review
  async submitArtifact(id: string, comment?: string) {
    const { data } = await this.client.post(`/approvals/artifacts/${id}/submit`, { comment });
    return data;
  }

  // Claim artifact for review
  async claimArtifact(id: string) {
    const { data } = await this.client.post(`/approvals/artifacts/${id}/claim`);
    return data;
  }

  // Approve artifact
  async approveArtifact(id: string, comment?: string) {
    const { data } = await this.client.post(`/approvals/artifacts/${id}/approve`, { comment });
    return data;
  }

  // Reject artifact
  async rejectArtifact(id: string, comment: string, feedback: Array<{
    category: string;
    severity: string;
    description: string;
    suggestedFix?: string;
  }>) {
    const { data } = await this.client.post(`/approvals/artifacts/${id}/reject`, { comment, feedback });
    return data;
  }

  // Revise artifact
  async reviseArtifact(id: string, content: Record<string, unknown>, comment?: string) {
    const { data } = await this.client.post(`/approvals/artifacts/${id}/revise`, { content, comment });
    return data;
  }

  // Archive artifact
  async archiveArtifact(id: string, reason?: string) {
    const { data } = await this.client.post(`/approvals/artifacts/${id}/archive`, { reason });
    return data;
  }

  // Get review queue
  async getReviewQueue() {
    const { data } = await this.client.get('/approvals/queue');
    return data;
  }

  // Get artifact history
  async getArtifactHistory(id: string) {
    const { data } = await this.client.get(`/approvals/artifacts/${id}/history`);
    return data;
  }

  // Get artifact feedback
  async getArtifactFeedback(id: string) {
    const { data } = await this.client.get(`/approvals/artifacts/${id}/feedback`);
    return data;
  }

  // Get SLA status
  async getSLAStatus(artifactId: string) {
    const { data } = await this.client.get(`/approvals/sla/${artifactId}`);
    return data;
  }

  // Get approaching SLAs
  async getApproachingSLAs(projectId?: string) {
    const { data } = await this.client.get('/approvals/sla/approaching', { params: { projectId } });
    return data;
  }

  // Get breached SLAs
  async getBreachedSLAs(projectId?: string) {
    const { data } = await this.client.get('/approvals/sla/breached', { params: { projectId } });
    return data;
  }

  // Escalate SLA
  async escalateSLA(artifactId: string, reason: string) {
    const { data } = await this.client.post(`/approvals/sla/${artifactId}/escalate`, { reason });
    return data;
  }

  // Get approval settings
  async getApprovalSettings(projectId: string) {
    const { data } = await this.client.get(`/approvals/settings/${projectId}`);
    return data;
  }

  // Update approval settings
  async updateApprovalSettings(projectId: string, settings: Record<string, unknown>) {
    const { data } = await this.client.put(`/approvals/settings/${projectId}`, settings);
    return data;
  }
}

export const api = new ApiClient();
