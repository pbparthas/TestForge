/**
 * Duplicate Detection Service
 * Sprint 14: 3-tier cascade detection (hash → Levenshtein → AI semantic)
 *
 * Detects duplicate test cases and scripts to prevent redundant test creation.
 * Uses a cost-effective cascade approach:
 * 1. Hash check (free, exact matches)
 * 2. Levenshtein distance (cheap, near matches)
 * 3. AI semantic check (expensive, only when needed)
 */

import { createHash } from 'crypto';
import type {
  DuplicateCheck,
  DuplicateSourceType,
  DuplicateMatchType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';
import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// TYPES
// =============================================================================

export interface DuplicateResult {
  isDuplicate: boolean;
  confidence: number; // 0-100
  matchType: DuplicateMatchType | null;
  similarItems: Array<{
    id: string;
    name: string;
    similarity: number; // 0-100
    path?: string;
  }>;
  recommendation?: string;
  checkId?: string;
}

export interface SimilarItem {
  id: string;
  name: string;
  content: string;
  path?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Thresholds for duplicate detection
const EXACT_MATCH_THRESHOLD = 100; // Hash match
const NEAR_MATCH_THRESHOLD = 85; // Levenshtein similarity %
const SEMANTIC_MATCH_THRESHOLD = 80; // AI similarity %

// Levenshtein threshold before falling back to AI
const LEVENSHTEIN_FALLBACK_THRESHOLD = 60;

// Maximum items to compare with AI (cost control)
const MAX_AI_COMPARISONS = 5;

// =============================================================================
// SERVICE
// =============================================================================

export class DuplicateDetectionService {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Check a test case for duplicates
   */
  async checkTestCase(
    content: string,
    projectId: string,
    testCaseId?: string
  ): Promise<DuplicateResult> {
    // Get existing test cases in project
    const existingTestCases = await prisma.testCase.findMany({
      where: {
        projectId,
        id: testCaseId ? { not: testCaseId } : undefined, // Exclude self
      },
      select: {
        id: true,
        title: true,
        description: true,
        steps: true,
        expectedResult: true,
      },
    });

    const existingItems: SimilarItem[] = existingTestCases.map(tc => ({
      id: tc.id,
      name: tc.title,
      content: this.normalizeTestCase(tc),
    }));

    const result = await this.checkForDuplicates(content, existingItems);

    // Store the check result
    const check = await this.storeCheck(
      projectId,
      'test_case',
      testCaseId || 'new',
      content,
      result
    );

    return { ...result, checkId: check.id };
  }

  /**
   * Check a script for duplicates
   */
  async checkScript(
    code: string,
    projectId: string,
    scriptId?: string
  ): Promise<DuplicateResult> {
    // Get existing scripts in project
    const existingScripts = await prisma.script.findMany({
      where: {
        projectId,
        id: scriptId ? { not: scriptId } : undefined,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    const existingItems: SimilarItem[] = existingScripts.map(s => ({
      id: s.id,
      name: s.name,
      content: this.normalizeCode(s.code),
    }));

    const result = await this.checkForDuplicates(
      this.normalizeCode(code),
      existingItems
    );

    // Store the check result
    const check = await this.storeCheck(
      projectId,
      'script',
      scriptId || 'new',
      code,
      result
    );

    return { ...result, checkId: check.id };
  }

  /**
   * Check a ScriptSmith session for duplicates before save
   */
  async checkSession(sessionId: string): Promise<DuplicateResult> {
    const session = await prisma.scriptSmithSession.findUnique({
      where: { id: sessionId },
      include: { files: true },
    });

    if (!session) {
      throw new NotFoundError('ScriptSmithSession', sessionId);
    }

    if (!session.projectId) {
      return {
        isDuplicate: false,
        confidence: 0,
        matchType: null,
        similarItems: [],
        recommendation: 'No project associated with session',
      };
    }

    // Check each generated file
    const allSimilarItems: DuplicateResult['similarItems'] = [];
    let highestConfidence = 0;
    let highestMatchType: DuplicateMatchType | null = null;

    for (const file of session.files) {
      if (file.fileType === 'test') {
        const result = await this.checkScript(file.content, session.projectId);
        if (result.confidence > highestConfidence) {
          highestConfidence = result.confidence;
          highestMatchType = result.matchType;
        }
        allSimilarItems.push(...result.similarItems);
      }
    }

    // Deduplicate similar items
    const uniqueSimilar = this.deduplicateSimilarItems(allSimilarItems);

    const isDuplicate = highestConfidence >= NEAR_MATCH_THRESHOLD;
    const result: DuplicateResult = {
      isDuplicate,
      confidence: highestConfidence,
      matchType: highestMatchType,
      similarItems: uniqueSimilar,
      recommendation: isDuplicate
        ? 'Similar scripts found. Consider reviewing before saving.'
        : undefined,
    };

    // Store the check result
    const check = await this.storeCheck(
      session.projectId,
      'session',
      sessionId,
      session.files.map(f => f.content).join('\n'),
      result,
      sessionId
    );

    return { ...result, checkId: check.id };
  }

  /**
   * Get duplicate check by ID
   */
  async getCheckById(id: string): Promise<DuplicateCheck> {
    const check = await prisma.duplicateCheck.findUnique({
      where: { id },
    });
    if (!check) {
      throw new NotFoundError('DuplicateCheck', id);
    }
    return check;
  }

  /**
   * Get duplicate checks for a project
   */
  async getProjectChecks(
    projectId: string,
    limit = 50
  ): Promise<DuplicateCheck[]> {
    return prisma.duplicateCheck.findMany({
      where: { projectId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
    });
  }

  // =============================================================================
  // CORE DUPLICATE DETECTION
  // =============================================================================

  /**
   * Main duplicate detection using 3-tier cascade
   */
  private async checkForDuplicates(
    content: string,
    existingItems: SimilarItem[]
  ): Promise<DuplicateResult> {
    if (existingItems.length === 0) {
      return {
        isDuplicate: false,
        confidence: 0,
        matchType: null,
        similarItems: [],
      };
    }

    // Tier 1: Hash check (exact match)
    const hashResult = this.hashCheck(content, existingItems);
    if (hashResult) {
      return hashResult;
    }

    // Tier 2: Levenshtein distance (near match)
    const levenshteinResult = this.levenshteinCheck(content, existingItems);
    if (levenshteinResult.isDuplicate) {
      return levenshteinResult;
    }

    // Tier 3: AI semantic check (only if Levenshtein found potential matches)
    if (
      levenshteinResult.similarItems.length > 0 &&
      levenshteinResult.confidence >= LEVENSHTEIN_FALLBACK_THRESHOLD &&
      this.anthropic
    ) {
      const topCandidates = levenshteinResult.similarItems
        .slice(0, MAX_AI_COMPARISONS)
        .map(item => existingItems.find(e => e.id === item.id))
        .filter((item): item is SimilarItem => item !== undefined);

      const semanticResult = await this.semanticCheck(content, topCandidates);
      if (semanticResult.isDuplicate) {
        return semanticResult;
      }
    }

    // Return best Levenshtein result if no AI check or AI didn't find duplicates
    return levenshteinResult;
  }

  /**
   * Tier 1: Hash-based exact match detection
   */
  private hashCheck(
    content: string,
    existingItems: SimilarItem[]
  ): DuplicateResult | null {
    const contentHash = this.computeHash(content);

    for (const item of existingItems) {
      const itemHash = this.computeHash(item.content);
      if (contentHash === itemHash) {
        return {
          isDuplicate: true,
          confidence: EXACT_MATCH_THRESHOLD,
          matchType: 'exact',
          similarItems: [
            {
              id: item.id,
              name: item.name,
              similarity: 100,
              path: item.path,
            },
          ],
          recommendation: 'Exact duplicate found. This content already exists.',
        };
      }
    }

    return null;
  }

  /**
   * Tier 2: Levenshtein distance-based near match detection
   */
  private levenshteinCheck(
    content: string,
    existingItems: SimilarItem[]
  ): DuplicateResult {
    const similarities: Array<{
      item: SimilarItem;
      similarity: number;
    }> = [];

    for (const item of existingItems) {
      const similarity = this.calculateSimilarity(content, item.content);
      if (similarity >= LEVENSHTEIN_FALLBACK_THRESHOLD) {
        similarities.push({ item, similarity });
      }
    }

    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity);

    const isDuplicate =
      similarities.length > 0 && similarities[0]!.similarity >= NEAR_MATCH_THRESHOLD;

    return {
      isDuplicate,
      confidence: similarities[0]?.similarity || 0,
      matchType: isDuplicate ? 'near' : null,
      similarItems: similarities.map(s => ({
        id: s.item.id,
        name: s.item.name,
        similarity: s.similarity,
        path: s.item.path,
      })),
      recommendation: isDuplicate
        ? 'Near duplicate found. Content is very similar to existing items.'
        : undefined,
    };
  }

  /**
   * Tier 3: AI-powered semantic similarity check
   */
  private async semanticCheck(
    content: string,
    candidates: SimilarItem[]
  ): Promise<DuplicateResult> {
    if (!this.anthropic || candidates.length === 0) {
      return {
        isDuplicate: false,
        confidence: 0,
        matchType: null,
        similarItems: [],
      };
    }

    try {
      const prompt = `You are a test automation expert. Compare the following test code/content with existing tests and determine if they are semantically equivalent (testing the same functionality).

NEW CONTENT:
\`\`\`
${content}
\`\`\`

EXISTING TESTS:
${candidates.map((c, i) => `--- Test ${i + 1}: ${c.name} ---\n\`\`\`\n${c.content}\n\`\`\``).join('\n\n')}

For each existing test, provide a similarity score (0-100) where:
- 100 = Tests the exact same functionality with same assertions
- 80-99 = Tests the same feature but with minor differences
- 60-79 = Tests related functionality with significant overlap
- Below 60 = Different functionality

Respond in JSON format:
{
  "analysis": "Brief explanation of the comparison",
  "comparisons": [
    {"testIndex": 1, "testName": "name", "similarity": 85, "reason": "why similar/different"}
  ]
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = response.content[0]?.type === 'text'
        ? response.content[0].text
        : '';

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const result = JSON.parse(jsonMatch[0]) as {
        analysis: string;
        comparisons: Array<{
          testIndex: number;
          testName: string;
          similarity: number;
          reason: string;
        }>;
      };

      const similarItems = result.comparisons
        .filter(c => c.similarity >= LEVENSHTEIN_FALLBACK_THRESHOLD)
        .map(c => ({
          id: candidates[c.testIndex - 1]?.id || '',
          name: c.testName,
          similarity: c.similarity,
        }))
        .filter(item => item.id);

      const highestSimilarity = Math.max(
        ...result.comparisons.map(c => c.similarity),
        0
      );
      const isDuplicate = highestSimilarity >= SEMANTIC_MATCH_THRESHOLD;

      return {
        isDuplicate,
        confidence: highestSimilarity,
        matchType: isDuplicate ? 'semantic' : null,
        similarItems,
        recommendation: isDuplicate
          ? `AI analysis: ${result.analysis}`
          : undefined,
      };
    } catch (error) {
      // Log error but don't fail - fall back to Levenshtein results
      console.error('AI semantic check failed:', error);
      return {
        isDuplicate: false,
        confidence: 0,
        matchType: null,
        similarItems: [],
      };
    }
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  /**
   * Compute SHA-256 hash of content
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(this.normalize(content)).digest('hex');
  }

  /**
   * Calculate similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalize(str1);
    const s2 = this.normalize(str2);

    if (s1 === s2) return 100;
    if (s1.length === 0 || s2.length === 0) return 0;

    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = ((maxLength - distance) / maxLength) * 100;

    return Math.round(similarity * 100) / 100;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    // Use two rows instead of full matrix for memory efficiency
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    let curr = new Array<number>(n + 1);

    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          (prev[j] ?? 0) + 1, // deletion
          (curr[j - 1] ?? 0) + 1, // insertion
          (prev[j - 1] ?? 0) + cost // substitution
        );
      }
      [prev, curr] = [curr, prev];
    }

    return prev[n] ?? 0;
  }

  /**
   * Normalize content for comparison
   */
  private normalize(content: string): string {
    return content
      .toLowerCase()
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/['"]/g, '') // Remove quotes
      .trim();
  }

  /**
   * Normalize test case to string for comparison
   */
  private normalizeTestCase(tc: {
    title: string;
    description: string | null;
    steps: unknown;
    expectedResult: string | null;
  }): string {
    const parts = [
      tc.title,
      tc.description || '',
      JSON.stringify(tc.steps),
      tc.expectedResult || '',
    ];
    return parts.join(' ');
  }

  /**
   * Normalize code for comparison (remove comments, format)
   */
  private normalizeCode(code: string): string {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Deduplicate similar items by ID
   */
  private deduplicateSimilarItems(
    items: DuplicateResult['similarItems']
  ): DuplicateResult['similarItems'] {
    const seen = new Map<string, (typeof items)[0]>();
    for (const item of items) {
      const existing = seen.get(item.id);
      if (!existing || item.similarity > existing.similarity) {
        seen.set(item.id, item);
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Store duplicate check result
   */
  private async storeCheck(
    projectId: string,
    sourceType: DuplicateSourceType,
    sourceId: string,
    content: string,
    result: DuplicateResult,
    sessionId?: string
  ): Promise<DuplicateCheck> {
    return prisma.duplicateCheck.create({
      data: {
        projectId,
        sessionId,
        sourceType,
        sourceId,
        contentHash: this.computeHash(content),
        isDuplicate: result.isDuplicate,
        confidence: result.confidence,
        matchType: result.matchType,
        similarItems: result.similarItems as unknown as Prisma.InputJsonValue,
        reason: result.recommendation,
      },
    });
  }
}

export const duplicateDetectionService = new DuplicateDetectionService();
