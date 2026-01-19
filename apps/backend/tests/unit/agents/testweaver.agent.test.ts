/**
 * TestWeaver Agent Tests - Sprint 8
 * Tests for test case generation with screenshot, file upload, conversation, batch, and AI mapping
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Anthropic client - must be hoisted with vi.hoisted
const { mockAnthropicClient, mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockAnthropicClient: {
    messages: {
      create: vi.fn(),
    },
  },
}));

// Assign the mock function to the client
mockAnthropicClient.messages.create = mockCreate;

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => mockAnthropicClient),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import {
  TestWeaverAgent,
  GenerateInput,
  GenerateOutput,
  BatchGenerateInput,
  EvolveInput,
  GeneratedTestCase,
  AIMapping,
} from '../../../src/agents/testweaver.agent.js';

describe('TestWeaverAgent', () => {
  let agent: TestWeaverAgent;
  let fastAgent: TestWeaverAgent; // Agent with fast retries for failure tests

  // Sample generated test case
  const mockTestCase: GeneratedTestCase = {
    title: 'Login with valid credentials',
    description: 'Verify user can login',
    preconditions: 'User exists',
    steps: [
      { order: 1, action: 'Enter username', expected: 'Field populated' },
      { order: 2, action: 'Enter password', expected: 'Field populated' },
      { order: 3, action: 'Click submit', expected: 'User logged in' },
    ],
    expectedResult: 'User logged in successfully',
    priority: 'high',
    type: 'functional',
    tags: ['login', 'authentication'],
  };

  // Sample generate output
  const mockGenerateOutput: GenerateOutput = {
    testCases: [mockTestCase],
    summary: {
      total: 1,
      byPriority: { high: 1 },
      byType: { functional: 1 },
    },
  };

  // Sample AI mapping
  const mockMapping: AIMapping = {
    product: 'TestForge',
    partner: 'QA Team',
    module: 'Authentication',
    confidence: { product: 0.9, partner: 0.7, module: 0.85 },
    suggestedTags: ['login', 'auth', 'security'],
  };

  // Mock API response helper
  const createMockResponse = (content: string) => ({
    content: [{ type: 'text' as const, text: content }],
    usage: {
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new TestWeaverAgent();
    // Create an agent with maxRetries: 1 for faster failure tests
    fastAgent = new TestWeaverAgent({ maxRetries: 1 });
  });

  // ============================================================================
  // generate() - Natural Language / Specification Tests
  // ============================================================================

  describe('generate() - natural_language input', () => {
    it('should generate test cases from specification', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        specification: 'User should be able to login with username and password',
        inputMethod: 'natural_language',
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
      expect(result.data.testCases[0].title).toBe('Login with valid credentials');
      expect(result.data.summary.total).toBe(1);
      expect(result.usage.inputTokens).toBe(1000);
      expect(result.usage.outputTokens).toBe(500);
    });

    it('should generate test cases with options', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        specification: 'User authentication flow',
        inputMethod: 'natural_language',
        options: {
          maxTestCases: 5,
          includeNegativeCases: true,
          includeEdgeCases: true,
          focusAreas: ['security', 'validation'],
          testTypes: ['functional', 'integration'],
        },
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.stringContaining('Maximum test cases: 5'),
            }),
          ],
        })
      );
    });

    it('should include AI mapping when requested', async () => {
      // First call for test generation
      mockCreate.mockResolvedValueOnce(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );
      // Second call for mapping
      mockCreate.mockResolvedValueOnce(
        createMockResponse(JSON.stringify({ mapping: mockMapping }))
      );

      const input: GenerateInput = {
        specification: 'Test user authentication with OAuth',
        inputMethod: 'natural_language',
        options: {
          includeMapping: true,
          mappingContext: {
            products: ['TestForge', 'QualityPilot'],
            modules: ['Authentication', 'Dashboard'],
          },
        },
      };

      const result = await agent.generate(input);

      expect(result.data.mapping).toBeDefined();
      expect(result.data.mapping?.product).toBe('TestForge');
      expect(result.data.mapping?.confidence.product).toBeGreaterThan(0);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle JSON in code blocks', async () => {
      const responseWithCodeBlock = '```json\n' + JSON.stringify(mockGenerateOutput) + '\n```';
      mockCreate.mockResolvedValue(createMockResponse(responseWithCodeBlock));

      const input: GenerateInput = {
        specification: 'Test login',
        inputMethod: 'natural_language',
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
    });

    it('should throw on invalid JSON response', async () => {
      mockCreate.mockResolvedValue(createMockResponse('not valid json'));

      const input: GenerateInput = {
        specification: 'Test login',
        inputMethod: 'natural_language',
      };

      // Use fastAgent to avoid long retry delays
      await expect(fastAgent.generate(input)).rejects.toThrow('Failed to parse JSON');
    });
  });

  // ============================================================================
  // generate() - Screenshot Input Tests (Sprint 8)
  // ============================================================================

  describe('generate() - screenshot input', () => {
    const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('should generate test cases from screenshot', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        inputMethod: 'screenshot',
        screenshot: {
          base64: mockBase64,
          mediaType: 'image/png',
        },
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
      // Verify vision API was called with image content
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'image' }),
                expect.objectContaining({ type: 'text' }),
              ]),
            }),
          ],
        })
      );
    });

    it('should include annotations in screenshot analysis', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        inputMethod: 'screenshot',
        screenshot: {
          base64: mockBase64,
          mediaType: 'image/png',
          annotations: [
            { x: 100, y: 200, label: 'Login button', type: 'click' },
            { x: 150, y: 250, label: 'Username field', type: 'input' },
          ],
          context: 'Login page',
        },
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
      // Verify annotations are included in the text prompt
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'text',
                  text: expect.stringContaining('Login button'),
                }),
              ]),
            }),
          ],
        })
      );
    });

    it('should throw error when screenshot is missing', async () => {
      const input: GenerateInput = {
        inputMethod: 'screenshot',
        // screenshot is missing
      };

      await expect(agent.generate(input)).rejects.toThrow(
        'Screenshot input is required for screenshot input method'
      );
    });

    it('should include AI mapping for screenshot when requested', async () => {
      mockCreate.mockResolvedValueOnce(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );
      mockCreate.mockResolvedValueOnce(
        createMockResponse(JSON.stringify({ mapping: mockMapping }))
      );

      const input: GenerateInput = {
        inputMethod: 'screenshot',
        screenshot: {
          base64: mockBase64,
          mediaType: 'image/png',
          context: 'Login page for authentication',
        },
        options: {
          includeMapping: true,
        },
      };

      const result = await agent.generate(input);

      expect(result.data.mapping).toBeDefined();
      expect(result.data.mapping?.product).toBe('TestForge');
    });
  });

  // ============================================================================
  // generate() - File Upload Input Tests (Sprint 8)
  // ============================================================================

  describe('generate() - file_upload input', () => {
    it('should generate test cases from CSV file', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        inputMethod: 'file_upload',
        fileUpload: {
          content: 'title,description,priority\nLogin Test,Test login flow,high\nLogout Test,Test logout,medium',
          fileName: 'test_cases.csv',
          mimeType: 'text/csv',
        },
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
      // Verify CSV was parsed and included in prompt
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.stringContaining('Login Test'),
            }),
          ],
        })
      );
    });

    it('should generate test cases from JSON file', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const jsonContent = JSON.stringify({
        tests: [{ name: 'Login', steps: ['Go to login', 'Enter creds'] }],
      });

      const input: GenerateInput = {
        inputMethod: 'file_upload',
        fileUpload: {
          content: jsonContent,
          fileName: 'tests.json',
          mimeType: 'application/json',
        },
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
    });

    it('should handle column mapping for CSV', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        inputMethod: 'file_upload',
        fileUpload: {
          content: 'tc_name,tc_desc\nTest 1,Description 1',
          fileName: 'tests.csv',
          mimeType: 'text/csv',
          mapping: { tc_name: 'title', tc_desc: 'description' },
        },
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.stringContaining('tc_name'),
            }),
          ],
        })
      );
    });

    it('should handle plain text file', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        inputMethod: 'file_upload',
        fileUpload: {
          content: 'User should be able to login\nUser should be able to logout',
          fileName: 'requirements.txt',
          mimeType: 'text/plain',
        },
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
    });

    it('should handle markdown file', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        inputMethod: 'file_upload',
        fileUpload: {
          content: '# Test Requirements\n\n- Login functionality\n- Logout functionality',
          fileName: 'requirements.md',
          mimeType: 'text/markdown',
        },
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
    });

    it('should throw error when file upload is missing', async () => {
      const input: GenerateInput = {
        inputMethod: 'file_upload',
        // fileUpload is missing
      };

      await expect(agent.generate(input)).rejects.toThrow(
        'File upload input is required for file_upload input method'
      );
    });

    it('should handle malformed JSON in file gracefully', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        inputMethod: 'file_upload',
        fileUpload: {
          content: '{ invalid json content',
          fileName: 'tests.json',
          mimeType: 'application/json',
        },
      };

      // Should not throw - passes raw content to AI
      const result = await agent.generate(input);
      expect(result.data.testCases).toHaveLength(1);
    });

    it('should handle empty CSV rows', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        inputMethod: 'file_upload',
        fileUpload: {
          content: 'title,description\nTest 1,Desc 1\n\nTest 2,Desc 2\n',
          fileName: 'tests.csv',
          mimeType: 'text/csv',
        },
      };

      const result = await agent.generate(input);
      expect(result.data.testCases).toHaveLength(1);
    });
  });

  // ============================================================================
  // generate() - Conversation Input Tests (Sprint 8)
  // ============================================================================

  describe('generate() - conversation input', () => {
    it('should generate test cases from conversation', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        inputMethod: 'conversation',
        conversation: [
          { role: 'user', content: 'I want to test a login feature' },
          { role: 'assistant', content: 'What authentication methods do you support?' },
          { role: 'user', content: 'Username/password and OAuth' },
        ],
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
      // Verify multi-turn conversation was passed
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
            expect.objectContaining({ role: 'assistant' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        })
      );
    });

    it('should throw error when conversation is missing', async () => {
      const input: GenerateInput = {
        inputMethod: 'conversation',
        // conversation is missing
      };

      await expect(agent.generate(input)).rejects.toThrow(
        'Conversation history is required for conversation input method'
      );
    });

    it('should throw error when conversation is empty', async () => {
      const input: GenerateInput = {
        inputMethod: 'conversation',
        conversation: [],
      };

      await expect(agent.generate(input)).rejects.toThrow(
        'Conversation history is required for conversation input method'
      );
    });

    it('should include AI mapping for conversation when requested', async () => {
      mockCreate.mockResolvedValueOnce(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );
      mockCreate.mockResolvedValueOnce(
        createMockResponse(JSON.stringify({ mapping: mockMapping }))
      );

      const input: GenerateInput = {
        inputMethod: 'conversation',
        conversation: [
          { role: 'user', content: 'I want to test authentication' },
        ],
        options: {
          includeMapping: true,
          mappingContext: { products: ['TestForge'] },
        },
      };

      const result = await agent.generate(input);

      expect(result.data.mapping).toBeDefined();
    });
  });

  // ============================================================================
  // batchGenerate() Tests (Sprint 8)
  // ============================================================================

  describe('batchGenerate()', () => {
    it('should batch generate test cases from multiple specifications', async () => {
      // Each spec gets its own call
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: BatchGenerateInput = {
        specifications: [
          { id: 'spec-1', content: 'User should be able to login', inputMethod: 'natural_language' },
          { id: 'spec-2', content: 'User should be able to logout', inputMethod: 'natural_language' },
        ],
      };

      const result = await agent.batchGenerate(input);

      expect(result.data.results).toHaveLength(2);
      expect(result.data.summary.total).toBe(2);
      expect(result.data.summary.successful).toBe(2);
      expect(result.data.summary.failed).toBe(0);
      expect(result.data.summary.totalTestCases).toBe(2);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch', async () => {
      // First spec succeeds, second spec fails (only 1 retry with fastAgent)
      mockCreate
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGenerateOutput)))
        .mockRejectedValueOnce(new Error('API Error'));

      const input: BatchGenerateInput = {
        specifications: [
          { id: 'spec-1', content: 'This will succeed', inputMethod: 'natural_language' },
          { id: 'spec-2', content: 'This will fail', inputMethod: 'natural_language' },
        ],
      };

      // Use fastAgent to avoid long retry delays
      const result = await fastAgent.batchGenerate(input);

      expect(result.data.summary.successful).toBe(1);
      expect(result.data.summary.failed).toBe(1);
      expect(result.data.results[0].success).toBe(true);
      expect(result.data.results[1].success).toBe(false);
      expect(result.data.results[1].error).toBeDefined();
    });

    it('should handle all failures in batch', async () => {
      // All calls fail (only 1 retry with fastAgent)
      mockCreate.mockRejectedValue(new Error('API Error'));

      const input: BatchGenerateInput = {
        specifications: [
          { id: 'spec-1', content: 'This will fail', inputMethod: 'natural_language' },
          { id: 'spec-2', content: 'This will also fail', inputMethod: 'natural_language' },
        ],
      };

      // Use fastAgent to avoid long retry delays
      const result = await fastAgent.batchGenerate(input);

      expect(result.data.summary.successful).toBe(0);
      expect(result.data.summary.failed).toBe(2);
      expect(result.data.summary.totalTestCases).toBe(0);
      expect(result.data.results.every(r => r.success === false)).toBe(true);
    });

    it('should pass options to each specification', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: BatchGenerateInput = {
        specifications: [
          { id: 'spec-1', content: 'Test login', inputMethod: 'natural_language' },
        ],
        options: {
          maxTestCases: 5,
          includeNegativeCases: true,
        },
      };

      await agent.batchGenerate(input);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.stringContaining('Maximum test cases: 5'),
            }),
          ],
        })
      );
    });

    it('should accumulate usage across batch', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: BatchGenerateInput = {
        specifications: [
          { id: 'spec-1', content: 'Test login', inputMethod: 'natural_language' },
          { id: 'spec-2', content: 'Test logout', inputMethod: 'natural_language' },
        ],
      };

      const result = await agent.batchGenerate(input);

      // Each call has 1000 input + 500 output tokens
      expect(result.usage.inputTokens).toBe(2000);
      expect(result.usage.outputTokens).toBe(1000);
    });
  });

  // ============================================================================
  // evolve() Tests
  // ============================================================================

  describe('evolve()', () => {
    const mockEvolveOutput = {
      unchanged: ['tc-1'],
      modified: [
        {
          id: 'tc-2',
          changes: ['Step 2 updated'],
          updatedTestCase: mockTestCase,
        },
      ],
      deprecated: [{ id: 'tc-3', reason: 'Feature removed' }],
      newTestCases: [mockTestCase],
      migrationGuide: 'Update tc-2, remove tc-3, add new test for OAuth',
    };

    it('should evolve test cases based on specification changes', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockEvolveOutput))
      );

      const input: EvolveInput = {
        existingTestCases: [
          { id: 'tc-1', title: 'Test 1', description: 'Desc', steps: [] },
          { id: 'tc-2', title: 'Test 2', description: 'Desc', steps: [] },
        ],
        oldSpecification: 'User login with username/password',
        newSpecification: 'User login with username/password and OAuth',
      };

      const result = await agent.evolve(input);

      expect(result.data.unchanged).toContain('tc-1');
      expect(result.data.modified).toHaveLength(1);
      expect(result.data.deprecated).toHaveLength(1);
      expect(result.data.newTestCases).toHaveLength(1);
      expect(result.data.migrationGuide).toBeDefined();
    });
  });

  // ============================================================================
  // Retry Logic Tests
  // ============================================================================

  describe('retry logic', () => {
    it('should retry on failure and succeed', async () => {
      // Create agent with maxRetries: 2 so we can test retry behavior
      const retryAgent = new TestWeaverAgent({ maxRetries: 2 });

      mockCreate
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(createMockResponse(JSON.stringify(mockGenerateOutput)));

      const input: GenerateInput = {
        specification: 'Test login',
        inputMethod: 'natural_language',
      };

      const result = await retryAgent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    }, 10000); // Extended timeout for retry delays

    it('should throw after max retries', async () => {
      mockCreate.mockRejectedValue(new Error('Persistent error'));

      const input: GenerateInput = {
        specification: 'Test login',
        inputMethod: 'natural_language',
      };

      // Use fastAgent (maxRetries: 1) for faster test
      await expect(fastAgent.generate(input)).rejects.toThrow('Persistent error');
      expect(mockCreate).toHaveBeenCalledTimes(1); // fastAgent has maxRetries: 1
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle empty test case array in response', async () => {
      const emptyOutput: GenerateOutput = {
        testCases: [],
        summary: { total: 0, byPriority: {}, byType: {} },
      };
      mockCreate.mockResolvedValue(createMockResponse(JSON.stringify(emptyOutput)));

      const input: GenerateInput = {
        specification: 'Very simple requirement',
        inputMethod: 'natural_language',
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(0);
      expect(result.data.summary.total).toBe(0);
    });

    it('should handle mapping with no context', async () => {
      mockCreate.mockResolvedValueOnce(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );
      mockCreate.mockResolvedValueOnce(
        createMockResponse(JSON.stringify({ mapping: mockMapping }))
      );

      const input: GenerateInput = {
        specification: 'Test authentication',
        inputMethod: 'natural_language',
        options: {
          includeMapping: true,
          // No mappingContext provided
        },
      };

      const result = await agent.generate(input);

      expect(result.data.mapping).toBeDefined();
    });

    it('should handle special characters in specification', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const input: GenerateInput = {
        specification: 'Test with special chars: <>&"\'',
        inputMethod: 'natural_language',
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
    });

    it('should handle very long specification', async () => {
      mockCreate.mockResolvedValue(
        createMockResponse(JSON.stringify(mockGenerateOutput))
      );

      const longSpec = 'Test requirement. '.repeat(1000);
      const input: GenerateInput = {
        specification: longSpec,
        inputMethod: 'natural_language',
      };

      const result = await agent.generate(input);

      expect(result.data.testCases).toHaveLength(1);
    });
  });
});
