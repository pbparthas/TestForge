# TestForge - Running Context

## Project Overview
TestForge is a Test Management Platform rebuild (QualityPilot v2) with TDD methodology.

## Sprint Plan Reference
**CRITICAL**: The detailed sprint plan is in the QualityPilot Knowledge Base:
- **Spec**: `/home/partha/Desktop/SiaKB/QualityPilot/QP_REBUILD_SPEC.md`
- **Implementation Plan**: `/home/partha/Desktop/SiaKB/QualityPilot/QP_REBUILD_IMPLEMENTATION_PLAN.md`

Always check these files at session start for context.

---

## Current Sprint Status

### Sprint 1: Foundation (Days 1-5) - COMPLETED

#### Day 1: Project Scaffolding - DONE
- [x] Monorepo with pnpm workspaces
- [x] Turborepo configuration
- [x] Backend app structure (Express + TypeScript)
- [x] Dashboard app structure (React + TypeScript + Vite)
- [x] Shared packages
- [x] TypeScript, ESLint, Prettier config
- [x] Vitest setup
- [x] CI workflow (lint + type-check + test)

#### Day 2: Database Setup - DONE
- [x] Prisma with PostgreSQL schema
- [x] User/Project tables
- [x] Initial migration
- [x] Docker Compose for local dev

#### Day 3: Authentication - DONE
- [x] Auth service tests (17 tests)
- [x] Auth service implementation (register, login, refresh, JWT)
- [x] Auth routes tests
- [x] Auth routes implementation
- [x] Auth middleware

#### Day 4: User Management - DONE
- [x] User service tests (23 tests)
- [x] User service implementation
- [x] User routes tests (19 tests)
- [x] User routes implementation
- [x] Role-based access control middleware

#### Day 5: Error Handling & Logging - DONE
- [x] Custom error classes (errors/index.ts)
- [x] Global error handler middleware (app.ts)
- [x] Pino logger setup (utils/logger.ts)
- [x] Error handling tests (17 tests)
- [x] Zod validation middleware (in routes)
- [x] Rate limiting (app.ts)
- [x] Integration tests for error scenarios

### CP1 Checkpoint Status - PASSED
- [x] All tests passing: 203 tests
- [x] Coverage > 80%: 89.38% statements, 80.79% branches
- [x] Register user via API: POST /api/auth/register
- [x] Login and receive JWT: POST /api/auth/login
- [x] Protected routes with JWT: auth middleware
- [x] Role-based access: authorize middleware
- [x] CI pipeline: .github/workflows/ci.yml

---

### Sprint 2: Core CRUD (Days 6-10) - COMPLETED

#### Day 6: Projects & Requirements - DONE
- [x] Project service tests (18 tests)
- [x] Project service implementation
- [x] Project routes tests (18 tests)
- [x] Requirement service tests (8 tests)
- [x] Requirement service implementation
- [x] Requirement routes implementation

#### Day 7: Test Cases - DONE
- [x] TestCase service tests (22 tests)
- [x] TestCase service implementation
- [x] TestCase routes tests (14 tests)
- [x] TestCase routes implementation

#### Day 8: Test Suites - DONE
- [x] TestSuite service tests (14 tests)
- [x] TestSuite service implementation
- [x] TestSuite routes implementation

#### Day 9: Environments - DONE
- [x] Environment service tests (10 tests)
- [x] Environment service implementation
- [x] Environment routes implementation

#### Days 9-10: Remaining Items - PENDING
- [ ] Device service and routes
- [ ] Test Data service and routes
- [ ] Scripts table schema (basic CRUD, no AI)
- [ ] Integration tests for all Sprint 2 routes

### CP2 Checkpoint Status - PARTIAL
- [x] Tests passing: 203 tests
- [x] Coverage > 80%: 89.38%
- [x] Projects CRUD
- [x] Requirements CRUD
- [x] Test Cases CRUD with bulk ops
- [x] Test Suites CRUD
- [x] Environments CRUD
- [ ] Devices CRUD - NOT STARTED
- [ ] Test Data CRUD - NOT STARTED
- [ ] Scripts basic CRUD - NOT STARTED

---

## Test Status
- **Total Tests**: 203 passing
- **Test Files**: 13 (9 unit, 4 integration)
- **Coverage**: 89.38% statements, 80.79% branches, 93.1% functions

## Backend Structure
```
apps/backend/
├── src/
│   ├── app.ts              # Express app setup
│   ├── index.ts            # Server entry
│   ├── errors/index.ts     # Custom error classes
│   ├── middleware/
│   │   └── auth.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── project.routes.ts
│   │   ├── testcase.routes.ts
│   │   ├── testsuite.routes.ts
│   │   ├── requirement.routes.ts
│   │   └── environment.routes.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   ├── project.service.ts
│   │   ├── auth.service.ts
│   │   ├── testcase.service.ts
│   │   ├── testsuite.service.ts
│   │   ├── requirement.service.ts
│   │   └── environment.service.ts
│   └── utils/
│       ├── logger.ts
│       └── prisma.ts
├── tests/
│   ├── unit/services/      # 7 service test files
│   ├── unit/middleware/    # auth middleware tests
│   ├── unit/errors.test.ts
│   └── integration/        # 4 route integration tests
└── prisma/
    ├── schema.prisma       # Full schema with all models
    └── seed.ts
```

## Database Setup Required
```bash
# Start Docker containers
cd /home/partha/Desktop/TestForge/docker && docker-compose up -d

# Or manual setup
sudo -u postgres psql -c "CREATE DATABASE testforge; GRANT ALL ON DATABASE testforge TO testforge;"

# Run migrations
cd apps/backend && pnpm db:migrate && pnpm db:seed
```

## Key Patterns Established

### Vitest Mock Hoisting Pattern
```typescript
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { create: vi.fn(), findUnique: vi.fn(), ... }
  }
}));
vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));
```

### Integration Test Auth Pattern
```typescript
const { mockUserService, mockJwt } = vi.hoisted(() => ({
  mockUserService: { findById: vi.fn(), ... },
  mockJwt: { verify: vi.fn(), sign: vi.fn() }
}));

beforeEach(() => {
  mockJwt.verify.mockImplementation((token) => {
    if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
    throw new Error('Invalid token');
  });
});
```

## Session Log

### 2026-01-14 Session (Continued)
- **Major Issue**: Sia failed to check KB on session start after compaction
- **Root Cause**: Hook didn't read KB files, only DB state
- **Fix Applied**: Modified `sia_hooks.py` to read and inject KB file contents
  - Added `get_project_kb_files()` function
  - Updated `build_session_context()` to inject KB content
  - Updated `build_compact_context()` for post-compaction
- **Documentation**:
  - Added PRINCIPLE 0 to `SIA_CORE/LEARNINGS.md` (universal)
  - Added LESSON 0 to `QualityPilot/LEARNINGS.md` (project-specific)
  - Updated INDEX.md with startup protocol warning
  - Added mandatory startup section to TestForge CLAUDE.md
- **Tests**: 203 passing, 89.38% coverage (unchanged)

### 2025-01-14 Session (Earlier)
- Completed Sprint 1 (Days 1-5)
- Completed Sprint 2 (Days 6-9 partial)
- Fixed vi.hoisted mock pattern across all test files
- Fixed UUID validation issues in integration tests
- Added unit tests for requirement and environment services
- Final: 203 tests, 89.38% coverage

## Learnings

### 1. Vitest Mock Hoisting
**Issue**: `ReferenceError: Cannot access 'mockPrisma' before initialization`
**Fix**: Always use `vi.hoisted()` for mock objects

### 2. UUID Validation in Tests
**Issue**: Tests returning 400 for valid-looking data
**Fix**: Use proper UUID format in test data

### 3. Integration Test JWT Mocking
**Issue**: All authenticated requests returning 401
**Fix**: Set up verify mock in beforeEach with token mapping

### 4. Cross-Session Context (CRITICAL)
**Issue**: Tried to update Cortex project context instead of TestForge
**Fix**:
1. Always verify working directory matches project
2. Check SiaKB folder for project-specific plans FIRST
3. Reference sprint plan at: `/home/partha/Desktop/SiaKB/QualityPilot/QP_REBUILD_IMPLEMENTATION_PLAN.md`

## Next Session Tasks

### Complete Sprint 2 (Days 9-10)
1. Device service and routes with TDD
2. Test Data service and routes with TDD
3. Scripts table schema and basic CRUD
4. Integration tests for testsuite, requirement, environment routes
5. Verify CP2 checkpoint

### Then Sprint 3: AI Agents Part 1
- AI Infrastructure setup
- TestWeaver agent
- ScriptSmith agent
