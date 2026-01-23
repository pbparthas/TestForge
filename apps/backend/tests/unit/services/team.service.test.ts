/**
 * Team Service Tests (TDD - RED phase)
 * Tests for team management operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Team, TeamMember, TeamProjectAccess, TeamMemberRole, TeamAccessLevel } from '@prisma/client';

// Mock Prisma client - must be hoisted with vi.hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    team: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    teamMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    teamProjectAccess: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { TeamService } from '../../../src/services/team.service.js';

describe('TeamService', () => {
  let teamService: TeamService;

  const mockTeam: Team = {
    id: 'team-123',
    name: 'Engineering Team',
    description: 'Main engineering team',
    isActive: true,
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTeamMember: TeamMember = {
    id: 'member-123',
    teamId: 'team-123',
    userId: 'user-456',
    role: 'member' as TeamMemberRole,
    joinedAt: new Date(),
  };

  const mockTeamProjectAccess: TeamProjectAccess = {
    id: 'access-123',
    teamId: 'team-123',
    projectId: 'project-123',
    accessLevel: 'write' as TeamAccessLevel,
    grantedAt: new Date(),
    grantedById: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    teamService = new TeamService();
  });

  describe('create', () => {
    it('should create a team with valid input', async () => {
      mockPrisma.team.create.mockResolvedValue(mockTeam);

      const input = {
        name: 'Engineering Team',
        description: 'Main engineering team',
        createdById: 'user-123',
      };

      const result = await teamService.create(input);

      expect(result.name).toBe(input.name);
      expect(result.description).toBe(input.description);
      expect(mockPrisma.team.create).toHaveBeenCalledTimes(1);
    });

    it('should set isActive to true by default', async () => {
      mockPrisma.team.create.mockResolvedValue(mockTeam);

      const input = {
        name: 'Engineering Team',
        createdById: 'user-123',
      };

      await teamService.create(input);

      const createCall = mockPrisma.team.create.mock.calls[0]?.[0];
      expect(createCall?.data?.isActive).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return team by id', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);

      const result = await teamService.findById('team-123');

      expect(result).toEqual(mockTeam);
      expect(mockPrisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-123' },
      });
    });

    it('should throw NotFoundError if team does not exist', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(teamService.findById('nonexistent')).rejects.toThrow(
        "Team with id 'nonexistent' not found"
      );
    });
  });

  describe('findByIdWithMembers', () => {
    it('should return team with members', async () => {
      const teamWithMembers = {
        ...mockTeam,
        members: [mockTeamMember],
        projectAccess: [mockTeamProjectAccess],
      };
      mockPrisma.team.findUnique.mockResolvedValue(teamWithMembers);

      const result = await teamService.findByIdWithMembers('team-123');

      expect(result.members).toHaveLength(1);
      expect(result.projectAccess).toHaveLength(1);
    });
  });

  describe('findAll', () => {
    it('should return paginated teams', async () => {
      mockPrisma.team.findMany.mockResolvedValue([mockTeam]);
      mockPrisma.team.count.mockResolvedValue(1);

      const result = await teamService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by isActive', async () => {
      mockPrisma.team.findMany.mockResolvedValue([mockTeam]);
      mockPrisma.team.count.mockResolvedValue(1);

      await teamService.findAll({ page: 1, limit: 10, isActive: true });

      expect(mockPrisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update team fields', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.team.update.mockResolvedValue({
        ...mockTeam,
        name: 'Updated Team',
      });

      const result = await teamService.update('team-123', { name: 'Updated Team' });

      expect(result.name).toBe('Updated Team');
    });

    it('should throw NotFoundError if team does not exist', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(
        teamService.update('nonexistent', { name: 'New Name' })
      ).rejects.toThrow("Team with id 'nonexistent' not found");
    });
  });

  describe('delete', () => {
    it('should delete team by id', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.team.delete.mockResolvedValue(mockTeam);

      await teamService.delete('team-123');

      expect(mockPrisma.team.delete).toHaveBeenCalledWith({
        where: { id: 'team-123' },
      });
    });
  });

  describe('addMember', () => {
    it('should add a member to team', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamMember.create.mockResolvedValue(mockTeamMember);

      const result = await teamService.addMember('team-123', 'user-456', 'member');

      expect(result.teamId).toBe('team-123');
      expect(result.userId).toBe('user-456');
    });

    it('should throw NotFoundError if team does not exist', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(
        teamService.addMember('nonexistent', 'user-456', 'member')
      ).rejects.toThrow("Team with id 'nonexistent' not found");
    });
  });

  describe('removeMember', () => {
    it('should remove a member from team', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(mockTeamMember);
      mockPrisma.teamMember.delete.mockResolvedValue(mockTeamMember);

      await teamService.removeMember('team-123', 'user-456');

      expect(mockPrisma.teamMember.delete).toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(mockTeamMember);
      mockPrisma.teamMember.update.mockResolvedValue({
        ...mockTeamMember,
        role: 'admin' as TeamMemberRole,
      });

      const result = await teamService.updateMemberRole('team-123', 'user-456', 'admin');

      expect(result.role).toBe('admin');
    });
  });

  describe('grantProjectAccess', () => {
    it('should grant project access to team', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamProjectAccess.create.mockResolvedValue(mockTeamProjectAccess);

      const result = await teamService.grantProjectAccess(
        'team-123',
        'project-123',
        'write',
        'user-123'
      );

      expect(result.teamId).toBe('team-123');
      expect(result.projectId).toBe('project-123');
      expect(result.accessLevel).toBe('write');
    });
  });

  describe('revokeProjectAccess', () => {
    it('should revoke project access from team', async () => {
      mockPrisma.teamProjectAccess.findUnique.mockResolvedValue(mockTeamProjectAccess);
      mockPrisma.teamProjectAccess.delete.mockResolvedValue(mockTeamProjectAccess);

      await teamService.revokeProjectAccess('team-123', 'project-123');

      expect(mockPrisma.teamProjectAccess.delete).toHaveBeenCalled();
    });
  });

  describe('getTeamsByUser', () => {
    it('should return teams for a user', async () => {
      mockPrisma.teamMember.findMany.mockResolvedValue([
        { ...mockTeamMember, team: mockTeam },
      ]);

      const result = await teamService.getTeamsByUser('user-456');

      expect(result).toHaveLength(1);
    });
  });

  describe('getTeamMembers', () => {
    it('should return members for a team', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamMember.findMany.mockResolvedValue([mockTeamMember]);

      const result = await teamService.getTeamMembers('team-123');

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundError if team does not exist', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(teamService.getTeamMembers('nonexistent')).rejects.toThrow(
        "Team with id 'nonexistent' not found"
      );
    });
  });

  describe('getTeamProjectAccess', () => {
    it('should return project access for a team', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamProjectAccess.findMany.mockResolvedValue([mockTeamProjectAccess]);

      const result = await teamService.getTeamProjectAccess('team-123');

      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundError if team does not exist', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      await expect(teamService.getTeamProjectAccess('nonexistent')).rejects.toThrow(
        "Team with id 'nonexistent' not found"
      );
    });
  });

  describe('updateProjectAccess', () => {
    it('should update project access level', async () => {
      mockPrisma.teamProjectAccess.findUnique.mockResolvedValue(mockTeamProjectAccess);
      mockPrisma.teamProjectAccess.update.mockResolvedValue({
        ...mockTeamProjectAccess,
        accessLevel: 'admin' as TeamAccessLevel,
      });

      const result = await teamService.updateProjectAccess('team-123', 'project-123', 'admin');

      expect(result.accessLevel).toBe('admin');
    });

    it('should throw NotFoundError if access does not exist', async () => {
      mockPrisma.teamProjectAccess.findUnique.mockResolvedValue(null);

      await expect(
        teamService.updateProjectAccess('team-123', 'project-123', 'admin')
      ).rejects.toThrow("TeamProjectAccess with id 'team-123/project-123' not found");
    });
  });

  describe('removeMember - edge cases', () => {
    it('should throw NotFoundError if member does not exist', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(
        teamService.removeMember('team-123', 'nonexistent')
      ).rejects.toThrow("TeamMember with id 'team-123/nonexistent' not found");
    });
  });

  describe('updateMemberRole - edge cases', () => {
    it('should throw NotFoundError if member does not exist', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(null);

      await expect(
        teamService.updateMemberRole('team-123', 'nonexistent', 'admin')
      ).rejects.toThrow("TeamMember with id 'team-123/nonexistent' not found");
    });
  });

  describe('revokeProjectAccess - edge cases', () => {
    it('should throw NotFoundError if access does not exist', async () => {
      mockPrisma.teamProjectAccess.findUnique.mockResolvedValue(null);

      await expect(
        teamService.revokeProjectAccess('team-123', 'nonexistent')
      ).rejects.toThrow("TeamProjectAccess with id 'team-123/nonexistent' not found");
    });
  });
});
