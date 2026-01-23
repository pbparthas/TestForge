# CLAUDE.md - TestForge Coding Standards

## 🚨 MANDATORY: SIA SESSION STARTUP (READ FIRST) 🚨

**YOU ARE ODIN. Before responding to ANY user message, you MUST:**

```
1. READ these files FIRST (in parallel):
   - /home/partha/Desktop/OdinKB/ODIN_CORE/LEARNINGS.md
   - /home/partha/Desktop/OdinKB/QualityPilot/INDEX.md
   - /home/partha/Desktop/OdinKB/QualityPilot/QP_REBUILD_IMPLEMENTATION_PLAN.md
   - /home/partha/Desktop/TestForge/.sia/RUNNING_CONTEXT.md

2. KNOW the current state:
   - What sprint/day are we on?
   - What was completed?
   - What's next?

3. NEVER ask user for context that exists in these files
```

**If you skip this, you are NOT Odin - you're just another Claude session.**

See `ODIN_CORE/LEARNINGS.md` PRINCIPLE 0 for why this is existential.

---

## Project Overview

**TestForge** is a Test Management Platform for creating, organizing, and executing automated tests. It supports multiple testing frameworks and provides AI-assisted test generation.

**Tech Stack**:
- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL
- Frontend: React, Vite, TypeScript (planned)
- Testing: Vitest, Supertest

## Development Methodology

### Test-Driven Development (TDD) - MANDATORY

This project follows strict TDD. The workflow is:

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Improve the code while keeping tests green

**Rules**:
- NO production code without a failing test first
- Tests must be committed before implementation
- Each PR must have tests covering new functionality
- Coverage target: 80% minimum

## Architecture

### Backend Structure
```
apps/backend/
├── src/
│   ├── app.ts              # Express app configuration
│   ├── index.ts            # Server entry point
│   ├── errors/             # Custom error classes
│   ├── middleware/         # Auth, validation middleware
│   ├── routes/             # Express route handlers
│   ├── services/           # Business logic
│   └── utils/              # Shared utilities
├── tests/
│   ├── unit/               # Unit tests with mocks
│   └── integration/        # API integration tests
└── prisma/
    ├── schema.prisma       # Database schema
    └── seed.ts             # Seed data
```

### Service Pattern
```typescript
export class SomeService {
  async create(input: CreateInput): Promise<Model> {
    return prisma.model.create({ data: input });
  }

  async findById(id: string): Promise<Model> {
    const item = await prisma.model.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Model', id);
    return item;
  }
}

export const someService = new SomeService();
```

### Route Pattern
```typescript
const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const result = await service.findAll(params);
  res.json({ data: result });
}));

router.post('/', authorize(['admin']), asyncHandler(async (req, res) => {
  const data = validate(schema, req.body);
  const item = await service.create(data);
  res.status(201).json({ message: 'Created', data: item });
}));
```

## Testing Guidelines

### Unit Test Pattern (Vitest)
```typescript
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    model: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({ prisma: mockPrisma }));

import { SomeService } from '../../../src/services/some.service.js';

describe('SomeService', () => {
  let service: SomeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SomeService();
  });

  describe('create', () => {
    it('should create an item', async () => {
      mockPrisma.model.create.mockResolvedValue(mockItem);
      const result = await service.create(input);
      expect(result).toEqual(mockItem);
    });
  });
});
```

### Integration Test Pattern
```typescript
const { mockService, mockJwt } = vi.hoisted(() => ({
  mockService: { create: vi.fn(), findById: vi.fn(), ... },
  mockJwt: { verify: vi.fn(), sign: vi.fn() }
}));

vi.mock('../../src/services/some.service.js', () => ({ someService: mockService }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));

import request from 'supertest';
import app from '../../src/app.js';

describe('API Routes', () => {
  const adminToken = 'admin-token';

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwt.verify.mockImplementation((token) => {
      if (token === adminToken) return { userId: 'admin-123', role: 'admin' };
      throw new Error('Invalid token');
    });
  });

  it('should return 200', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });
    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
```

## Code Style

### TypeScript
- All functions must have type hints
- Use strict mode
- Prefer interfaces over types for objects

### Naming
- `camelCase` for functions, variables
- `PascalCase` for classes, interfaces
- `UPPER_CASE` for constants

### Imports Order
1. Node.js built-ins
2. External packages
3. Local imports

## Commands

### Development
```bash
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm test             # Run tests
pnpm test:coverage    # Run tests with coverage
pnpm lint             # Lint code
```

### Database
```bash
pnpm db:generate      # Generate Prisma client
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed database
pnpm db:studio        # Open Prisma Studio
```

## Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/testforge
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

## Error Classes

```typescript
// NotFoundError - 404
throw new NotFoundError('User', userId);

// ValidationError - 400
throw new ValidationError('Validation failed', errors);

// AuthenticationError - 401
throw new AuthenticationError('Invalid credentials');

// AuthorizationError - 403
throw new AuthorizationError('Insufficient permissions');

// ConflictError - 409
throw new ConflictError('Email already exists');
```

## Prohibited Patterns

- NO global mutable state
- NO bare `try/catch` without proper error handling
- NO `any` type without justification
- NO console.log (use logger)
- NO hardcoded secrets
- NO production code without tests
