# Testing Guide

This document provides information about the test suite for the Agentic Songwriter project.

## Setup

### Install Dependencies

First, install the testing dependencies:

```bash
npm install
```

This will install all required testing packages including Jest, React Testing Library, and TypeScript types.

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

The test suite is organized as follows:

```
├── __tests__/
│   └── utils/
│       └── test-helpers.ts          # Shared test utilities and mocks
├── lib/
│   └── agent/
│       ├── core/
│       │   └── __tests__/
│       │       ├── state-store.test.ts
│       │       ├── approval-store.test.ts
│       │       ├── trace.test.ts
│       │       ├── tool.test.ts
│       │       └── agent.test.ts
│       ├── agents/
│       │   └── __tests__/
│       │       ├── brief-agent.test.ts
│       │       └── melody-agent.test.ts
│       ├── schemas/
│       │   └── __tests__/
│       │       └── schemas.test.ts
│       └── tools/
│           └── __tests__/           # Tool tests (can be added)
└── app/
    └── api/
        └── songs/
            └── __tests__/
                └── route.test.ts
```

## Test Categories

### 1. Unit Tests - Core Infrastructure

Tests for the foundational components:

- **StateStore** (`lib/agent/core/__tests__/state-store.test.ts`)
  - Tests for artifact storage and retrieval
  - Metadata management
  - State clearing operations

- **ApprovalStore** (`lib/agent/core/__tests__/approval-store.test.ts`)
  - Approval request creation and resolution
  - Concurrent request handling
  - Timeout and cleanup behavior

- **Trace** (`lib/agent/core/__tests__/trace.test.ts`)
  - Event logging
  - Event filtering and retrieval
  - Trace serialization

- **Tool** (`lib/agent/core/__tests__/tool.test.ts`)
  - Input/output schema validation
  - Error handling
  - Async operations

- **Agent** (`lib/agent/core/__tests__/agent.test.ts`)
  - Tool discovery
  - Agent step generation

### 2. Unit Tests - Agents

Tests for the agent implementations:

- **BriefAgent** (`lib/agent/agents/__tests__/brief-agent.test.ts`)
  - Song generation workflow
  - Evaluation logic
  - Improvement iterations
  - Language support

- **MelodyAgent** (`lib/agent/agents/__tests__/melody-agent.test.ts`)
  - Melody generation workflow
  - Evaluation logic
  - Improvement iterations
  - Parameter handling (tempo, key, timeSignature)

### 3. Schema Validation Tests

- **Schemas** (`lib/agent/schemas/__tests__/schemas.test.ts`)
  - Song structure validation
  - Melody structure validation
  - Creative brief validation
  - Evaluation schema validation
  - Edge cases and error handling

### 4. Integration Tests - API Routes

- **Songs API** (`app/api/songs/__tests__/route.test.ts`)
  - GET endpoint (listing, pagination, sorting)
  - POST endpoint (creation, validation)
  - Error handling

## Test Utilities

The `__tests__/utils/test-helpers.ts` file provides reusable utilities:

- `createMockSongStructure()` - Creates a mock song structure
- `createMockMelodyStructure()` - Creates a mock melody structure
- `createMockLyricsEvaluation()` - Creates a mock evaluation
- `createMockCreativeBrief()` - Creates a mock creative brief
- `createTestStateStore()` - Creates a fresh state store
- `createTestTrace()` - Creates a fresh trace

## Mock Mode

Tests run with `USE_MOCK_LLM=true` by default (configured in `jest.setup.js`), which means:

- LLM tools return mock data instead of making API calls
- No OpenAI API key is required for tests
- Tests run faster and are deterministic

## Coverage Goals

Aim for:
- **Core Infrastructure**: 90%+ coverage
- **Agents**: 80%+ coverage
- **Schemas**: 95%+ coverage
- **API Routes**: 70%+ coverage

## Writing New Tests

### Example: Testing a New Tool

```typescript
import { YourTool } from '../your-tool';
import { StateStore } from '../../core/state-store';
import { Trace } from '../../core/trace';

describe('YourTool', () => {
  let tool: YourTool;
  let stateStore: StateStore;
  let trace: Trace;

  beforeEach(() => {
    process.env.USE_MOCK_LLM = 'true';
    tool = new YourTool();
    stateStore = new StateStore();
    trace = new Trace();
  });

  describe('execute', () => {
    it('should process valid input', async () => {
      const result = await tool.execute({ /* test input */ });
      expect(result).toBeDefined();
    });
  });
});
```

### Example: Testing an API Route

```typescript
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    model: {
      findMany: jest.fn(),
    },
  },
}));

describe('/api/your-route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return data', async () => {
    // Mock Prisma
    (prisma.model.findMany as jest.Mock).mockResolvedValue([]);
    
    // Create request
    const req = new NextRequest('http://localhost:3000/api/your-route');
    
    // Execute
    const response = await GET(req);
    const data = await response.json();
    
    // Assert
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Setup/Teardown**: Use `beforeEach` and `afterEach` for cleanup
3. **Mocks**: Mock external dependencies (database, APIs, file system)
4. **Descriptive Names**: Use clear test and describe block names
5. **Arrange-Act-Assert**: Structure tests with clear sections
6. **Edge Cases**: Test error conditions and boundary cases
7. **Async Handling**: Properly handle async operations and promises

## Continuous Integration

Tests should be run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage
```

## Troubleshooting

### TypeScript Errors in Tests

If you see errors like "Cannot find name 'describe'", ensure:
1. `@types/jest` is installed
2. TypeScript can find the Jest types (configured in `tsconfig.json`)

### Tests Failing Due to Async Issues

Make sure to:
- Use `async/await` or return promises
- Use `jest.fn().mockResolvedValue()` for async mocks
- Wait for async operations with `await`

### Mock Mode Not Working

Check that:
- `USE_MOCK_LLM=true` is set in `jest.setup.js`
- Tools check for `process.env.USE_MOCK_LLM` in their constructors
