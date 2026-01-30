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

**Sprints 1-8 Completed** - Jan 19, 2026
- **Tests**: 270 passing
- **Latest Commit**: `a1dc052 feat(sprint-8): TestWeaver depth - screenshot, file upload, multi-turn, batch, AI mapping`

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

## What's Next

### Sprint 9: Visual Testing Agent (NEXT)
- [ ] Create `agents/visualAnalysis.agent.ts`
- [ ] Screenshot comparison using Claude Vision
- [ ] Diff detection with threshold configuration
- [ ] Responsive testing (multi-viewport)
- [ ] Cross-browser comparison
- [ ] Baseline storage and approval workflow
- [ ] VisualTesting.tsx dashboard page

### Sprint 10: Recorder Agent
- [ ] Browser recording → script generation
- [ ] Action capture (clicks, inputs, navigations)
- [ ] Smart selector generation
- [ ] Integration with ScriptSmith for output

### Sprint 11: Bug Pattern Analyzer
- [ ] Pattern recognition across bug reports
- [ ] Root cause clustering
- [ ] Predictive bug detection

### Sprint 12: Framework Maintenance Depth
- [ ] Advanced code review capabilities
- [ ] Test file structure recommendations
- [ ] Dependency update impact analysis

---

## Session Log

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
