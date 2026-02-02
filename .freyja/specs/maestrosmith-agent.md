# MaestroSmith Agent - Design Spec

**Created**: 2026-01-31
**Updated**: 2026-02-02
**Status**: Ready for Approval
**Author**: Odin

---

## Overview

MaestroSmith is an AI agent that generates Maestro YAML flows for Flutter mobile app automation. It combines test cases from TestForge with a widget registry extracted from the Flutter codebase to produce reliable, identifier-based automation scripts.

## Goals

1. Generate Maestro YAML flows from test cases or natural language descriptions
2. Use accessibility identifiers (from `eventName`) for reliable element targeting
3. Integrate with existing TF infrastructure (scripts table, AI usage tracking)
4. Provide edit/refine capabilities for existing flows

## Non-Goals (v1)

- Sub-flow support (`runFlow` references)
- Visual screenshot analysis
- Maestro Cloud integration
- Auto-routing orchestrator

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BANKBAZAAR SIDE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐         ┌────────────────┐         ┌────────────────┐  │
│  │ Flutter        │         │ GitLab CI      │         │ GitLab         │  │
│  │ Codebase       │────────►│ Extract Script │────────►│ Artifact       │  │
│  │ (200 eventNames│         │                │         │ (registry.json)│  │
│  │  in 86 files)  │         └────────────────┘         └───────┬────────┘  │
│  └────────────────┘                                             │           │
│                                                                 │           │
│  ┌────────────────┐                                             │           │
│  │ Platform       │                                             │           │
│  │ Widgets with   │  (Semantics wrapper - pending dev work)     │           │
│  │ Semantics      │                                             │           │
│  └────────────────┘                                             │           │
└─────────────────────────────────────────────────────────────────┼───────────┘
                                                                  │
                                            GitLab API            │
                                            GET artifact          │
                                                                  │
┌─────────────────────────────────────────────────────────────────┼───────────┐
│                              TESTFORGE SIDE                      │           │
├─────────────────────────────────────────────────────────────────┼───────────┤
│                                                                  ▼           │
│  ┌────────────────┐         ┌────────────────┐         ┌────────────────┐  │
│  │ User clicks    │         │ MaestroService │◄────────│ Registry Cache │  │
│  │ "Sync Registry"│────────►│ fetchRegistry()│────────►│ (in-memory)    │  │
│  └────────────────┘         └────────────────┘         └───────┬────────┘  │
│                                                                 │           │
│  ┌────────────────┐         ┌────────────────┐                 │           │
│  │ Test Cases     │────────►│ MaestroSmith   │◄────────────────┘           │
│  │ (from TF)      │         │ Agent          │                              │
│  └────────────────┘         └───────┬────────┘                              │
│                                     │                                        │
│                                     ▼                                        │
│                             ┌────────────────┐                              │
│                             │ Maestro YAML   │                              │
│                             │ Flow Output    │                              │
│                             └────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## BB Side: Prerequisites

### 1. Semantics Wrapper (Dev Team - One-Time)

Add `Semantics` wrapper to platform widgets using existing `eventName`:

**File: `lib/src/platform/widgets/tappable_widget.dart`**
```dart
@override
Widget build(BuildContext context) {
  Widget tappable = _type == _TapType.gestureDetector
      ? _returnGestureDetector()
      : _returnInkWell();

  return Semantics(
    identifier: eventName,  // ADD THIS
    child: tappable,
  );
}
```

**File: `lib/src/platform/widgets/button.dart`**
```dart
@override
Widget build(BuildContext context) {
  // ... existing button creation logic ...

  return Semantics(
    identifier: analyticsEventData.eventName,  // ADD THIS
    child: button,
  );
}
```

**Effort:** ~10 lines across 2 files
**Result:** All 200 eventNames become Maestro-targetable identifiers

See: `docs/MAESTRO_SEMANTICS_PROPOSAL.md` for full details.

### 2. Registry Extract Script

**File: `tools/extract_maestro_registry.dart`**
```dart
import 'dart:io';
import 'dart:convert';

void main() {
  final widgets = <Map<String, dynamic>>[];

  final dartFiles = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'));

  // Extract all eventName occurrences
  final pattern = RegExp(r'eventName:\s*["\x27]([^"\x27]+)["\x27]');

  for (final file in dartFiles) {
    final content = file.readAsStringSync();
    for (final match in pattern.allMatches(content)) {
      widgets.add({
        'eventName': match.group(1),
        'file': file.path.replaceFirst('lib/', ''),
      });
    }
  }

  final registry = {
    'appId': 'com.bankbazaar.app',
    'version': Platform.environment['CI_COMMIT_SHA'] ?? 'local',
    'generated': DateTime.now().toIso8601String(),
    'widgetCount': widgets.length,
    'widgets': widgets,
  };

  File('maestro_registry.json').writeAsStringSync(
    JsonEncoder.withIndent('  ').convert(registry),
  );

  print('Extracted ${widgets.length} widget identifiers');
}
```

### 3. GitLab CI Job

**File: `.gitlab-ci.yml`**
```yaml
extract-maestro-registry:
  stage: build
  script:
    - dart run tools/extract_maestro_registry.dart
  artifacts:
    paths:
      - maestro_registry.json
    expire_in: never
  only:
    - main
```

---

## TF Side: New Files

```
apps/backend/
├── src/
│   ├── agents/
│   │   └── maestrosmith.agent.ts      # AI agent for YAML generation
│   ├── services/
│   │   └── maestro.service.ts         # Registry fetch, YAML validation, caching
│   └── routes/
│       └── maestro.routes.ts          # API endpoints
├── tests/
│   ├── unit/agents/
│   │   └── maestrosmith.agent.test.ts
│   └── integration/
│       └── maestro.integration.test.ts
└── prisma/
    └── schema.prisma                  # Add 'maestro' framework, 'yaml' language
```

---

## Schema Changes

```prisma
enum Framework {
  playwright
  cypress
  maestro      // NEW
}

enum Language {
  typescript
  javascript
  yaml         // NEW
}
```

---

## Service Design

### MaestroService

```typescript
// services/maestro.service.ts

interface GitLabConfig {
  host: string;           // https://gitlab.com or self-hosted
  projectId: string;      // BB project ID
  branch: string;         // main
  jobName: string;        // extract-maestro-registry
  artifactPath: string;   // maestro_registry.json
  accessToken: string;    // GitLab token with read_api scope
}

interface Registry {
  appId: string;
  version: string;
  generated: string;
  widgetCount: number;
  widgets: Array<{
    eventName: string;
    file: string;
  }>;
}

interface SyncResult {
  success: boolean;
  widgetCount: number;
  version: string;
  fetchedAt: Date;
}

export class MaestroService {
  // In-memory cache (per project)
  private registryCache: Map<string, { data: Registry; fetchedAt: Date }> = new Map();

  /**
   * Fetch registry from GitLab artifact (manual sync)
   */
  async syncRegistry(projectId: string): Promise<SyncResult> {
    const config = await this.getGitLabConfig(projectId);

    const url = `${config.host}/api/v4/projects/${config.projectId}/jobs/artifacts/${config.branch}/raw/${config.artifactPath}?job=${config.jobName}`;

    const response = await fetch(url, {
      headers: { 'PRIVATE-TOKEN': config.accessToken },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch registry: ${response.status}`);
    }

    const registry: Registry = await response.json();

    this.registryCache.set(projectId, {
      data: registry,
      fetchedAt: new Date(),
    });

    return {
      success: true,
      widgetCount: registry.widgetCount,
      version: registry.version,
      fetchedAt: new Date(),
    };
  }

  /**
   * Get cached registry
   */
  getRegistry(projectId: string): Registry | null {
    return this.registryCache.get(projectId)?.data ?? null;
  }

  /**
   * Get registry status
   */
  getRegistryStatus(projectId: string): { cached: boolean; version?: string; fetchedAt?: Date } {
    const cached = this.registryCache.get(projectId);
    if (!cached) return { cached: false };
    return {
      cached: true,
      version: cached.data.version,
      fetchedAt: cached.fetchedAt,
    };
  }

  /**
   * Lookup widget by eventName
   */
  lookupWidget(projectId: string, eventName: string): { found: boolean; file?: string } {
    const registry = this.getRegistry(projectId);
    if (!registry) return { found: false };

    const widget = registry.widgets.find(w => w.eventName === eventName);
    return widget ? { found: true, file: widget.file } : { found: false };
  }

  /**
   * Validate Maestro YAML syntax
   */
  validateYaml(yaml: string): { valid: boolean; errors?: string[] } {
    // Parse YAML, check for required appId, valid commands, etc.
  }

  /**
   * Analyze selectors in YAML - warn if text-based
   */
  analyzeSelectors(projectId: string, yaml: string): string[] {
    const warnings: string[] = [];
    const registry = this.getRegistry(projectId);

    // Parse YAML, find tapOn/assertVisible commands
    // Check if they use id: (good) or text (warn)
    // Check if id exists in registry

    return warnings;
  }
}
```

---

## Agent Design

### MaestroSmithAgent

```typescript
// agents/maestrosmith.agent.ts

export interface MaestroFlowInput {
  inputMethod: 'test_case' | 'description';

  testCase?: {
    id?: string;
    title: string;
    steps: Array<{ order: number; action: string; expected: string }>;
    preconditions?: string;
  };

  description?: string;

  options: {
    appId: string;
    projectId: string;
    includeAssertions?: boolean;
  };
}

export interface MaestroFlowOutput {
  name: string;
  yaml: string;
  appId: string;
  commands: string[];
  warnings: string[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    costInr: number;
    model: string;
    durationMs: number;
  };
}

export interface EditFlowInput {
  existingYaml: string;
  instruction: string;
  projectId: string;
  context?: {
    errorMessage?: string;
    failedCommand?: string;
  };
}

export interface EditFlowOutput {
  yaml: string;
  changes: string[];
  explanation: string;
  warnings: string[];
  usage: { /* same as above */ };
}
```

### System Prompts

```typescript
const GENERATE_SYSTEM_PROMPT = `You are MaestroSmith, an expert at generating Maestro YAML flows for Flutter mobile app automation.

## Maestro Basics
- Flows are YAML files starting with appId header, then --- separator, then commands
- Maestro has built-in auto-wait - no explicit sleeps needed
- Commands are sequential, each on a new line starting with -

## Available Commands
| Command | Description | Example |
|---------|-------------|---------|
| launchApp | Start app | - launchApp: { clearState: true } |
| tapOn | Tap element | - tapOn: { id: "login_btn" } |
| inputText | Enter text | - inputText: "hello" |
| assertVisible | Check visible | - assertVisible: "Welcome" |
| assertNotVisible | Check gone | - assertNotVisible: "Loading" |
| scroll | Scroll direction | - scroll: { direction: DOWN } |
| scrollUntilVisible | Scroll to find | - scrollUntilVisible: { element: { id: "item" } } |
| swipe | Swipe gesture | - swipe: { direction: LEFT } |
| back | Android back | - back |
| hideKeyboard | Dismiss keyboard | - hideKeyboard |
| takeScreenshot | Capture screen | - takeScreenshot: "step1" |

## Selector Priority
1. ALWAYS prefer id-based selectors: tapOn: { id: "eventName" }
2. Only use text selectors if no id available: tapOn: "Button Text"
3. If using text selector, note it in warnings

## Widget Registry
You will be provided with a registry of available widget identifiers (eventNames).
Match test case actions to registry eventNames when possible.

## Output Format
Return JSON:
{
  "name": "flow_name.yaml",
  "yaml": "appId: com.example.app\\n---\\n- launchApp\\n...",
  "commands": ["launchApp", "tapOn", "inputText"],
  "warnings": ["Text-based selector used for 'Submit' - no matching eventName found"]
}`;

const EDIT_SYSTEM_PROMPT = `You are MaestroSmith, an expert at fixing and improving Maestro YAML flows.

## Guidelines
1. Understand the existing flow structure
2. Make minimal changes to address the instruction
3. Maintain YAML formatting and indentation
4. Prefer id-based selectors over text
5. If error context provided, focus on fixing that specific issue

## Output Format
Return JSON:
{
  "yaml": "# Updated flow...",
  "changes": ["Changed selector from 'Login' to id: login_btn"],
  "explanation": "Brief explanation of changes"
}`;
```

---

## API Design

### Routes

```
POST /api/maestro/sync              # Fetch registry from GitLab (manual trigger)
GET  /api/maestro/registry          # Get cached registry status
GET  /api/maestro/registry/widgets  # List all widgets in registry
POST /api/maestro/generate          # Generate flow from test case/description
POST /api/maestro/edit              # Edit existing flow
POST /api/maestro/validate          # Validate YAML syntax
GET  /api/maestro/commands          # List available Maestro commands (reference)
```

### Request/Response Examples

**Sync Registry**
```bash
POST /api/maestro/sync
Authorization: Bearer <token>
Content-Type: application/json

{ "projectId": "proj_123" }

# Response
{
  "success": true,
  "widgetCount": 200,
  "version": "abc123def",
  "fetchedAt": "2026-02-02T12:00:00Z"
}
```

**Generate Flow**
```bash
POST /api/maestro/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "inputMethod": "test_case",
  "testCase": {
    "title": "User Login",
    "steps": [
      { "order": 1, "action": "Open app", "expected": "Login screen shown" },
      { "order": 2, "action": "Enter mobile number 9876543210", "expected": "Number entered" },
      { "order": 3, "action": "Tap Get OTP button", "expected": "OTP screen shown" },
      { "order": 4, "action": "Enter OTP 1234", "expected": "OTP entered" },
      { "order": 5, "action": "Tap Verify button", "expected": "Dashboard shown" }
    ]
  },
  "options": {
    "appId": "com.bankbazaar.app",
    "projectId": "proj_123",
    "includeAssertions": true
  }
}

# Response
{
  "data": {
    "name": "user_login.yaml",
    "yaml": "appId: com.bankbazaar.app\n---\n- launchApp:\n    clearState: true\n- assertVisible: \"Login\"\n- tapOn:\n    id: \"Login\"\n- inputText: \"9876543210\"\n- hideKeyboard\n- tapOn:\n    id: \"LoginAttempt\"\n- assertVisible: \"OTP\"\n- tapOn:\n    id: \"Login_OTP\"\n- inputText: \"1234\"\n- tapOn:\n    id: \"LoginAttempt\"\n- assertVisible: \"Dashboard\"",
    "appId": "com.bankbazaar.app",
    "commands": ["launchApp", "assertVisible", "tapOn", "inputText", "hideKeyboard"],
    "warnings": []
  },
  "usage": {
    "inputTokens": 850,
    "outputTokens": 320,
    "costUsd": 0.0062,
    "costInr": 0.52,
    "model": "claude-sonnet-4-20250514",
    "durationMs": 2450
  }
}
```

---

## Selector Strategy

| Priority | Selector Type | When Used | Example |
|----------|---------------|-----------|---------|
| 1 | `id: "eventName"` | Widget found in registry | `tapOn: { id: "LoginAttempt" }` |
| 2 | `"visible text"` | No registry match | `tapOn: "Submit"` |

**Warning generated for text-based selectors:**
```json
{
  "warnings": [
    "Text-based selector used for 'Submit' - consider adding eventName to widget"
  ]
}
```

---

## Configuration

### TF Project Settings (New)

```typescript
interface MaestroConfig {
  enabled: boolean;
  gitlab: {
    host: string;           // https://gitlab.com
    projectId: string;      // 12345678
    branch: string;         // main
    jobName: string;        // extract-maestro-registry
    artifactPath: string;   // maestro_registry.json
    accessToken: string;    // encrypted, read_api scope
  };
  defaultAppId: string;     // com.bankbazaar.app
}
```

---

## Caching

| Location | What | Duration |
|----------|------|----------|
| BB GitLab | `maestro_registry.json` artifact | Permanent (expire_in: never) |
| TF | In-memory cache per project | Until server restart or manual sync |

**Future:** Add Redis for persistence across restarts.

---

## Integration Points

### 1. Script Storage

MaestroSmith flows stored in existing `Script` table:
- `framework`: 'maestro'
- `language`: 'yaml'
- `code`: YAML content
- `generatedBy`: 'maestrosmith'

### 2. AI Usage Tracking

Uses BaseAgent's cost calculation, same as other agents.

### 3. Test Case Linking

Flows link to test cases via `testCaseId`, same as Playwright scripts.

---

## Implementation Phases

| Phase | What | Owner | Status |
|-------|------|-------|--------|
| **1** | Semantics wrapper in platform widgets | BB Dev | Pending (doc sent) |
| **2** | Extract script + GitLab CI job | BB Dev | Pending |
| **3** | Schema changes (maestro, yaml enums) | TF | ✅ Complete |
| **4** | MaestroService (sync, cache, validate) | TF | ✅ Complete (31 tests) |
| **5** | MaestroSmith agent | TF | ✅ Complete (16 tests) |
| **6** | Routes + integration tests | TF | ✅ Complete (20 tests) |
| **7** | Dashboard UI | TF | ✅ Complete |

---

## BankBazaar Codebase Analysis

Based on analysis of `/home/partha/Desktop/Projects/BB/mobile_app_v2-master`:

| Metric | Value |
|--------|-------|
| Total Dart files | 447 |
| Files with eventName | 86 |
| Total eventName occurrences | 200 |
| Raw GestureDetector usage (features) | 1 |
| Existing Semantics usage | 5 |

**Key widgets with eventName (all extractable):**
- `Button` (via `analyticsEventData.eventName`)
- `TappableWidget` (via `eventName`)
- `TextField` (via `eventName`)
- `OtpPincodeField` (via `eventName`)
- `TnCWidget` (via `eventName`)

**Conclusion:** Codebase is 99% ready. Only the Semantics wrapper is needed.

---

## Maestro Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `launchApp` | Start the app | `- launchApp: { clearState: true }` |
| `tapOn` | Tap element | `- tapOn: { id: "btn" }` or `- tapOn: "Text"` |
| `inputText` | Enter text | `- inputText: "hello"` |
| `assertVisible` | Check element visible | `- assertVisible: "Welcome"` |
| `assertNotVisible` | Check element gone | `- assertNotVisible: "Loading"` |
| `scroll` | Scroll direction | `- scroll: { direction: DOWN }` |
| `scrollUntilVisible` | Scroll to find | `- scrollUntilVisible: { element: { id: "X" } }` |
| `swipe` | Swipe gesture | `- swipe: { direction: LEFT }` |
| `back` | Android back | `- back` |
| `hideKeyboard` | Dismiss keyboard | `- hideKeyboard` |
| `extendedWaitUntil` | Wait with timeout | `- extendedWaitUntil: { visible: "X", timeout: 5000 }` |
| `repeat` | Loop commands | `- repeat: { times: 3, commands: [...] }` |
| `runFlow` | Include sub-flow | `- runFlow: { file: login.yaml }` |
| `takeScreenshot` | Capture screen | `- takeScreenshot: "step1"` |
| `setLocation` | Mock GPS | `- setLocation: { lat: 12.97, lng: 77.59 }` |

---

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Registry storage | GitLab artifact (BB side) | BB owns their data, TF just fetches |
| Registry sync | Manual trigger in TF | User controls when to update |
| TF caching | In-memory | Simple, can add Redis later |
| Identifier source | eventName (existing) | Already unique, used for analytics |
| Static embedding | No | Maintenance burden, drift risk |
| Templates | No | Dynamic generation more flexible |
| Text selector | Allowed with warning | Fallback when no identifier |

---

## Approval

- [ ] Design approved by user
- [ ] Ready for implementation
