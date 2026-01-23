# QualityPilot Parity - Sprint Implementation Plan

**Created**: 2026-01-20
**Reference**: QP_VS_TF_COMPREHENSIVE_AUDIT.md
**Methodology**: TDD-First, Incremental Delivery
**Total Sprints**: 8 (covering P0, P1, P2 priorities)

---

## Executive Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           QP PARITY IMPLEMENTATION TIMELINE                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ Sprint 13  │ Sprint 14  │ Sprint 15  │ Sprint 16  │ Sprint 17  │ Sprint 18  │ Sprint 19 │
│ScriptSmith │  Flaky &   │   CI/CD    │   Chat &   │  Reports   │   HITL     │  Advanced │
│   Pro+     │ Duplicate  │ Integration│    Help    │ & Quality  │ Approvals  │  Features │
├────────────┼────────────┼────────────┼────────────┼────────────┼────────────┼───────────┤
│    CP13    │    CP14    │    CP15    │    CP16    │    CP17    │    CP18    │   CP19    │
│   P0       │    P0      │    P1      │    P1      │    P2      │    P1      │   P2/P3   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Estimated Duration**: 8 weeks (1 sprint = ~1 week)
**Starting Test Count**: 850 (current)
**Target Test Count**: ~1,200 (350+ new tests)

---

## Dependency Graph

```
                    ┌─────────────────┐
                    │ Sprint 13: SSP+ │
                    │ (ScriptSmith)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
    │ Sprint 14:      │ │ Sprint 15:  │ │ Sprint 16:      │
    │ Flaky+Duplicate │ │ CI/CD       │ │ Chat+Help       │
    └────────┬────────┘ └──────┬──────┘ └────────┬────────┘
             │                 │                  │
             └────────┬────────┴────────┬─────────┘
                      │                 │
                      ▼                 ▼
            ┌─────────────────┐ ┌─────────────────┐
            │ Sprint 17:      │ │ Sprint 18:      │
            │ Reports+Quality │ │ HITL Approvals  │
            └────────┬────────┘ └────────┬────────┘
                     │                   │
                     └─────────┬─────────┘
                               │
                               ▼
                     ┌─────────────────┐
                     │ Sprint 19:      │
                     │ Advanced        │
                     └─────────────────┘
```

---

## Sprint 13: ScriptSmith Pro+ (P0)

**Goal**: Full parity with QP ScriptSmith Pro workflow

**Duration**: 5 days

### What We're Building

Transform TF's stateless ScriptSmith into QP's session-based wizard workflow:

```
CURRENT (TF):                      TARGET (QP Parity):
┌─────────────────────┐           ┌─────────────────────────────────┐
│ Single API call     │           │ Step 1: Choose Method           │
│ → Return code       │    ───►   │ Step 2: Provide Input (session) │
└─────────────────────┘           │ Step 3: Transform & Review      │
                                  │ Step 4: Save to Framework       │
                                  └─────────────────────────────────┘
```

### Deliverables

| # | Component | Description | Effort |
|---|-----------|-------------|--------|
| 1 | **Database Schema** | `scriptsmith_sessions`, `scriptsmith_files` tables | 0.5 day |
| 2 | **Session Service** | Create, get, update, delete sessions with status | 1 day |
| 3 | **Session Routes** | CRUD + input/transform/save endpoints | 1 day |
| 4 | **Framework Analysis Service** | Scan project for POM, helpers, fixtures | 1 day |
| 5 | **Wizard UI** | 4-step React wizard with tabs | 1.5 days |

### Database Schema

```sql
-- Migration: 020_create_scriptsmith_sessions.sql

CREATE TABLE scriptsmith_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  input_method VARCHAR(20) NOT NULL CHECK (input_method IN ('record', 'upload', 'screenshot', 'describe', 'edit')),
  status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'input_received', 'analyzing', 'transforming', 'reviewing', 'completed', 'failed')),
  raw_input JSONB,
  transformed_script TEXT,
  framework_analysis JSONB,
  cost_estimate DECIMAL(10,4),
  project_path TEXT,
  device_type VARCHAR(20),
  device_config JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE scriptsmith_files (
  file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scriptsmith_sessions(session_id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('test', 'page-object', 'utility', 'fixture')),
  content TEXT NOT NULL,
  imports TEXT[],
  exports TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ss_sessions_user ON scriptsmith_sessions(user_id);
CREATE INDEX idx_ss_sessions_status ON scriptsmith_sessions(status);
CREATE INDEX idx_ss_files_session ON scriptsmith_files(session_id);
```

### Service Interface

```typescript
// services/scriptsmith-session.service.ts

export interface ScriptSmithSession {
  sessionId: string;
  userId: string;
  projectId?: string;
  inputMethod: 'record' | 'upload' | 'screenshot' | 'describe' | 'edit';
  status: 'created' | 'input_received' | 'analyzing' | 'transforming' | 'reviewing' | 'completed' | 'failed';
  rawInput?: RawInputData;
  transformedScript?: string;
  frameworkAnalysis?: FrameworkAnalysis;
  generatedFiles?: GeneratedFile[];
  costEstimate?: number;
  projectPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FrameworkAnalysis {
  foundPageObjects: string[];
  foundUtilities: string[];
  foundFixtures: string[];
  projectStructure?: {
    testDir: string;
    pageObjectDir: string;
    utilityDir: string;
  };
  codingStyle?: {
    indentation: 'spaces' | 'tabs';
    quotesStyle: 'single' | 'double';
    semicolons: boolean;
  };
}

export class ScriptSmithSessionService {
  async createSession(userId: string, inputMethod: InputMethod, projectId?: string): Promise<ScriptSmithSession>;
  async getSession(sessionId: string): Promise<ScriptSmithSession | null>;
  async updateInput(sessionId: string, rawInput: Partial<RawInputData>): Promise<void>;
  async transform(sessionId: string, options: TransformOptions): Promise<ScriptSmithSession>;
  async saveToFramework(sessionId: string, targetDir: string): Promise<SaveResult>;
  async analyzeFramework(projectPath: string): Promise<FrameworkAnalysis>;
  async deleteSession(sessionId: string): Promise<void>;
  async getUserSessions(userId: string, filters?: SessionFilters): Promise<ScriptSmithSession[]>;
}
```

### API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scriptsmith/sessions` | Create new session |
| GET | `/api/scriptsmith/sessions` | List user sessions |
| GET | `/api/scriptsmith/sessions/:id` | Get session details |
| POST | `/api/scriptsmith/sessions/:id/input` | Update session input |
| POST | `/api/scriptsmith/sessions/:id/transform` | Transform with AI |
| POST | `/api/scriptsmith/sessions/:id/save` | Save to framework |
| DELETE | `/api/scriptsmith/sessions/:id` | Delete session |
| POST | `/api/scriptsmith/analyze-framework` | Analyze project structure |

### Acceptance Criteria

- [ ] Session persists across browser refresh
- [ ] 4-step wizard UI navigates correctly
- [ ] Framework analysis detects existing POM/helpers
- [ ] Transform applies all options (POM, utilities, wait strategy)
- [ ] Save writes files to disk with correct structure
- [ ] Cost estimation shows before transform
- [ ] 95%+ test coverage on new code
- [ ] All 5 input methods work (record, upload, screenshot, describe, edit)

### Test Plan

```typescript
// Unit tests (TDD)
describe('ScriptSmithSessionService', () => {
  describe('createSession', () => {
    it('should create session with correct initial status');
    it('should associate session with user');
    it('should validate input method');
  });

  describe('transform', () => {
    it('should update status to transforming');
    it('should call AI agent with correct options');
    it('should store generated files');
    it('should calculate cost estimate');
  });

  describe('saveToFramework', () => {
    it('should write files to disk');
    it('should create directories if needed');
    it('should not overwrite without flag');
    it('should update status to completed');
  });

  describe('analyzeFramework', () => {
    it('should detect page objects');
    it('should detect utility functions');
    it('should infer coding style');
  });
});

// Integration tests
describe('ScriptSmith Session Routes', () => {
  it('POST /sessions - creates session');
  it('GET /sessions/:id - returns session with files');
  it('POST /sessions/:id/transform - transforms and returns result');
  it('POST /sessions/:id/save - saves files to disk');
});
```

### Checkpoint 13 (CP13)

**Pass Criteria**:
- [ ] 40+ new tests passing
- [ ] Session CRUD working end-to-end
- [ ] Wizard UI functional with all steps
- [ ] Framework analysis returns results
- [ ] Files save to disk correctly

---

## Sprint 14: Flaky Test Detection + Duplicate Detection (P0)

**Goal**: Identify flaky tests and prevent duplicate test creation

**Duration**: 5 days

### What We're Building

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLAKY TEST DETECTION                         │
├─────────────────────────────────────────────────────────────────┤
│  Execution History  ──►  Pattern Analysis  ──►  Root Cause     │
│  (pass/fail ratio)      (AI-powered)           (suggestions)   │
│                              │                                  │
│                              ▼                                  │
│                    ┌─────────────────┐                         │
│                    │ Flaky Dashboard │                         │
│                    │ - Quarantine    │                         │
│                    │ - Trends        │                         │
│                    │ - Fix Status    │                         │
│                    └─────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    DUPLICATE DETECTION                          │
├─────────────────────────────────────────────────────────────────┤
│  New Test ──► Hash Check ──► Levenshtein ──► AI Semantic       │
│              (exact)         (near match)    (if needed)        │
│                                    │                            │
│                                    ▼                            │
│                          ┌─────────────────┐                   │
│                          │ Similar Tests   │                   │
│                          │ Found! Proceed? │                   │
│                          └─────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### Deliverables

| # | Component | Description | Effort |
|---|-----------|-------------|--------|
| 1 | **Flaky Tables** | `flaky_tests`, `flaky_patterns` tables | 0.5 day |
| 2 | **Flaky Service** | Detection, scoring, quarantine, trending | 1.5 days |
| 3 | **Flaky AI Analysis** | Claude-powered root cause analysis | 1 day |
| 4 | **Duplicate Service** | 3-tier cascade detection | 1 day |
| 5 | **Flaky Dashboard UI** | React page with metrics, quarantine | 1 day |

### Database Schema

```sql
-- Migration: 021_create_flaky_tests.sql

CREATE TABLE flaky_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id UUID REFERENCES test_cases(id),
  script_id UUID REFERENCES scripts(id),
  test_name TEXT NOT NULL,
  flakiness_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0-100
  total_runs INTEGER NOT NULL DEFAULT 0,
  pass_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  last_pass_at TIMESTAMP,
  last_fail_at TIMESTAMP,
  is_quarantined BOOLEAN DEFAULT FALSE,
  quarantined_at TIMESTAMP,
  quarantined_by UUID REFERENCES users(id),
  quarantine_reason TEXT,
  pattern_type VARCHAR(30), -- timing, race-condition, flaky-selector, network, state-dependent, environment
  root_cause_analysis JSONB,
  fix_status VARCHAR(20) DEFAULT 'open' CHECK (fix_status IN ('open', 'investigating', 'fixed', 'wont_fix')),
  fixed_at TIMESTAMP,
  fixed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE flaky_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type VARCHAR(30) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  affected_test_ids UUID[] NOT NULL,
  confidence DECIMAL(5,2) NOT NULL,
  suggested_fix TEXT,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE duplicate_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES scriptsmith_sessions(session_id),
  source_type VARCHAR(20) NOT NULL, -- test_case, script, session
  source_id UUID NOT NULL,
  is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  confidence DECIMAL(5,2),
  match_type VARCHAR(20), -- exact, near, semantic
  similar_items JSONB, -- [{id, name, similarity, path}]
  reason TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flaky_score ON flaky_tests(flakiness_score DESC);
CREATE INDEX idx_flaky_quarantine ON flaky_tests(is_quarantined) WHERE is_quarantined = TRUE;
CREATE INDEX idx_duplicate_source ON duplicate_checks(source_type, source_id);
```

### Service Interfaces

```typescript
// services/flaky.service.ts

export interface FlakyTestMetrics {
  testId: string;
  testName: string;
  flakinessScore: number; // 0-100 (100 = always flaky)
  totalRuns: number;
  passCount: number;
  failCount: number;
  passRate: number;
  recentResults: Array<{ runId: string; passed: boolean; timestamp: Date }>;
  isQuarantined: boolean;
  patternType?: string;
}

export interface FlakyCauseAnalysis {
  testId: string;
  rootCauses: Array<{
    cause: string;
    confidence: number;
    evidence: string[];
    suggestedFix: string;
  }>;
  patterns: FlakyPattern[];
  aiAnalysis: string;
}

export class FlakyTestService {
  async updateMetricsFromExecution(executionId: string): Promise<void>;
  async getFlakyTests(projectId: string, threshold?: number): Promise<FlakyTestMetrics[]>;
  async analyzeRootCause(testId: string): Promise<FlakyCauseAnalysis>;
  async quarantineTest(testId: string, userId: string, reason: string): Promise<void>;
  async unquarantineTest(testId: string, userId: string): Promise<void>;
  async markAsFixed(testId: string, userId: string): Promise<void>;
  async getTrends(projectId: string, days?: number): Promise<FlakyTrend[]>;
  async getQuarantinedTests(projectId: string): Promise<FlakyTestMetrics[]>;
}

// services/duplicate.service.ts

export interface DuplicateResult {
  isDuplicate: boolean;
  confidence: number;
  matchType: 'exact' | 'near' | 'semantic' | null;
  similarItems: Array<{
    id: string;
    name: string;
    similarity: number;
    path?: string;
  }>;
  recommendation?: string;
}

export class DuplicateDetectionService {
  async checkTestCase(content: string, projectId: string): Promise<DuplicateResult>;
  async checkScript(code: string, projectId: string): Promise<DuplicateResult>;
  async checkSession(sessionId: string): Promise<DuplicateResult>;

  // Internal methods
  private hashCheck(content: string, existingHashes: string[]): DuplicateResult | null;
  private levenshteinCheck(content: string, existing: string[]): DuplicateResult | null;
  private semanticCheck(content: string, existing: string[]): Promise<DuplicateResult>;
}
```

### Acceptance Criteria

- [ ] Flakiness score calculated from execution history
- [ ] AI root cause analysis identifies pattern type
- [ ] Quarantine excludes tests from CI (execution flag)
- [ ] Duplicate check runs before ScriptSmith save
- [ ] 3-tier cascade (hash → Levenshtein → AI) minimizes AI costs
- [ ] Dashboard shows trends, worst offenders, quarantine queue
- [ ] Tests can be marked as fixed with tracking
- [ ] 95%+ test coverage

### Test Plan

```typescript
describe('FlakyTestService', () => {
  describe('updateMetricsFromExecution', () => {
    it('should calculate flakiness score correctly');
    it('should detect flaky pattern from history');
    it('should auto-quarantine above threshold');
  });

  describe('analyzeRootCause', () => {
    it('should call AI with execution history');
    it('should parse root causes from response');
    it('should suggest fixes');
  });
});

describe('DuplicateDetectionService', () => {
  describe('checkTestCase', () => {
    it('should detect exact duplicates via hash');
    it('should detect near duplicates via Levenshtein');
    it('should fall back to AI for semantic check');
    it('should return similarity scores');
  });
});
```

### Checkpoint 14 (CP14)

**Pass Criteria**:
- [ ] 35+ new tests passing
- [ ] Flaky detection calculates scores from executions
- [ ] AI root cause analysis returns suggestions
- [ ] Duplicate detection blocks saves with warning
- [ ] Dashboard shows flaky test list with actions

---

## Sprint 15: CI/CD Integration (P1)

**Goal**: Jenkins integration for automated test execution

**Duration**: 4 days

### What We're Building

```
┌─────────────────────────────────────────────────────────────────┐
│                    CI/CD INTEGRATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TestForge ────► Jenkins API ────► Pipeline Execution           │
│      │              │                    │                      │
│      │              │                    ▼                      │
│      │              │           ┌──────────────────┐           │
│      │              │           │ Test Results     │           │
│      │              │           │ (webhook/poll)   │           │
│      │              │           └────────┬─────────┘           │
│      │              │                    │                      │
│      ◄──────────────┴────────────────────┘                     │
│                                                                 │
│  Features:                                                      │
│  - Store encrypted Jenkins credentials per project              │
│  - Trigger builds with parameters (env, browser, tests)         │
│  - Track build status (pending → running → success/fail)        │
│  - Map TF executions to Jenkins builds                          │
│  - View console logs                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Deliverables

| # | Component | Description | Effort |
|---|-----------|-------------|--------|
| 1 | **Jenkins Tables** | `jenkins_integrations`, `jenkins_builds` | 0.5 day |
| 2 | **Encryption Utils** | AES encryption for API tokens | 0.5 day |
| 3 | **Jenkins Service** | Integration CRUD, trigger, status polling | 1.5 days |
| 4 | **Jenkins Routes** | API endpoints for integration management | 0.5 day |
| 5 | **Integration Settings UI** | React page for Jenkins config | 1 day |

### Database Schema

```sql
-- Migration: 022_create_jenkins_integration.sql

CREATE TABLE jenkins_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  integration_name VARCHAR(100) NOT NULL,
  server_url TEXT NOT NULL,
  username VARCHAR(100) NOT NULL,
  api_token_encrypted TEXT NOT NULL, -- AES-256 encrypted
  job_path TEXT NOT NULL,
  default_environment VARCHAR(50),
  default_browser VARCHAR(50),
  build_parameters JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jenkins_builds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES jenkins_integrations(id),
  execution_id UUID REFERENCES executions(id),
  jenkins_build_number INTEGER NOT NULL,
  jenkins_build_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'success', 'failure', 'aborted')),
  parameters JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  total_tests INTEGER,
  passed_tests INTEGER,
  failed_tests INTEGER,
  console_log_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jenkins_project ON jenkins_integrations(project_id);
CREATE INDEX idx_jenkins_builds_integration ON jenkins_builds(integration_id);
CREATE INDEX idx_jenkins_builds_status ON jenkins_builds(status);
```

### Acceptance Criteria

- [ ] Jenkins credentials stored encrypted (AES-256)
- [ ] Can trigger Jenkins build from TF UI
- [ ] Build status updates via polling (webhook optional)
- [ ] Build results map to TF execution records
- [ ] Console log accessible from TF
- [ ] Multiple integrations per project supported
- [ ] Connection test before save
- [ ] 95%+ test coverage

### Checkpoint 15 (CP15)

**Pass Criteria**:
- [ ] 25+ new tests passing
- [ ] Jenkins integration CRUD working
- [ ] Build trigger sends correct parameters
- [ ] Status polling updates build record
- [ ] UI shows build status and results

---

## Sprint 16: Chat/Help System (P1)

**Goal**: Conversational AI interface and in-app help

**Duration**: 5 days

### What We're Building

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHAT/HELP SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐   │
│  │      CHAT INTERFACE      │  │      HELP SYSTEM         │   │
│  ├──────────────────────────┤  ├──────────────────────────┤   │
│  │ - Multi-turn conversation│  │ - Searchable docs        │   │
│  │ - Context-aware (current │  │ - Contextual tooltips    │   │
│  │   page, selected items)  │  │ - Keyboard shortcuts (?) │   │
│  │ - Code suggestions       │  │ - Feature guides         │   │
│  │ - Apply changes          │  │ - FAQ                    │   │
│  │ - Audit trail            │  │ - Feedback widget        │   │
│  └──────────────────────────┘  └──────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Deliverables

| # | Component | Description | Effort |
|---|-----------|-------------|--------|
| 1 | **Chat Tables** | `conversations`, `messages`, `suggestions` | 0.5 day |
| 2 | **Chat Service** | Conversation management, AI routing | 1.5 days |
| 3 | **Help Service** | Help content, search, feedback | 1 day |
| 4 | **Chat Routes** | Conversation CRUD, send message | 0.5 day |
| 5 | **Chat UI** | Floating chat widget, message history | 1 day |
| 6 | **Help UI** | Help page, tooltips, feedback widget | 0.5 day |

### Database Schema

```sql
-- Migration: 023_create_chat_system.sql

CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  context_type VARCHAR(30), -- page, test_case, script, etc.
  context_id UUID,
  title TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  suggestion_ids UUID[],
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id),
  suggestion_type VARCHAR(30) NOT NULL, -- code_change, config_change, test_case, etc.
  target_type VARCHAR(30), -- file, test_case, script
  target_id UUID,
  target_path TEXT,
  original_content TEXT,
  suggested_content TEXT NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE help_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'question', 'other')),
  page_context TEXT,
  content TEXT NOT NULL,
  screenshot_url TEXT,
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_chat_suggestions_conversation ON chat_suggestions(conversation_id);
CREATE INDEX idx_chat_suggestions_status ON chat_suggestions(status);
```

### Acceptance Criteria

- [ ] Chat maintains conversation context across messages
- [ ] AI suggestions can be approved/rejected/applied
- [ ] Applied changes actually modify files/records
- [ ] Help page has searchable content
- [ ] Feedback widget captures bug reports with context
- [ ] Rate limiting prevents abuse
- [ ] Jailbreak detection blocks prompt injection
- [ ] 95%+ test coverage

### Checkpoint 16 (CP16)

**Pass Criteria**:
- [ ] 35+ new tests passing
- [ ] Multi-turn chat working with context
- [ ] Suggestions can be applied to files
- [ ] Help page searchable
- [ ] Feedback widget submits reports

---

## Sprint 17: Reports & Quality Gates (P2)

**Goal**: Report generation and quality enforcement

**Duration**: 4 days

### Deliverables

| # | Component | Description | Effort |
|---|-----------|-------------|--------|
| 1 | **Report Tables** | `reports`, `report_templates`, `quality_gates` | 0.5 day |
| 2 | **Report Service** | Generate, schedule, export (PDF, Excel) | 1.5 days |
| 3 | **Quality Gates Service** | Define and enforce quality thresholds | 1 day |
| 4 | **Report Routes** | CRUD + generate + export endpoints | 0.5 day |
| 5 | **Reports UI** | Report viewer, template editor | 0.5 day |

### Key Features

- **Report Types**: Execution summary, coverage, flaky analysis, trend
- **Export Formats**: PDF (using pdfkit), Excel (using exceljs)
- **Scheduling**: Cron-based report generation
- **Quality Gates**: Pass/fail execution based on thresholds (coverage %, pass rate, etc.)

### Checkpoint 17 (CP17)

**Pass Criteria**:
- [ ] 25+ new tests passing
- [ ] Reports generate in PDF and Excel
- [ ] Quality gates block failing executions
- [ ] Scheduled reports work

---

## Sprint 18: HITL Approval Workflows (P1)

**Goal**: Human-in-the-loop approval for AI-generated artifacts

**Duration**: 5 days

### Deliverables

| # | Component | Description | Effort |
|---|-----------|-------------|--------|
| 1 | **HITL Tables** | `approval_workflows`, `artifact_states`, `sla_tracking` | 0.5 day |
| 2 | **Risk Assessment Service** | Calculate risk level from factors | 1 day |
| 3 | **Approval Service** | Route to workflow, track approvals | 1.5 days |
| 4 | **SLA Service** | Track deadlines, send reminders | 0.5 day |
| 5 | **Approval UI** | Approval queue, review interface | 1.5 days |

### Key Features

- **Risk Levels**: Low (auto-approve), Medium (single review), High (multi-level)
- **Artifact States**: Draft → Pending Review → Approved/Rejected → Archived
- **SLA Tracking**: Deadlines with breach alerts
- **Feedback Loop**: Capture reviewer feedback to improve AI

### Checkpoint 18 (CP18)

**Pass Criteria**:
- [ ] 30+ new tests passing
- [ ] Risk assessment routes to correct workflow
- [ ] Multi-level approval chains work
- [ ] SLA tracking with notifications
- [ ] Artifact state machine enforced

---

## Sprint 19: Advanced Features (P2/P3)

**Goal**: Polish and advanced capabilities

**Duration**: 5 days

### Deliverables

| # | Component | Description | Effort |
|---|-----------|-------------|--------|
| 1 | **Team Management** | Teams CRUD, membership | 1 day |
| 2 | **RBAC/Permissions** | Fine-grained permissions | 1.5 days |
| 3 | **Audit Logging** | Track all changes | 0.5 day |
| 4 | **WebSocket Updates** | Real-time execution status | 1 day |
| 5 | **Executive Dashboard** | High-level metrics | 1 day |

### Checkpoint 19 (CP19)

**Pass Criteria**:
- [ ] 25+ new tests passing
- [ ] Team management working
- [ ] Permissions enforced on routes
- [ ] Audit log captures changes
- [ ] WebSocket updates execution status

---

## Summary Table

| Sprint | Focus | Priority | Effort | New Tests | Cumulative Tests |
|--------|-------|----------|--------|-----------|------------------|
| 13 | ScriptSmith Pro+ | P0 | 5 days | 40+ | 890 |
| 14 | Flaky + Duplicate | P0 | 5 days | 35+ | 925 |
| 15 | CI/CD Integration | P1 | 4 days | 25+ | 950 |
| 16 | Chat/Help System | P1 | 5 days | 35+ | 985 |
| 17 | Reports + Quality | P2 | 4 days | 25+ | 1010 |
| 18 | HITL Approvals | P1 | 5 days | 30+ | 1040 |
| 19 | Advanced Features | P2/P3 | 5 days | 25+ | 1065 |

**Total New Tests**: ~215
**Final Test Count**: ~1,065

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Scope creep | Strict sprint boundaries, defer nice-to-haves |
| AI costs | Duplicate detection cascade, caching, hybrid model routing |
| Integration issues | Jenkins mock for testing, feature flags |
| Performance | Index optimization, pagination, caching |

---

## Next Steps

1. **Immediate**: Start Sprint 13 (ScriptSmith Pro+)
2. **Before Sprint 13**: Set up Prisma migrations for new tables
3. **Parallel**: Update RUNNING_CONTEXT.md with sprint status

---

**Document maintained by**: Odin (AI Second Brain)
**Created**: 2026-01-20
**Status**: Ready for implementation
