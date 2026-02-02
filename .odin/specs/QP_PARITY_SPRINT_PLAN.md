# QualityPilot UI/UX Parity - Sprint Plan

**Spec ID:** bead_9b6a60d8e73f
**Created:** 2026-01-31
**Status:** Approved
**Total Tasks:** 13
**Estimated Duration:** 6 Sprints (6 weeks)

---

## Sprint Overview

| Sprint | Focus | Tasks | Priority |
|--------|-------|-------|----------|
| 21 | CodeGuardian + FlowPilot Rebuild | 2 | Critical |
| 22 | Test Management Enhancements | 2 | Critical |
| 23 | Dashboard + Executions | 2 | Critical |
| 24 | Self-Healing + Test Suites + Requirements | 3 | High |
| 25 | Coverage + ScriptSmith + Recorder | 3 | Medium |
| 26 | Flaky Tests + Visual QA | 2 | Medium |

---

## Sprint 21: AI Agent Page Rebuilds (Critical)

### Task 1: CodeGuardian Session-Based Workflow
**Task ID:** bead_2a700655a7bb
**Effort:** 3-4 days
**Priority:** Critical

#### Deliverables:
1. **SessionWizard Component** (`components/codeGuardian/SessionWizard.tsx`)
   - 5-step navigation: Setup → Files → Functions → Generate → Export
   - Progress indicator with step descriptions
   - Back/Continue navigation

2. **Session Sidebar** (`components/codeGuardian/SessionSidebar.tsx`)
   - Session list with search
   - Filters: Status (active/completed/archived), Language (TS/JS/Python/Java)
   - Session metrics display (files, functions, tests, coverage)

3. **CodeUpload Component** (`components/codeGuardian/CodeUpload.tsx`)
   - Multi-file drag-drop upload
   - File type validation
   - Upload progress indicator

4. **FunctionBrowser Component** (`components/codeGuardian/FunctionBrowser.tsx`)
   - Tree view of uploaded files
   - Function selection with checkboxes
   - Function signature preview

5. **TestViewer Component** (`components/codeGuardian/TestViewer.tsx`)
   - Generated test display
   - Syntax highlighting
   - Edit capability (Monaco optional)

6. **ExportModal Component** (`components/codeGuardian/ExportModal.tsx`)
   - Export format selection
   - Target directory input
   - File preview before export

7. **Updated CodeGuardian Page** (`pages/CodeGuardian.tsx`)
   - Replace 2-tab layout with session-based architecture
   - Stats cards (Files, Functions, Tests Generated, Avg Coverage)
   - Session persistence

#### Acceptance Criteria:
- [ ] User can create new session with language/framework selection
- [ ] User can upload multiple files and browse functions
- [ ] User can select functions and generate tests
- [ ] User can export generated tests
- [ ] Sessions persist and can be resumed
- [ ] Stats display correctly

---

### Task 2: FlowPilot Requirements Management
**Task ID:** bead_d0bd27dda93b
**Effort:** 3-4 days
**Priority:** Critical

#### Deliverables:
1. **RequirementsTable Component** (`components/flowpilot/RequirementsTable.tsx`)
   - 7 columns: Method, Endpoint, Title, Type, Priority, Status, Actions
   - Color-coded method badges (GET=blue, POST=green, PUT=yellow, DELETE=red, PATCH=purple)
   - Sortable columns
   - Pagination

2. **RequirementActions Component** (`components/flowpilot/RequirementActions.tsx`)
   - Edit button → opens modal
   - Delete button → confirmation dialog
   - History button → opens history panel

3. **RequirementEditModal Component** (`components/flowpilot/RequirementEditModal.tsx`)
   - Form fields: method, endpoint, title, description, type, priority, status
   - Validation
   - Save/Cancel actions

4. **RequirementHistoryPanel Component** (`components/flowpilot/RequirementHistoryPanel.tsx`)
   - Change history list
   - Timestamp and user display
   - Diff view (optional)

5. **FilterPanel Component** (`components/flowpilot/FilterPanel.tsx`)
   - Method filter (GET/POST/PUT/DELETE/PATCH)
   - Status filter (active/inactive/done/deprecated)
   - Priority filter (critical/high/medium/low)
   - Search input

6. **Updated FlowPilot Page** (`pages/FlowPilot.tsx`)
   - Replace API test generation with requirements table
   - Stats cards (Total, Active, Completed, High Priority)
   - Filter panel integration

#### Acceptance Criteria:
- [ ] Requirements display in 7-column table
- [ ] CRUD operations work (create, read, update, delete)
- [ ] Filters narrow down results correctly
- [ ] History shows requirement changes
- [ ] Stats cards update in real-time

---

## Sprint 22: Test Management Enhancements (Critical)

### Task 3: Test Cases - Bulk Operations & Version History
**Task ID:** bead_f75a47c4df54
**Effort:** 4-5 days
**Priority:** Critical

#### Deliverables:
1. **TreeView Component** (`components/testCases/TreeView.tsx`)
   - Hierarchical test case display
   - Expand/collapse nodes
   - Module-based grouping

2. **BulkActionsBar Component** (`components/testCases/BulkActionsBar.tsx`)
   - Select All / Deselect All
   - Bulk delete, move, tag
   - Selected count display

3. **VersionHistoryModal Component** (`components/testCases/VersionHistoryModal.tsx`)
   - Version list with timestamps
   - Diff view between versions
   - Restore functionality

4. **AdvancedFilters Component** (`components/testCases/AdvancedFilters.tsx`)
   - 7 filters: Platform, Priority, Automated, Product, Partner, Module, Status
   - Filter chips display
   - Clear all filters

5. **ImportExportPanel Component** (`components/testCases/ImportExportPanel.tsx`)
   - CSV import with mapping
   - Export to CSV/JSON
   - Progress indicator

6. **KeyboardShortcuts Hook** (`hooks/useKeyboardShortcuts.ts`)
   - Ctrl+K: Focus search
   - Ctrl+N: New test case
   - Del: Delete selected
   - Escape: Clear selection

7. **Updated TestCases Page** (`pages/TestCases.tsx`)
   - View toggle (Tree/Table)
   - Bulk operations integration
   - Version history on each row
   - Import/Export buttons

#### Acceptance Criteria:
- [ ] Tree view displays hierarchical structure
- [ ] Multi-select works with shift+click
- [ ] Bulk actions apply to all selected
- [ ] Version history shows changes with restore option
- [ ] Import/Export CSV works correctly
- [ ] Keyboard shortcuts functional

---

### Task 4: Dashboard Analytics Widgets
**Task ID:** bead_e4b9e6d3401c
**Effort:** 3-4 days
**Priority:** Critical

#### Deliverables:
1. **Install Recharts** (`pnpm add recharts`)

2. **DashboardTabs Component** (`components/dashboard/DashboardTabs.tsx`)
   - 3 tabs: Overview, Approvals, AI Quality
   - Tab content switching

3. **ExecutionTrendsChart** (`components/dashboard/ExecutionTrendsChart.tsx`)
   - 30-day line chart
   - Pass/Fail/Skip series
   - Tooltip with details

4. **CoverageBreakdownChart** (`components/dashboard/CoverageBreakdownChart.tsx`)
   - Pie chart with coverage types
   - Legend
   - Click to filter

5. **AIActivityWidget** (`components/dashboard/AIActivityWidget.tsx`)
   - Agent usage stats
   - Cost tracking
   - Recent activity list

6. **FlakyTestsWidget** (`components/dashboard/FlakyTestsWidget.tsx`)
   - Flaky test count
   - Trend indicator
   - Quick actions

7. **SelfHealingWidget** (`components/dashboard/SelfHealingWidget.tsx`)
   - Pending review count
   - Auto-fixed count
   - Time saved metric

8. **VisualRegressionWidget** (`components/dashboard/VisualRegressionWidget.tsx`)
   - Regression count
   - Trend chart (mini)
   - Quick review link

9. **Updated Dashboard Page** (`pages/Dashboard.tsx`)
   - 3-tab layout
   - Widget grid layout
   - Date range selector

#### Acceptance Criteria:
- [ ] All 3 tabs functional with distinct content
- [ ] Charts render with real data
- [ ] Widgets show accurate metrics
- [ ] Responsive grid layout
- [ ] Date range updates all charts

---

## Sprint 23: Executions & Core Features (Critical)

### Task 5: Executions Configuration & Real-time
**Task ID:** bead_2ae71cb00b5a
**Effort:** 4-5 days
**Priority:** Critical

#### Deliverables:
1. **ExecutionConfigPanel** (`components/executions/ExecutionConfigPanel.tsx`)
   - Device selector (8+ mobile devices)
   - Browser selector (Chromium, Firefox, WebKit)
   - Headless mode toggle
   - Environment dropdown

2. **DeviceEmulator Config** (`config/devices.ts`)
   - iPhone 12, 13, 14 Pro
   - Samsung Galaxy S21, S22
   - iPad Pro
   - Pixel 6
   - Custom viewport option

3. **WebhookIntegration** (`components/executions/WebhookIntegration.tsx`)
   - n8n webhook URL input
   - Test webhook button
   - Status indicator

4. **ExecutionPolling Hook** (`hooks/useExecutionPolling.ts`)
   - 3-second polling interval
   - Status updates
   - Auto-stop on completion

5. **ExecutionOutputModal** (`components/executions/ExecutionOutputModal.tsx`)
   - ANSI code cleaning
   - Screenshot gallery
   - Footer with stats (duration, pass/fail counts)

6. **ExecutionViews** (`components/executions/ExecutionViews.tsx`)
   - Run Tests view with config
   - History view with filters

7. **Updated Executions Page** (`pages/Executions.tsx`)
   - 2-view toggle (Run/History)
   - Config panel integration
   - Real-time status updates

#### Acceptance Criteria:
- [ ] Can configure device, browser, environment
- [ ] Real-time polling shows test progress
- [ ] Output modal displays results with screenshots
- [ ] Webhook integration sends notifications
- [ ] History shows past executions

---

## Sprint 24: High Priority Features

### Task 6: Self-Healing Stats Dashboard
**Task ID:** bead_9624a47d7ba7
**Effort:** 3 days
**Priority:** High

#### Deliverables:
1. **SelfHealingStats** (`components/selfHealing/SelfHealingStats.tsx`)
   - 5 stat cards: Pending, Auto-Fixed, Approved, Time Saved, Avg Confidence

2. **HistoryLogsTab** (`components/selfHealing/HistoryLogsTab.tsx`)
   - Log table with cost tracking
   - Action type filter
   - Date range filter

3. **PatternDetailModal** (`components/selfHealing/PatternDetailModal.tsx`)
   - Suggestion list with reasoning
   - Risk assessment
   - Approve/Reject per suggestion

4. **SettingsPanel** (`components/selfHealing/SettingsPanel.tsx`)
   - Auto-apply threshold slider
   - Confidence minimum setting

#### Acceptance Criteria:
- [ ] Stats display accurately
- [ ] History shows all actions with costs
- [ ] Pattern modal allows granular approval
- [ ] Settings persist

---

### Task 7: Test Suites Execution Tabs
**Task ID:** bead_3a68bc1d1539
**Effort:** 2-3 days
**Priority:** High

#### Deliverables:
1. **SuitesTabs** (`components/testSuites/SuitesTabs.tsx`)
   - 4 tabs: Suites, Execute, Results, Schedule

2. **ExecuteTab** (`components/testSuites/ExecuteTab.tsx`)
   - Suite selection
   - Execution profile dropdown
   - Run button

3. **ResultsTab** (`components/testSuites/ResultsTab.tsx`)
   - Execution history list
   - Result details expansion

4. **ScheduleTab** (`components/testSuites/ScheduleTab.tsx`)
   - Cron expression input
   - Schedule list
   - Enable/disable toggle

5. **ExecutionProfile** (`components/testSuites/ExecutionProfile.tsx`)
   - Profile CRUD
   - Device/browser config
   - Parallel workers setting

#### Acceptance Criteria:
- [ ] All 4 tabs functional
- [ ] Execute runs selected suite
- [ ] Results show execution history
- [ ] Schedule creates cron jobs

---

### Task 8: Requirements Traceability Matrix
**Task ID:** bead_65745247ec8b
**Effort:** 2-3 days
**Priority:** High

#### Deliverables:
1. **TraceabilityMatrixModal** (`components/requirements/TraceabilityMatrixModal.tsx`)
   - Matrix grid (requirements vs test cases)
   - Color-coded coverage
   - Export to CSV

2. **ImpactAnalysis** (`components/requirements/ImpactAnalysis.tsx`)
   - Downstream dependencies
   - Affected test cases list

3. **CoverageDashboard** (`components/requirements/CoverageDashboard.tsx`)
   - 5 metrics: Total, Fully Tested, Partial, Not Tested, Avg Coverage
   - Color coding

4. **LinkTestCaseModal** (`components/requirements/LinkTestCaseModal.tsx`)
   - Dual-panel: Available vs Linked
   - Search and filter
   - Drag-drop linking

#### Acceptance Criteria:
- [ ] Matrix displays coverage visually
- [ ] Impact analysis shows dependencies
- [ ] Coverage metrics accurate
- [ ] Linking modal works smoothly

---

## Sprint 25: Medium Priority Features

### Task 9: Coverage Visualization
**Task ID:** bead_a323e47d7994
**Effort:** 2 days
**Priority:** Medium

#### Deliverables:
1. **RiskDistributionChart** (`components/coverage/RiskDistributionChart.tsx`)
   - Pie chart with risk levels

2. **TypeDistributionChart** (`components/coverage/TypeDistributionChart.tsx`)
   - Bar chart by coverage type

3. **CoverageFilters** (`components/coverage/CoverageFilters.tsx`)
   - Type filter
   - Risk level filter
   - Search

4. **Pagination** for gap list

#### Acceptance Criteria:
- [ ] Charts render correctly
- [ ] Filters work
- [ ] Pagination navigates properly

---

### Task 10: ScriptSmith Advanced Features
**Task ID:** bead_a9074adc09c8
**Effort:** 3 days
**Priority:** Medium

#### Deliverables:
1. **DeviceSelector** (`components/scriptsmith/DeviceSelector.tsx`)
   - Device grid with preview
   - Custom viewport option

2. **MonacoEditor Integration** (`components/scriptsmith/CodeEditor.tsx`)
   - Syntax highlighting
   - Basic editing

3. **ValidationPanel** (`components/scriptsmith/ValidationPanel.tsx`)
   - Errors, warnings, info display
   - Framework validation

4. **SecurityScanPanel** (`components/scriptsmith/SecurityScanPanel.tsx`)
   - Sentinel integration
   - Vulnerability list

#### Acceptance Criteria:
- [ ] Device selector works with preview
- [ ] Monaco editor editable
- [ ] Validation shows issues
- [ ] Security scan runs

---

### Task 11: Recorder Live Recording
**Task ID:** bead_6b756e562c58
**Effort:** 3-4 days
**Priority:** Medium

#### Deliverables:
1. **RecorderControlPanel** (`components/recorder/RecorderControlPanel.tsx`)
   - Start/Stop/Pause/Resume buttons
   - Timer display
   - Status indicator

2. **ActionTimeline** (`components/recorder/ActionTimeline.tsx`)
   - Real-time action list
   - Edit/delete actions
   - Reorder capability

3. **ElementInspector** (`components/recorder/ElementInspector.tsx`)
   - Element highlighting
   - Selector generation

4. **VisualAssertionCapture** (`components/recorder/VisualAssertionCapture.tsx`)
   - Region selection
   - Screenshot capture
   - Threshold setting

5. **Backend WebSocket** for real-time action streaming

#### Acceptance Criteria:
- [ ] Recording starts/stops correctly
- [ ] Actions appear in real-time
- [ ] Element inspector works
- [ ] Visual assertions captured

---

## Sprint 26: Polish & Visual QA

### Task 12: Flaky Tests Trend Charts
**Task ID:** bead_cfc0f3db8a41
**Effort:** 1-2 days
**Priority:** Medium

#### Deliverables:
1. **TrendLineChart** (`components/flakyTests/TrendLineChart.tsx`)
   - 30-day line chart
   - Dual Y-axes (count + score)

2. **StatusDistributionChart** (`components/flakyTests/StatusDistributionChart.tsx`)
   - Bar chart by status

#### Acceptance Criteria:
- [ ] Charts render with real data
- [ ] Interactive tooltips

---

### Task 13: Visual QA & Final Comparison
**Task ID:** bead_7b1b664641c8
**Effort:** 2 days
**Priority:** Medium

#### Deliverables:
1. Screenshot comparison with QP for all pages
2. Bug fixes for visual discrepancies
3. Final polish and consistency check

#### Acceptance Criteria:
- [ ] All pages visually match QP structure
- [ ] No major layout issues
- [ ] Consistent styling across pages

---

## Dependencies

```
Sprint 21 (CodeGuardian, FlowPilot)
    ↓
Sprint 22 (Test Cases, Dashboard) - Can run parallel with 21
    ↓
Sprint 23 (Executions) - Depends on Dashboard charts
    ↓
Sprint 24 (Self-Healing, Suites, Requirements) - Can run parallel
    ↓
Sprint 25 (Coverage, ScriptSmith, Recorder) - Can run parallel
    ↓
Sprint 26 (Flaky Charts, Visual QA) - Final sprint
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Monaco editor bundle size | Use dynamic import, code splitting |
| Live recording complexity | Start with JSON-based, add live later |
| Backend API gaps | Stub APIs first, implement later |
| Recharts performance | Limit data points, use memoization |

---

## Success Metrics

- All 13 acceptance criteria pass
- Zero critical visual differences from QP
- All new components have TypeScript types
- Mobile responsive on all pages
- Dark mode support added

---

## Notes

- This plan assumes 1 developer working full-time
- With 2 developers, sprints can be parallelized (21+22, 24 tasks, 25 tasks)
- Backend API work is out of scope but may be needed for some features
