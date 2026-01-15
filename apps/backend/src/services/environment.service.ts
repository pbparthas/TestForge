/**
 * Environment Service
 * Handles environment CRUD operations
 */

import type { Environment, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

export interface CreateEnvironmentInput {
  projectId: string;
  name: string;
  baseUrl: string;
  variables?: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdateEnvironmentInput {
  name?: string;
  baseUrl?: string;
  variables?: Record<string, unknown>;
  isActive?: boolean;
}

export interface FindAllParams {
  page: number;
  limit: number;
  projectId?: string;
  isActive?: boolean;
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

export class EnvironmentService {
  async create(input: CreateEnvironmentInput): Promise<Environment> {
    return prisma.environment.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        baseUrl: input.baseUrl,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        isActive: input.isActive ?? true,
      },
    });
  }

  async findById(id: string): Promise<Environment> {
    const environment = await prisma.environment.findUnique({ where: { id } });
    if (!environment) throw new NotFoundError('Environment', id);
    return environment;
  }

  async findAll(params: FindAllParams): Promise<PaginatedResult<Environment>> {
    const { page, limit, projectId, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = params;
    const where: Prisma.EnvironmentWhereInput = {};
    if (projectId) where.projectId = projectId;
    if (isActive !== undefined) where.isActive = isActive;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.environment.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.environment.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, input: UpdateEnvironmentInput): Promise<Environment> {
    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Environment', id);

    const updateData: Prisma.EnvironmentUpdateInput = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.baseUrl !== undefined) updateData.baseUrl = input.baseUrl;
    if (input.variables !== undefined) updateData.variables = input.variables as Prisma.InputJsonValue;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    return prisma.environment.update({ where: { id }, data: updateData });
  }

  async delete(id: string): Promise<void> {
    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Environment', id);
    await prisma.environment.delete({ where: { id } });
  }

  async activate(id: string): Promise<Environment> {
    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Environment', id);
    return prisma.environment.update({ where: { id }, data: { isActive: true } });
  }

  async deactivate(id: string): Promise<Environment> {
    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Environment', id);
    return prisma.environment.update({ where: { id }, data: { isActive: false } });
  }

  async getByProject(projectId: string): Promise<Environment[]> {
    return prisma.environment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getActiveByProject(projectId: string): Promise<Environment[]> {
    return prisma.environment.findMany({
      where: { projectId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async duplicate(id: string): Promise<Environment> {
    const existing = await prisma.environment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Environment', id);

    return prisma.environment.create({
      data: {
        projectId: existing.projectId,
        name: `Copy of ${existing.name}`,
        baseUrl: existing.baseUrl,
        variables: existing.variables as Prisma.InputJsonValue,
        isActive: false,
      },
    });
  }
}

export const environmentService = new EnvironmentService();
