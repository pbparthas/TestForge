/**
 * Team Service
 * Handles team management operations including members and project access
 */

import type { Team, TeamMember, TeamProjectAccess, TeamMemberRole, TeamAccessLevel } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateTeamInput {
  name: string;
  description?: string;
  createdById: string;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface FindAllParams {
  page: number;
  limit: number;
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

export interface TeamWithRelations extends Team {
  members: TeamMember[];
  projectAccess: TeamProjectAccess[];
}

// =============================================================================
// SERVICE
// =============================================================================

export class TeamService {
  /**
   * Create a new team
   */
  async create(input: CreateTeamInput): Promise<Team> {
    const team = await prisma.team.create({
      data: {
        name: input.name,
        description: input.description,
        createdById: input.createdById,
        isActive: true,
      },
    });

    return team;
  }

  /**
   * Find team by ID
   */
  async findById(id: string): Promise<Team> {
    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      throw new NotFoundError('Team', id);
    }

    return team;
  }

  /**
   * Find team by ID with members and project access
   */
  async findByIdWithMembers(id: string): Promise<TeamWithRelations> {
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: true,
        projectAccess: true,
      },
    });

    if (!team) {
      throw new NotFoundError('Team', id);
    }

    return team;
  }

  /**
   * Find all teams with pagination
   */
  async findAll(params: FindAllParams): Promise<PaginatedResult<Team>> {
    const {
      page,
      limit,
      isActive,
      createdById,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: {
      isActive?: boolean;
      createdById?: string;
    } = {};

    if (isActive !== undefined) where.isActive = isActive;
    if (createdById !== undefined) where.createdById = createdById;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.team.count({ where }),
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
   * Update team
   */
  async update(id: string, input: UpdateTeamInput): Promise<Team> {
    const existingTeam = await prisma.team.findUnique({
      where: { id },
    });

    if (!existingTeam) {
      throw new NotFoundError('Team', id);
    }

    const cleanInput = Object.fromEntries(
      Object.entries(input).filter(([_, v]) => v !== undefined)
    );

    const team = await prisma.team.update({
      where: { id },
      data: cleanInput,
    });

    return team;
  }

  /**
   * Delete team
   */
  async delete(id: string): Promise<void> {
    const existingTeam = await prisma.team.findUnique({
      where: { id },
    });

    if (!existingTeam) {
      throw new NotFoundError('Team', id);
    }

    await prisma.team.delete({
      where: { id },
    });
  }

  /**
   * Add member to team
   */
  async addMember(
    teamId: string,
    userId: string,
    role: TeamMemberRole
  ): Promise<TeamMember> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role,
      },
    });

    return member;
  }

  /**
   * Remove member from team
   */
  async removeMember(teamId: string, userId: string): Promise<void> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!member) {
      throw new NotFoundError('TeamMember', `${teamId}/${userId}`);
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: { teamId, userId },
      },
    });
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    teamId: string,
    userId: string,
    role: TeamMemberRole
  ): Promise<TeamMember> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!member) {
      throw new NotFoundError('TeamMember', `${teamId}/${userId}`);
    }

    const updatedMember = await prisma.teamMember.update({
      where: {
        teamId_userId: { teamId, userId },
      },
      data: { role },
    });

    return updatedMember;
  }

  /**
   * Grant project access to team
   */
  async grantProjectAccess(
    teamId: string,
    projectId: string,
    accessLevel: TeamAccessLevel,
    grantedById?: string
  ): Promise<TeamProjectAccess> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    const access = await prisma.teamProjectAccess.create({
      data: {
        teamId,
        projectId,
        accessLevel,
        grantedById,
      },
    });

    return access;
  }

  /**
   * Revoke project access from team
   */
  async revokeProjectAccess(teamId: string, projectId: string): Promise<void> {
    const access = await prisma.teamProjectAccess.findUnique({
      where: {
        teamId_projectId: { teamId, projectId },
      },
    });

    if (!access) {
      throw new NotFoundError('TeamProjectAccess', `${teamId}/${projectId}`);
    }

    await prisma.teamProjectAccess.delete({
      where: {
        teamId_projectId: { teamId, projectId },
      },
    });
  }

  /**
   * Update project access level
   */
  async updateProjectAccess(
    teamId: string,
    projectId: string,
    accessLevel: TeamAccessLevel
  ): Promise<TeamProjectAccess> {
    const access = await prisma.teamProjectAccess.findUnique({
      where: {
        teamId_projectId: { teamId, projectId },
      },
    });

    if (!access) {
      throw new NotFoundError('TeamProjectAccess', `${teamId}/${projectId}`);
    }

    const updatedAccess = await prisma.teamProjectAccess.update({
      where: {
        teamId_projectId: { teamId, projectId },
      },
      data: { accessLevel },
    });

    return updatedAccess;
  }

  /**
   * Get teams by user
   */
  async getTeamsByUser(userId: string): Promise<(TeamMember & { team: Team })[]> {
    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      include: { team: true },
    });

    return memberships;
  }

  /**
   * Get team members
   */
  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    return prisma.teamMember.findMany({
      where: { teamId },
    });
  }

  /**
   * Get team project access
   */
  async getTeamProjectAccess(teamId: string): Promise<TeamProjectAccess[]> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundError('Team', teamId);
    }

    return prisma.teamProjectAccess.findMany({
      where: { teamId },
    });
  }
}

// Export singleton instance
export const teamService = new TeamService();
