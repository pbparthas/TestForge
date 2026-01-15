/**
 * Script Service
 * Handles script CRUD operations
 */

import type { Script, ScriptStatus, Language, Framework, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

export interface CreateScriptInput {
  testCaseId: string;
  projectId: string;
  name: string;
  code: string;
  language?: Language | undefined;
  framework?: Framework | undefined;
  status?: ScriptStatus | undefined;
  generatedBy?: string | undefined;
  createdById: string;
}

export interface UpdateScriptInput {
  name?: string | undefined;
  code?: string | undefined;
  language?: Language | undefined;
  framework?: Framework | undefined;
  status?: ScriptStatus | undefined;
}

export interface FindAllParams {
  page: number;
  limit: number;
  projectId?: string | undefined;
  testCaseId?: string | undefined;
  status?: ScriptStatus | undefined;
  language?: Language | undefined;
  framework?: Framework | undefined;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ScriptService {
  async create(input: CreateScriptInput): Promise<Script> {
    return prisma.script.create({
      data: {
        testCaseId: input.testCaseId,
        projectId: input.projectId,
        name: input.name,
        code: input.code,
        language: input.language ?? 'typescript',
        framework: input.framework ?? 'playwright',
        status: input.status ?? 'draft',
        ...(input.generatedBy ? { generatedBy: input.generatedBy } : {}),
        createdById: input.createdById,
      },
    });
  }

  async findById(id: string): Promise<Script> {
    const script = await prisma.script.findUnique({ where: { id } });
    if (!script) throw new NotFoundError('Script', id);
    return script;
  }

  async findAll(params: FindAllParams): Promise<PaginatedResult<Script>> {
    const { page, limit, projectId, testCaseId, status, language, framework } = params;
    const where: Prisma.ScriptWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (testCaseId) where.testCaseId = testCaseId;
    if (status) where.status = status;
    if (language) where.language = language;
    if (framework) where.framework = framework;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.script.findMany({ where, skip, take: limit, orderBy: { updatedAt: 'desc' } }),
      prisma.script.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, input: UpdateScriptInput): Promise<Script> {
    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Script', id);

    const updateData: Prisma.ScriptUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.code !== undefined) updateData.code = input.code;
    if (input.language !== undefined) updateData.language = input.language;
    if (input.framework !== undefined) updateData.framework = input.framework;
    if (input.status !== undefined) updateData.status = input.status;

    return prisma.script.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<void> {
    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Script', id);
    await prisma.script.delete({ where: { id } });
  }

  async getByTestCase(testCaseId: string): Promise<Script[]> {
    return prisma.script.findMany({
      where: { testCaseId },
      orderBy: { version: 'desc' },
    });
  }

  async getByProject(projectId: string): Promise<Script[]> {
    return prisma.script.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async approve(id: string): Promise<Script> {
    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Script', id);
    return prisma.script.update({ where: { id }, data: { status: 'approved' } });
  }

  async deprecate(id: string): Promise<Script> {
    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Script', id);
    return prisma.script.update({ where: { id }, data: { status: 'deprecated' } });
  }

  async incrementVersion(id: string, newCode: string): Promise<Script> {
    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Script', id);
    return prisma.script.update({
      where: { id },
      data: { code: newCode, version: existing.version + 1 },
    });
  }
}

export const scriptService = new ScriptService();
