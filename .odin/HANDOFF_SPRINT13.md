# Sprint 13 Handoff - ScriptSmith Pro+

**Created**: 2026-01-20
**Previous Session**: sess_7781413f2715
**Reason**: Context at 95.3% - HARD STOP triggered

---

## What Was Done This Session

1. **TestPilot bugs** - Already fixed and committed (commit 07a8032)
2. **Created comprehensive audit**: `QP_VS_TF_COMPREHENSIVE_AUDIT.md`
   - QP: 12 agents, 70+ services, 53 routes, 54 pages
   - TF: 12 agents, 14 services, 19 routes, 20 pages
   - Overall parity: ~30%
3. **Created sprint plan**: `QP_PARITY_SPRINT_PLAN.md`
   - 7 sprints (13-19) to reach full parity
4. **Ran orchestration check** for Sprint 13
   - Result: `should_orchestrate: true`
   - Suggested agents: architect, dev, qa
   - Tier: full (security-sensitive)

---

## Sprint 13: ScriptSmith Pro+ (Ready to Start)

### Objective
Add session-based workflow to ScriptSmith Pro matching QualityPilot.

### Deliverables (5 days)
1. **Database Schema** (0.5 day)
   - `scriptsmith_sessions` table
   - `scriptsmith_files` table

2. **Session Service** (1 day)
   - CRUD operations
   - Status transitions: created → input_received → analyzing → transforming → reviewing → completed

3. **Session Routes** (1 day)
   - POST /api/ai/scriptsmith/sessions
   - GET /api/ai/scriptsmith/sessions/:id
   - POST /api/ai/scriptsmith/sessions/:id/input
   - POST /api/ai/scriptsmith/sessions/:id/transform
   - POST /api/ai/scriptsmith/sessions/:id/save

4. **Framework Analysis Service** (1 day)
   - Scan project for POM patterns
   - Detect helpers, fixtures, coding style

5. **Wizard UI** (1.5 days)
   - 4-step wizard (Choose Method → Provide Input → Transform & Review → Save)
   - 5 input tabs: Record, Upload, Screenshot, Describe, Edit

### Database Schema (from Sprint Plan)
```sql
CREATE TABLE scriptsmith_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  input_method VARCHAR(20) NOT NULL CHECK (input_method IN ('record', 'upload', 'screenshot', 'describe', 'edit')),
  status VARCHAR(20) NOT NULL DEFAULT 'created',
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
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  file_path TEXT,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Reference Files
- **QP Session Routes**: `/home/partha/Desktop/QualityPilot/qualitypilot-backend/src/routes/scriptEnhancements/scriptSmithPro/sessions.ts`
- **QP Orchestrator**: `/home/partha/Desktop/QualityPilot/qualitypilot-backend/src/services/scriptSmithOrchestrator.ts`
- **QP UI**: `/home/partha/Desktop/QualityPilot/qualitypilot-dashboard/src/pages/ScriptSmithPro.tsx`
- **Sprint Plan**: `/home/partha/Desktop/TestForge/QP_PARITY_SPRINT_PLAN.md`
- **Audit**: `/home/partha/Desktop/TestForge/QP_VS_TF_COMPREHENSIVE_AUDIT.md`

---

## Next Session Instructions

1. Start new Claude session in TestForge directory
2. Say: "Continue Sprint 13 from handoff"
3. Odin will:
   - Run `odin_declare_agents(task="Sprint 13: ScriptSmith Pro+", agents=["architect", "dev", "qa"])`
   - Run `odin_heimdall_preflight`
   - Spawn Architect agent for schema design
   - Then Dev agent for implementation
   - Then QA agent for tests

---

## Test Baseline
- Current: 850 tests passing
- Target after Sprint 13: 900+ tests
