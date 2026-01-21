/**
 * ScriptSmith Session Service
 * Sprint 13: Session-based workflow for ScriptSmith Pro
 *
 * Manages sessions through the 4-step wizard workflow:
 * 1. Choose Method (create session with input method)
 * 2. Provide Input (update session with raw input)
 * 3. Transform & Review (AI transformation)
 * 4. Save to Framework (persist to disk)
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  ScriptSmithSession,
  ScriptSmithFile,
  ScriptSmithInputMethod,
  ScriptSmithSessionStatus,
  ScriptSmithFileType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { scriptSmithAgent } from '../agents/scriptsmith.agent.js';
import { aiUsageService } from './aiusage.service.js';
import { frameworkAnalysisService } from './framework-analysis.service.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateSessionInput {
  userId: string;
  projectId?: string | undefined;
  inputMethod: ScriptSmithInputMethod;
  projectPath?: string | undefined;
  deviceType?: string | undefined;
  deviceConfig?: Record<string, unknown> | undefined;
}

export interface RawInputData {
  // Recording input
  recording?: {
    actions: Array<{
      type: 'click' | 'fill' | 'navigate' | 'wait' | 'assert';
      selector?: string | undefined;
      value?: string | undefined;
      url?: string | undefined;
      timestamp?: number | undefined;
    }>;
    metadata?: {
      startUrl?: string | undefined;
      browser?: string | undefined;
      viewport?: { width: number; height: number } | undefined;
    } | undefined;
  } | undefined;
  // Upload input
  uploadedScript?: {
    content: string;
    fileName: string;
    language?: string | undefined;
  } | undefined;
  // Screenshot input
  screenshot?: {
    base64: string;
    annotations?: Array<{
      x: number;
      y: number;
      width?: number | undefined;
      height?: number | undefined;
      label: string;
      type?: 'click' | 'input' | 'assert' | 'highlight' | undefined;
    }> | undefined;
    url?: string | undefined;
  } | undefined;
  // Natural language description
  description?: string | undefined;
  // Edit existing script
  existingScript?: {
    code: string;
    instruction: string;
    errorMessage?: string | undefined;
  } | undefined;
}

export interface TransformOptions {
  framework?: 'playwright' | 'cypress' | undefined;
  language?: 'typescript' | 'javascript' | undefined;
  includePageObjects?: boolean | undefined;
  extractUtilities?: boolean | undefined;
  useExistingHelpers?: string[] | undefined;
  baseUrl?: string | undefined;
  addLogging?: boolean | undefined;
  includeComments?: boolean | undefined;
  waitStrategy?: 'minimal' | 'standard' | 'conservative' | undefined;
  selectorPreference?: 'role' | 'testid' | 'text' | 'css' | undefined;
}

export interface GeneratedFile {
  filePath: string;
  fileType: ScriptSmithFileType;
  content: string;
  imports?: string[] | undefined;
  exports?: string[] | undefined;
}

export interface FrameworkAnalysis {
  foundPageObjects: string[];
  foundUtilities: string[];
  foundFixtures: string[];
  projectStructure?: {
    testDir: string;
    pageObjectDir: string;
    utilityDir: string;
  } | undefined;
  codingStyle?: {
    indentation: 'spaces' | 'tabs';
    quotesStyle: 'single' | 'double';
    semicolons: boolean;
  } | undefined;
}

export interface SessionWithFiles extends ScriptSmithSession {
  files: ScriptSmithFile[];
}

export interface FindAllParams {
  page: number;
  limit: number;
  userId?: string | undefined;
  projectId?: string | undefined;
  status?: ScriptSmithSessionStatus | undefined;
  inputMethod?: ScriptSmithInputMethod | undefined;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Status transition map
const VALID_TRANSITIONS: Record<ScriptSmithSessionStatus, ScriptSmithSessionStatus[]> = {
  created: ['input_received', 'failed'],
  input_received: ['analyzing', 'failed'],
  analyzing: ['transforming', 'failed'],
  transforming: ['reviewing', 'failed'],
  reviewing: ['completed', 'transforming', 'failed'], // Can go back to transforming for re-transform
  completed: [], // Terminal state
  failed: ['created'], // Can restart
};

// =============================================================================
// SERVICE
// =============================================================================

export class ScriptSmithSessionService {
  /**
   * Create a new session
   */
  async create(input: CreateSessionInput): Promise<ScriptSmithSession> {
    const data: Prisma.ScriptSmithSessionCreateInput = {
      user: { connect: { id: input.userId } },
      inputMethod: input.inputMethod,
      status: 'created',
    };

    if (input.projectId) {
      data.project = { connect: { id: input.projectId } };
    }
    if (input.projectPath) {
      data.projectPath = input.projectPath;
    }
    if (input.deviceType) {
      data.deviceType = input.deviceType;
    }
    if (input.deviceConfig) {
      data.deviceConfig = input.deviceConfig as Prisma.InputJsonValue;
    }

    return prisma.scriptSmithSession.create({ data });
  }

  /**
   * Get session by ID
   */
  async findById(id: string): Promise<ScriptSmithSession> {
    const session = await prisma.scriptSmithSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundError('ScriptSmithSession', id);
    return session;
  }

  /**
   * Get session with files
   */
  async findByIdWithFiles(id: string): Promise<SessionWithFiles> {
    const session = await prisma.scriptSmithSession.findUnique({
      where: { id },
      include: { files: true },
    });
    if (!session) throw new NotFoundError('ScriptSmithSession', id);
    return session;
  }

  /**
   * Find all sessions with pagination
   */
  async findAll(params: FindAllParams): Promise<PaginatedResult<ScriptSmithSession>> {
    const { page, limit, userId, projectId, status, inputMethod } = params;
    const where: Prisma.ScriptSmithSessionWhereInput = {};

    if (userId) where.userId = userId;
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (inputMethod) where.inputMethod = inputMethod;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.scriptSmithSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { files: true },
      }),
      prisma.scriptSmithSession.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update session input (Step 2)
   */
  async updateInput(sessionId: string, rawInput: RawInputData): Promise<ScriptSmithSession> {
    const session = await this.findById(sessionId);

    // Validate state transition
    this.validateTransition(session.status, 'input_received');

    // Validate input matches method
    this.validateInputMethod(session.inputMethod, rawInput);

    return prisma.scriptSmithSession.update({
      where: { id: sessionId },
      data: {
        rawInput: rawInput as Prisma.InputJsonValue,
        status: 'input_received',
      },
    });
  }

  /**
   * Transform session input to script (Step 3)
   */
  async transform(
    sessionId: string,
    options: TransformOptions,
    projectId: string
  ): Promise<SessionWithFiles> {
    const session = await this.findByIdWithFiles(sessionId);

    // Validate state transition
    if (session.status !== 'input_received' && session.status !== 'reviewing') {
      throw new ValidationError('Session must be in input_received or reviewing status to transform');
    }

    // Update to analyzing
    await prisma.scriptSmithSession.update({
      where: { id: sessionId },
      data: { status: 'analyzing' },
    });

    try {
      // Analyze framework if project path provided
      let frameworkAnalysis: FrameworkAnalysis | undefined;
      if (session.projectPath) {
        frameworkAnalysis = await this.analyzeFramework(session.projectPath);
      }

      // Update to transforming
      await prisma.scriptSmithSession.update({
        where: { id: sessionId },
        data: { status: 'transforming' },
      });

      // Generate script using AI
      const rawInput = session.rawInput as RawInputData | null;
      const generatedResult = await this.generateScript(session, rawInput, options, projectId);

      // Delete existing files (for re-transform)
      await prisma.scriptSmithFile.deleteMany({
        where: { sessionId },
      });

      // Create generated files
      const files: ScriptSmithFile[] = [];
      for (const file of generatedResult.files) {
        const created = await prisma.scriptSmithFile.create({
          data: {
            sessionId,
            filePath: file.filePath,
            fileType: file.fileType,
            content: file.content,
            imports: file.imports || [],
            exports: file.exports || [],
          },
        });
        files.push(created);
      }

      // Update session
      const updated = await prisma.scriptSmithSession.update({
        where: { id: sessionId },
        data: {
          status: 'reviewing',
          transformedScript: generatedResult.mainScript,
          frameworkAnalysis: frameworkAnalysis as unknown as Prisma.InputJsonValue,
          costEstimate: generatedResult.cost,
        },
        include: { files: true },
      });

      return updated;
    } catch (error) {
      // Mark as failed
      await prisma.scriptSmithSession.update({
        where: { id: sessionId },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  /**
   * Save generated files to disk (Step 4)
   */
  async saveToFramework(
    sessionId: string,
    targetDir: string,
    overwrite = false
  ): Promise<{ savedFiles: string[]; sessionId: string; skipped: string[] }> {
    const session = await this.findByIdWithFiles(sessionId);

    if (session.status !== 'reviewing') {
      throw new ValidationError('Session must be in reviewing status to save');
    }

    if (session.files.length === 0) {
      throw new ValidationError('No files to save');
    }

    const savedFiles: string[] = [];
    const skipped: string[] = [];

    // Write each file to disk
    for (const file of session.files) {
      const fullPath = path.join(targetDir, file.filePath);
      const dir = path.dirname(fullPath);

      try {
        // Create directory if it doesn't exist
        await fs.mkdir(dir, { recursive: true });

        // Check if file exists
        let fileExists = false;
        try {
          await fs.access(fullPath);
          fileExists = true;
        } catch {
          // File doesn't exist
        }

        // Skip if file exists and overwrite is false
        if (fileExists && !overwrite) {
          skipped.push(file.filePath);
          continue;
        }

        // Write file content
        await fs.writeFile(fullPath, file.content, 'utf-8');
        savedFiles.push(file.filePath);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new ValidationError(`Failed to save file ${file.filePath}: ${message}`);
      }
    }

    // Mark session as completed
    await prisma.scriptSmithSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return { savedFiles, sessionId, skipped };
  }

  /**
   * Analyze project framework structure
   */
  async analyzeFramework(projectPath: string): Promise<FrameworkAnalysis> {
    try {
      const analysis = await frameworkAnalysisService.analyzeProject(projectPath);

      // Convert detailed analysis to simplified format
      return {
        foundPageObjects: analysis.foundPageObjects.map(po => po.name),
        foundUtilities: analysis.foundUtilities.map(u => u.name),
        foundFixtures: analysis.foundFixtures.map(f => f.name),
        projectStructure: {
          testDir: analysis.projectStructure.testDir || `${projectPath}/tests`,
          pageObjectDir: analysis.projectStructure.pageObjectDir || `${projectPath}/pages`,
          utilityDir: analysis.projectStructure.utilityDir || `${projectPath}/utils`,
        },
        codingStyle: {
          indentation: analysis.codingStyle.indentation,
          quotesStyle: analysis.codingStyle.quotesStyle,
          semicolons: analysis.codingStyle.semicolons,
        },
      };
    } catch {
      // Return default if analysis fails
      return {
        foundPageObjects: [],
        foundUtilities: [],
        foundFixtures: [],
        projectStructure: {
          testDir: `${projectPath}/tests`,
          pageObjectDir: `${projectPath}/pages`,
          utilityDir: `${projectPath}/utils`,
        },
        codingStyle: {
          indentation: 'spaces',
          quotesStyle: 'single',
          semicolons: true,
        },
      };
    }
  }

  /**
   * Delete session
   */
  async delete(sessionId: string): Promise<void> {
    const session = await this.findById(sessionId);
    await prisma.scriptSmithSession.delete({
      where: { id: session.id },
    });
  }

  /**
   * Get user's recent sessions
   */
  async getUserSessions(
    userId: string,
    limit = 10
  ): Promise<ScriptSmithSession[]> {
    return prisma.scriptSmithSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { files: true },
    });
  }

  // =============================================================================
  // PRIVATE HELPERS
  // =============================================================================

  private validateTransition(
    current: ScriptSmithSessionStatus,
    target: ScriptSmithSessionStatus
  ): void {
    const validTargets = VALID_TRANSITIONS[current];
    if (!validTargets.includes(target)) {
      throw new ValidationError(
        `Invalid status transition from '${current}' to '${target}'`
      );
    }
  }

  private validateInputMethod(
    method: ScriptSmithInputMethod,
    input: RawInputData
  ): void {
    switch (method) {
      case 'record':
        if (!input.recording) {
          throw new ValidationError('Recording data is required for record input method');
        }
        break;
      case 'upload':
        if (!input.uploadedScript) {
          throw new ValidationError('Uploaded script is required for upload input method');
        }
        break;
      case 'screenshot':
        if (!input.screenshot) {
          throw new ValidationError('Screenshot is required for screenshot input method');
        }
        break;
      case 'describe':
        if (!input.description) {
          throw new ValidationError('Description is required for describe input method');
        }
        break;
      case 'edit':
        if (!input.existingScript) {
          throw new ValidationError('Existing script is required for edit input method');
        }
        break;
    }
  }

  private async generateScript(
    session: ScriptSmithSession,
    rawInput: RawInputData | null,
    options: TransformOptions,
    projectId: string
  ): Promise<{ mainScript: string; files: GeneratedFile[]; cost: number }> {
    if (!rawInput) {
      throw new ValidationError('No input data to transform');
    }

    // Determine input method and build input for agent
    let agentInput;
    switch (session.inputMethod) {
      case 'record':
        agentInput = {
          inputMethod: 'recording' as const,
          recording: rawInput.recording,
          options,
        };
        break;
      case 'upload':
        // For upload, we're converting existing script
        agentInput = {
          inputMethod: 'description' as const,
          description: `Convert the following script to ${options.framework || 'playwright'}:\n${rawInput.uploadedScript?.content}`,
          options,
        };
        break;
      case 'screenshot':
        agentInput = {
          inputMethod: 'screenshot' as const,
          screenshot: rawInput.screenshot,
          options,
        };
        break;
      case 'describe':
        agentInput = {
          inputMethod: 'description' as const,
          description: rawInput.description,
          options,
        };
        break;
      case 'edit':
        // Use edit operation for existing script
        const editInput = {
          existingCode: rawInput.existingScript?.code || '',
          instruction: rawInput.existingScript?.instruction || '',
        };
        if (rawInput.existingScript?.errorMessage) {
          Object.assign(editInput, { context: { errorMessage: rawInput.existingScript.errorMessage } });
        }
        const editResult = await scriptSmithAgent.edit(editInput);

        // Track AI usage
        await aiUsageService.record({
          projectId,
          agent: 'scriptsmith',
          operation: 'edit',
          model: editResult.usage.model,
          inputTokens: editResult.usage.inputTokens,
          outputTokens: editResult.usage.outputTokens,
          costUsd: editResult.usage.costUsd,
          costInr: editResult.usage.costInr,
          durationMs: editResult.usage.durationMs,
        });

        return {
          mainScript: editResult.data.code,
          files: [
            {
              filePath: 'test.spec.ts',
              fileType: 'test',
              content: editResult.data.code,
            },
          ],
          cost: editResult.usage.costUsd,
        };
    }

    // Generate script using agent
    const result = await scriptSmithAgent.generate(agentInput as Parameters<typeof scriptSmithAgent.generate>[0]);

    // Track AI usage
    await aiUsageService.record({
      projectId,
      agent: 'scriptsmith',
      operation: 'generate',
      model: result.usage.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costUsd: result.usage.costUsd,
      costInr: result.usage.costInr,
      durationMs: result.usage.durationMs,
    });

    // Build file list
    const files: GeneratedFile[] = [
      {
        filePath: `tests/${result.data.name}.spec.ts`,
        fileType: 'test',
        content: result.data.code,
      },
    ];

    // Add page objects if generated
    if (result.data.pageObjects) {
      for (const po of result.data.pageObjects) {
        files.push({
          filePath: `pages/${po.name}.ts`,
          fileType: 'page_object',
          content: po.code,
        });
      }
    }

    // Add utilities if generated
    if (result.data.utilities) {
      for (const util of result.data.utilities) {
        files.push({
          filePath: `utils/${util.name}.ts`,
          fileType: 'utility',
          content: util.code,
        });
      }
    }

    return {
      mainScript: result.data.code,
      files,
      cost: result.usage.costUsd,
    };
  }
}

export const scriptSmithSessionService = new ScriptSmithSessionService();
