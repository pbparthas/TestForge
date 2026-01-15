/**
 * Project Service
 * Handles project CRUD operations and statistics
 */

import type { Project, Framework, Language } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateProjectInput {
  name: string;
  description?: string;
  repositoryUrl?: string;
  framework?: Framework;
  language?: Language;
  createdById: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  repositoryUrl?: string;
  framework?: Framework;
  language?: Language;
  isActive?: boolean;
}

export interface FindAllParams {
  page: number;
  limit: number;
  framework?: Framework;
  language?: Language;
  isActive?: boolean;
  createdById?: string;
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

export interface ProjectStats {
  requirementCount: number;
  testCaseCount: number;
  environmentCount: number;
  testSuiteCount: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class ProjectService {
  /**
   * Create a new project
   */
  async create(input: CreateProjectInput): Promise<Project> {
    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        repositoryUrl: input.repositoryUrl,
        framework: input.framework,
        language: input.language,
        createdById: input.createdById,
        isActive: true,
      },
    });

    return project;
  }

  /**
   * Find project by ID
   */
  async findById(id: string): Promise<Project> {
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundError('Project', id);
    }

    return project;
  }

  /**
   * Find project by ID with related data
   */
  async findByIdWithRelations(id: string): Promise<Project & Record<string, unknown>> {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: true,
        requirements: true,
        testCases: true,
        environments: true,
        testSuites: true,
      },
    });

    if (!project) {
      throw new NotFoundError('Project', id);
    }

    return project;
  }

  /**
   * Find all projects with pagination and filtering
   */
  async findAll(params: FindAllParams): Promise<PaginatedResult<Project>> {
    const {
      page,
      limit,
      framework,
      language,
      isActive,
      createdById,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = params;

    const where: {
      framework?: Framework;
      language?: Language;
      isActive?: boolean;
      createdById?: string;
    } = {};

    if (framework !== undefined) where.framework = framework;
    if (language !== undefined) where.language = language;
    if (isActive !== undefined) where.isActive = isActive;
    if (createdById !== undefined) where.createdById = createdById;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.project.count({ where }),
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
   * Update project fields
   */
  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      throw new NotFoundError('Project', id);
    }

    // Remove undefined values
    const cleanInput = Object.fromEntries(
      Object.entries(input).filter(([_, v]) => v !== undefined)
    );

    const project = await prisma.project.update({
      where: { id },
      data: cleanInput,
    });

    return project;
  }

  /**
   * Delete project
   */
  async delete(id: string): Promise<void> {
    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      throw new NotFoundError('Project', id);
    }

    await prisma.project.delete({
      where: { id },
    });
  }

  /**
   * Deactivate project (soft delete)
   */
  async deactivate(id: string): Promise<Project> {
    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      throw new NotFoundError('Project', id);
    }

    return prisma.project.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Activate project
   */
  async activate(id: string): Promise<Project> {
    // Check if project exists
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      throw new NotFoundError('Project', id);
    }

    return prisma.project.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Get project statistics
   */
  async getProjectStats(id: string): Promise<ProjectStats> {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            requirements: true,
            testCases: true,
            environments: true,
            testSuites: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundError('Project', id);
    }

    return {
      requirementCount: project._count.requirements,
      testCaseCount: project._count.testCases,
      environmentCount: project._count.environments,
      testSuiteCount: project._count.testSuites,
    };
  }
}

// Export singleton instance
export const projectService = new ProjectService();
