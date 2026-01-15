/**
 * Requirement Service
 * Handles requirement CRUD operations
 */

import type { Requirement, Priority, Status, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

export interface CreateRequirementInput {
  projectId: string;
  externalId?: string;
  title: string;
  description?: string;
  priority?: Priority;
  status?: Status;
}

export interface UpdateRequirementInput {
  externalId?: string | null;
  title?: string;
  description?: string;
  priority?: Priority;
  status?: Status;
}

export interface FindAllParams {
  page: number;
  limit: number;
  projectId?: string;
  priority?: Priority;
  status?: Status;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class RequirementService {
  async create(input: CreateRequirementInput): Promise<Requirement> {
    return prisma.requirement.create({
      data: {
        projectId: input.projectId,
        externalId: input.externalId,
        title: input.title,
        description: input.description,
        priority: input.priority ?? 'medium',
        status: input.status ?? 'active',
      },
    });
  }

  async findById(id: string): Promise<Requirement> {
    const requirement = await prisma.requirement.findUnique({
      where: { id },
    });
    if (!requirement) throw new NotFoundError('Requirement', id);
    return requirement;
  }

  async findByIdWithTestCases(id: string): Promise<Requirement & Record<string, unknown>> {
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: { project: true, testCases: true },
    });
    if (!requirement) throw new NotFoundError('Requirement', id);
    return requirement;
  }

  async findAll(params: FindAllParams): Promise<PaginatedResult<Requirement>> {
    const { page, limit, projectId, priority, status, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const where: Prisma.RequirementWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (priority) where.priority = priority;
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.requirement.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.requirement.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, input: UpdateRequirementInput): Promise<Requirement> {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Requirement', id);

    const updateData: Prisma.RequirementUpdateInput = {};
    if (input.externalId !== undefined) updateData.externalId = input.externalId;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.status !== undefined) updateData.status = input.status;

    return prisma.requirement.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<void> {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Requirement', id);
    await prisma.requirement.delete({ where: { id } });
  }

  async archive(id: string): Promise<Requirement> {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Requirement', id);
    return prisma.requirement.update({ where: { id }, data: { status: 'archived' } });
  }

  async getByProject(projectId: string): Promise<Requirement[]> {
    return prisma.requirement.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTestCaseCoverage(id: string): Promise<{ total: number; automated: number; manual: number }> {
    const requirement = await prisma.requirement.findUnique({
      where: { id },
      include: { testCases: { select: { isAutomated: true } } },
    });
    if (!requirement) throw new NotFoundError('Requirement', id);

    const total = requirement.testCases.length;
    const automated = requirement.testCases.filter((tc) => tc.isAutomated).length;
    return { total, automated, manual: total - automated };
  }
}

export const requirementService = new RequirementService();
