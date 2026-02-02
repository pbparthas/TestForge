# TestForge - Running Context

## Project Overview
TestForge is a Test Management Platform rebuild (QualityPilot v2) with TDD methodology.

## Sprint Plan Reference
**CRITICAL**: The detailed sprint plan is in the QualityPilot Knowledge Base:
- **Spec**: `/home/partha/Desktop/OdinKB/QualityPilot/QP_REBUILD_SPEC.md`
- **Implementation Plan**: `/home/partha/Desktop/OdinKB/QualityPilot/QP_REBUILD_IMPLEMENTATION_PLAN.md`

Always check these files at session start for context.

---

## Current Status: QualityPilot PARITY IN PROGRESS

**Sprints 1-8 + 21-26 Completed** - Feb 2, 2026
- **Tests**: 270 passing
- **Build**: Passing
- **Latest Sprint**: Sprint 26 - Flaky Tests Charts, Visual QA (QP PARITY COMPLETE!)

---

## Sprint Summary

### Sprint 1: Foundation (Days 1-5) - COMPLETED
- [x] Monorepo with pnpm workspaces + Turborepo
- [x] Backend: Express + TypeScript + Prisma + PostgreSQL
- [x] Dashboard: React + TypeScript + Vite
- [x] Authentication (register, login, JWT refresh)
- [x] User management with RBAC
- [x] Error handling & logging (Pino)
- [x] CI workflow

**CP1**: PASSED (203 tests, 89.38% coverage)

### Sprint 2: Core CRUD (Days 6-10) - COMPLETED
- [x] Projects CRUD
- [x] Requirements CRUD
- [x] Test Cases CRUD with bulk ops
- [x] Test Suites CRUD
- [x] Environments CRUD
- [x] Devices CRUD
- [x] Scripts CRUD with versioning

**CP2**: PASSED

### Sprint 3-4: AI Agents - COMPLETED
- [x] BaseAgent with Anthropic SDK, retry logic, cost tracking
- [x] TestWeaver (generate/evolve test cases)
- [x] ScriptSmith (generate/edit automation scripts)
- [x] Framework Agent (code analysis, review)
- [x] Self-Healing Agent (diagnose/fix failures)
- [x] FlowPilot (API test generation)
- [x] CodeGuardian (unit test generation)
- [x] AI Usage tracking service

**CP3-4**: PASSED

### Sprint 5: Execution & Traceability - COMPLETED
- [x] Execution service (trigger, run, results, retry)
- [x] Traceability service (coverage, gaps, chains)
- [x] Bug service (CRUD, create from failure, patterns)

**CP5**: PASSED

### Sprint 6: Dashboard - COMPLETED
- [x] React + TypeScript + Vite + Tailwind CSS
- [x] Zustand stores (auth, projects)
- [x] UI components: Button, Input, Card, Badge
- [x] Grouped sidebar matching QualityPilot structure

**Pages (12 total)**:
- [x] Login, Dashboard
- [x] Test Cases (with CRUD, search, filters)
- [x] Test Suites (with CRUD, expandable cards)
- [x] Requirements (with CRUD, traceability)
- [x] Executions, Bugs, Coverage
- [x] ScriptSmith Pro (Generate/Edit tabs)
- [x] AI Generator (Generate/Evolve tabs)
- [x] CodeGuardian (Generate/Analyze tabs)
- [x] FlowPilot (Generate/Validate tabs)
- [x] Self-Healing (Diagnose/Fix tabs)

**CP6**: PASSED

### Sprint 7: ScriptSmith Pro Parity - COMPLETED
- [x] Device targeting (mobile, tablet, desktop, multi-device)
- [x] Transformation options (minify, format, language convert)
- [x] Screenshot input for script generation
- [x] Advanced options UI in ScriptSmith Pro page

**CP7**: PASSED

### Sprint 8: TestWeaver Depth - COMPLETED
- [x] Screenshot input with Claude Vision (`callWithVision()`)
- [x] File upload support (CSV, JSON, plain text)
- [x] Multi-turn conversation (`callWithHistory()`)
- [x] Batch generation for multiple specs
- [x] AI mapping with confidence scores
- [x] Complete AIGenerator.tsx rewrite with input method selector

**Key Technical Additions**:
- `base.agent.ts`: Added `callWithVision()` and `callWithHistory()` methods
- `testweaver.agent.ts`: New interfaces - `ScreenshotInput`, `FileUploadInput`, `GenerateOptions`
- `ai.routes.ts`: New `/test-weaver/batch` route, updated generate handler
- `AIGenerator.tsx`: Drag & drop upload, conversation UI, batch tab

**CP8**: PASSED (270 tests)

---

## Test Status
- **Total Tests**: 270 passing
- **Test Files**: 18 (unit + integration)
- **Coverage**: ~89%

## Backend Structure
```
apps/backend/src/
├── agents/           # 6 AI agents + base
│   ├── base.agent.ts
│   ├── testweaver.agent.ts
│   ├── scriptsmith.agent.ts
│   ├── framework.agent.ts
│   ├── selfhealing.agent.ts
│   ├── flowpilot.agent.ts
│   └── codeguardian.agent.ts
├── services/         # Business logic
│   ├── auth.service.ts
│   ├── user.service.ts
│   ├── project.service.ts
│   ├── testcase.service.ts
│   ├── testsuite.service.ts
│   ├── requirement.service.ts
│   ├── environment.service.ts
│   ├── device.service.ts
│   ├── script.service.ts
│   ├── execution.service.ts
│   ├── traceability.service.ts
│   ├── bug.service.ts
│   └── aiusage.service.ts
├── routes/           # API endpoints
└── middleware/       # Auth, validation
```

## Dashboard Structure
```
apps/dashboard/src/
├── components/       # UI components
├── pages/            # Route pages
├── stores/           # Zustand state
├── api/              # API client
└── types/            # TypeScript types
```

## What's Next - QP UI/UX Parity Sprints (21-26)

**Sprint Plan**: `.odin/specs/QP_PARITY_SPRINT_PLAN.md`

### Sprint 21: AI Agent Page Rebuilds (COMPLETE)
- [x] Task 1: CodeGuardian Session-Based Workflow
  - Created 6 new components in `components/codeGuardian/`
  - SessionWizard, SessionSidebar, CodeUpload, FunctionBrowser, TestViewer, ExportModal
  - Rebuilt CodeGuardian.tsx with 5-step wizard (Setup → Files → Functions → Generate → Export)
- [x] Task 2: FlowPilot Requirements Management
  - Created 4 new components in `components/flowpilot/`
  - RequirementsTable (7 columns, sorting, pagination)
  - RequirementEditModal (CRUD form with validation)
  - RequirementHistoryPanel (change history timeline)
  - FilterPanel (Method, Status, Priority, Search)
  - Rebuilt FlowPilot.tsx with stats cards and requirements table

### Sprint 22: Test Management Enhancements - COMPLETED
- [x] Task 3: Test Cases - Bulk Operations & Version History
  - Created `components/testCases/` with 7 components:
    - `BulkActionsBar.tsx` - Select All, Bulk delete/move/tag/archive/duplicate
    - `TreeView.tsx` - Hierarchical suite-organized view
    - `AdvancedFilters.tsx` - 7 filter types (type, priority, status, suite, tags, date, assignee)
    - `VersionHistoryModal.tsx` - Version diff view with restore capability
    - `ImportExportPanel.tsx` - Import/Export JSON, CSV, Excel, XML
    - `useKeyboardShortcuts.ts` - 11 keyboard shortcuts
    - `KeyboardShortcutsHelp.tsx` - Shortcuts help panel
  - Rebuilt `TestCases.tsx` with:
    - Table/Tree view toggle
    - Multi-select with checkboxes
    - Bulk actions bar
    - Advanced filters sidebar
    - Version history per test case
    - Import/Export panel
    - Keyboard shortcuts (Ctrl+A, Ctrl+N, Delete, etc.)
- [x] Task 4: Dashboard Analytics Widgets
  - Installed Recharts library
  - Created `components/dashboard/` with 8 components:
    - `TestExecutionChart.tsx` - Area chart for execution trends
    - `CoverageDonutChart.tsx` - Donut chart with center label
    - `StatusBarChart.tsx` - Horizontal/vertical bar chart
    - `TrendLineChart.tsx` - Line chart with target reference
    - `StatsCard.tsx` - Metric card with trend indicator
    - `ActivityFeed.tsx` - Activity timeline
    - `QuickActions.tsx` - Quick action button grid
    - `RecentTests.tsx` - Recent test results table
  - Rebuilt `Dashboard.tsx` with:
    - 3 tabs: Overview, Analytics, Activity
    - Stats cards with trend indicators
    - Interactive charts (execution trend, coverage donut, status bars)
    - Quick actions grid
    - Recent tests table
    - Activity feed timeline

### Sprint 23: Executions & Core Features - COMPLETED
- [x] Task 5: Executions Configuration & Real-time
  - Created `config/devices.ts` - 17 device configs (iPhone, Samsung, Pixel, iPad, Desktop)
  - Created `components/executions/` with 5 components:
    - `ExecutionConfigPanel.tsx` - Device/Browser/Environment selector
    - `WebhookIntegration.tsx` - n8n webhook configuration
    - `ExecutionOutputModal.tsx` - Output viewer with ANSI parsing
    - `ExecutionViews.tsx` - Run Tests & History views
    - `index.ts` - Component exports
  - Created `hooks/useExecutionPolling.ts` - Real-time status polling (3s interval)
  - Rebuilt `Executions.tsx` with 2-view toggle (Run/History), stats bar

### Sprint 24: Self-Healing, Test Suites, Requirements - COMPLETED
- [x] Task 6: Self-Healing Stats Dashboard
  - Created `components/selfHealing/` with 4 components:
    - `SelfHealingStats.tsx` - 5 stat cards (Pending, Auto-Fixed, Approved, Time Saved, Avg Confidence)
    - `HistoryLogsTab.tsx` - Log table with cost tracking, action/status/date filters
    - `PatternDetailModal.tsx` - Suggestion list with reasoning, risk, approve/reject
    - `SettingsPanel.tsx` - Auto-apply threshold, confidence minimum, notifications
- [x] Task 7: Test Suites Execution Tabs
  - Created `components/testSuites/` with 5 components:
    - `SuitesTabs.tsx` - 4 tabs (Suites, Execute, Results, Schedule)
    - `ExecuteTab.tsx` - Suite selection with checkboxes, execution profile
    - `ResultsTab.tsx` - Execution history with expandable details, status filter
    - `ScheduleTab.tsx` - Cron presets, schedule list, enable/disable toggle
    - `ExecutionProfile.tsx` - Profile CRUD form, device/browser config
- [x] Task 8: Requirements Traceability Matrix
  - Created `components/requirements/` with 4 components:
    - `TraceabilityMatrixModal.tsx` - Matrix grid (req vs tests), color-coded coverage, CSV export
    - `CoverageDashboard.tsx` - 5 metrics with progress bar
    - `ImpactAnalysis.tsx` - Downstream dependencies, affected test cases
    - `LinkTestCaseModal.tsx` - Dual-panel UI, search, bulk selection

### Sprint 25: Coverage, ScriptSmith, Recorder - COMPLETED
- [x] Task 9: Coverage Visualization
  - Created `components/coverage/` with 4 components:
    - `RiskDistributionChart.tsx` - Pie chart with risk levels (critical/high/medium/low)
    - `TypeDistributionChart.tsx` - Bar chart by coverage type (unit/integration/e2e)
    - `CoverageFilters.tsx` - Type, risk level, search filters
    - `GapListPagination.tsx` - Paginated list of coverage gaps
- [x] Task 10: ScriptSmith Advanced Features
  - Created `components/scriptsmith/` with 4 components:
    - `DeviceSelector.tsx` - Device grid with preview, custom viewport
    - `CodeEditor.tsx` - Syntax-highlighted editor with copy/download
    - `ValidationPanel.tsx` - Errors, warnings, info display with filters
    - `SecurityScanPanel.tsx` - Vulnerability list with severity scores
- [x] Task 11: Recorder Live Recording
  - Created `components/recorder/` with 4 components:
    - `RecorderControlPanel.tsx` - Start/Stop/Pause/Resume, timer, URL input
    - `ActionTimeline.tsx` - Real-time action list, edit/delete, reorder
    - `ElementInspector.tsx` - Element info, selector generation, confidence
    - `VisualAssertionCapture.tsx` - Region drawing, threshold settings

### Sprint 26: Flaky Tests & Visual QA - COMPLETED
- [x] Task 12: Flaky Tests Trend Charts
  - Created `components/flakyTests/` with 4 components:
    - `FlakyTrendChart.tsx` - 30-day line chart with dual Y-axes (count + score)
    - `StatusDistributionChart.tsx` - Bar chart by status (investigating, known_issue, etc.)
    - `FlakyTestsList.tsx` - Filterable/sortable list with status management
    - `FlakyTestDetails.tsx` - Detailed view with failure history & pattern analysis
- [x] Task 13: Visual QA & Final Comparison
  - Created `components/visualQA/` with 4 components:
    - `ScreenshotComparison.tsx` - Side-by-side, overlay, slider, diff modes
    - `VisualRegressionList.tsx` - Regression list with bulk approve/reject
    - `VisualTestRunner.tsx` - Configure and run visual tests
    - `BaselineManager.tsx` - Manage baselines with versioning

---

## QP Parity Complete!

**All 13 Tasks Completed across Sprints 21-26:**
- Sprint 21: CodeGuardian (6), FlowPilot (4) = 10 components
- Sprint 22: Test Cases (7), Dashboard (8) = 15 components
- Sprint 23: Executions (5 + hooks) = 6 components
- Sprint 24: Self-Healing (4), Test Suites (5), Requirements (4) = 13 components
- Sprint 25: Coverage (4), ScriptSmith (4), Recorder (4) = 12 components
- Sprint 26: Flaky Tests (4), Visual QA (4) = 8 components

**Total New Components: 64**

---

## Session Log

### 2026-02-02 Session (Sprint 21-22 - QP Parity) - CLOSED
- **Completed Sprint 21 - Both Tasks Done**
  - CodeGuardian: 6 components, 5-step wizard workflow
  - FlowPilot: 4 components, requirements management table
- **Completed Sprint 22 - Both Tasks Done**
  - Test Cases: 7 components (BulkActionsBar, TreeView, AdvancedFilters, VersionHistoryModal, ImportExportPanel, useKeyboardShortcuts, KeyboardShortcutsHelp)
  - Dashboard: 8 components (TestExecutionChart, CoverageDonutChart, StatusBarChart, TrendLineChart, StatsCard, ActivityFeed, QuickActions, RecentTests)
- **New Components Created**: 25 total
- **Build Status**: Passing
- **TypeScript**: Clean
- Completed Task 1: CodeGuardian Session-Based Workflow
  - Created `components/codeGuardian/` with 6 new components:
    - `SessionWizard.tsx` - 5-step wizard navigation
    - `SessionSidebar.tsx` - Session list with search/filters
    - `CodeUpload.tsx` - Multi-file drag-drop upload
    - `FunctionBrowser.tsx` - Tree view with function selection
    - `TestViewer.tsx` - Generated test display with edit
    - `ExportModal.tsx` - Export format selection
  - Rebuilt `CodeGuardian.tsx` with session-based architecture
  - Stats cards: Files, Functions, Tests Generated, Avg Coverage
- Completed Task 2: FlowPilot Requirements Management
  - Created `components/flowpilot/` with 4 new components:
    - `RequirementsTable.tsx` - 7-column sortable table with pagination
    - `RequirementEditModal.tsx` - CRUD form with validation
    - `RequirementHistoryPanel.tsx` - Change history timeline
    - `FilterPanel.tsx` - Method, Status, Priority, Search filters
  - Rebuilt `FlowPilot.tsx` with requirements table
  - Stats cards: Total, Active, Completed, High Priority
- Build passing, TypeScript clean

### 2026-01-19 Session (Sprint 8)
- Completed TestWeaver Depth implementation
- Added `callWithVision()` to base.agent.ts for Claude Vision
- Added `callWithHistory()` to base.agent.ts for multi-turn
- Rewrote testweaver.agent.ts with new input types
- Added `/test-weaver/batch` route
- Rewrote AIGenerator.tsx with:
  - Input method selector (Text, Screenshot, File, Chat)
  - Drag & drop file upload
  - Conversation interface
  - Batch Generate tab
  - AI mapping display
- Added 10 new tests for Sprint 8 features
- Fixed `exactOptionalPropertyTypes` TypeScript issues
- Commit: `a1dc052 feat(sprint-8): TestWeaver depth - screenshot, file upload, multi-turn, batch, AI mapping`

### 2026-01-18/19 Session (Sprint 7)
- Added device targeting to ScriptSmith Pro
- Added transformation options (minify, format, convert)
- Added screenshot input for script generation
- Updated ScriptSmithPro.tsx with advanced options
- Commit: `4dd6207 feat(sprint-7): ScriptSmith Pro parity - device targeting, transformation options, screenshot input`

### 2026-01-18 Session
- Created 5 separate AI agent pages matching QP structure:
  - ScriptSmith Pro, AI Generator, CodeGuardian, FlowPilot, Self-Healing
- Updated sidebar to "Testing & Automation" group
- Fixed TypeScript build errors
- Dashboard now has 12 functional pages

### 2026-01-16 Session
- Verified rebuild complete (Sprints 2-6 done)
- Updated running context to reflect actual state
- 231 tests passing

### 2026-01-15 Session
- Completed Sprints 2-6 in single session
- Added all 6 AI agents
- Added execution, traceability, bug services
- Built complete dashboard with all pages
- Commit: `1e2128e`

### 2026-01-14 Session
- Completed Sprint 1 + Sprint 2 partial
- Fixed vi.hoisted mock patterns
- Added LESSON 0 to learnings

---

## Key Patterns

### Vitest Mock Hoisting
```typescript
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { user: { create: vi.fn(), ... } }
}));
vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
```

### Integration Test Auth
```typescript
mockJwt.verify.mockImplementation((token) => {
  if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
  throw new Error('Invalid token');
});
```

---

## Commands

```bash
# Development
pnpm dev              # Start all dev servers
pnpm test             # Run tests
pnpm test:coverage    # Tests with coverage

# Database
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed data
pnpm db:studio        # Prisma Studio

# Docker
cd docker && docker-compose up -d
```
