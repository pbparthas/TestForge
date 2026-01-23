/**
 * Team Routes Integration Tests
 * Tests the full HTTP request/response cycle for team management endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Team, TeamMember, TeamProjectAccess, TeamMemberRole, TeamAccessLevel } from '@prisma/client';

// Mock dependencies before importing app
const { mockPrisma, mockBcrypt, mockJwt } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
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
    },
    teamProjectAccess: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  mockBcrypt: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  mockJwt: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('bcryptjs', () => ({
  default: mockBcrypt,
}));

vi.mock('jsonwebtoken', () => ({
  default: mockJwt,
}));

// Import app after mocking
import app from '../../src/app.js';

describe('Team Routes Integration', () => {
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

  const adminToken = 'admin_test_token';
  const userToken = 'user_test_token';
  const leadToken = 'lead_test_token';

  beforeEach(() => {
    vi.clearAllMocks();

    mockJwt.verify.mockImplementation((token: string) => {
      if (token === adminToken) {
        return { userId: 'admin-123', role: 'admin' };
      }
      if (token === userToken) {
        return { userId: 'user-123', role: 'qae' };
      }
      if (token === leadToken) {
        return { userId: 'lead-123', role: 'lead' };
      }
      throw new Error('Invalid token');
    });
  });

  describe('GET /api/teams', () => {
    it('should return paginated teams for authenticated user', async () => {
      mockPrisma.team.findMany.mockResolvedValue([mockTeam]);
      mockPrisma.team.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/api/teams')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.data).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/teams');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/teams/:id', () => {
    it('should return team by id', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);

      const response = await request(app)
        .get('/api/teams/team-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('team-123');
    });

    it('should return 404 for non-existent team', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/teams/nonexistent')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/teams/:id/details', () => {
    it('should return team with members and project access', async () => {
      mockPrisma.team.findUnique.mockResolvedValue({
        ...mockTeam,
        members: [mockTeamMember],
        projectAccess: [mockTeamProjectAccess],
      });

      const response = await request(app)
        .get('/api/teams/team-123/details')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.members).toHaveLength(1);
      expect(response.body.data.projectAccess).toHaveLength(1);
    });
  });

  describe('POST /api/teams', () => {
    it('should create a new team for admin', async () => {
      mockPrisma.team.create.mockResolvedValue(mockTeam);

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Team',
          description: 'A new team',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBeDefined();
    });

    it('should create a new team for lead', async () => {
      mockPrisma.team.create.mockResolvedValue(mockTeam);

      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${leadToken}`)
        .send({
          name: 'New Team',
        });

      expect(response.status).toBe(201);
    });

    it('should return 403 for qae users', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'New Team',
        });

      expect(response.status).toBe(403);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '', // Empty name should fail
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/teams/:id', () => {
    it('should update team for admin', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.team.update.mockResolvedValue({ ...mockTeam, name: 'Updated Team' });

      const response = await request(app)
        .patch('/api/teams/team-123')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Team' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Team');
    });

    it('should return 403 for qae users', async () => {
      const response = await request(app)
        .patch('/api/teams/team-123')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Team' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/teams/:id', () => {
    it('should delete team for admin', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.team.delete.mockResolvedValue(mockTeam);

      const response = await request(app)
        .delete('/api/teams/team-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .delete('/api/teams/team-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/teams/:id/members', () => {
    it('should add member to team for admin', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamMember.create.mockResolvedValue(mockTeamMember);

      const response = await request(app)
        .post('/api/teams/team-123/members')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: '00000000-0000-0000-0000-000000000456',
          role: 'member',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.userId).toBe('user-456');
    });
  });

  describe('PATCH /api/teams/:teamId/members/:userId', () => {
    it('should update member role', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(mockTeamMember);
      mockPrisma.teamMember.update.mockResolvedValue({
        ...mockTeamMember,
        role: 'admin' as TeamMemberRole,
      });

      const response = await request(app)
        .patch('/api/teams/team-123/members/user-456')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe('admin');
    });
  });

  describe('DELETE /api/teams/:teamId/members/:userId', () => {
    it('should remove member from team', async () => {
      mockPrisma.teamMember.findUnique.mockResolvedValue(mockTeamMember);
      mockPrisma.teamMember.delete.mockResolvedValue(mockTeamMember);

      const response = await request(app)
        .delete('/api/teams/team-123/members/user-456')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/teams/:id/projects', () => {
    it('should grant project access to team', async () => {
      mockPrisma.team.findUnique.mockResolvedValue(mockTeam);
      mockPrisma.teamProjectAccess.create.mockResolvedValue(mockTeamProjectAccess);

      const response = await request(app)
        .post('/api/teams/team-123/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId: '00000000-0000-0000-0000-000000000123',
          accessLevel: 'write',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.projectId).toBe('project-123');
    });
  });

  describe('DELETE /api/teams/:teamId/projects/:projectId', () => {
    it('should revoke project access from team', async () => {
      mockPrisma.teamProjectAccess.findUnique.mockResolvedValue(mockTeamProjectAccess);
      mockPrisma.teamProjectAccess.delete.mockResolvedValue(mockTeamProjectAccess);

      const response = await request(app)
        .delete('/api/teams/team-123/projects/project-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/teams/my-teams', () => {
    it('should return teams for current user', async () => {
      mockPrisma.teamMember.findMany.mockResolvedValue([
        { ...mockTeamMember, team: mockTeam },
      ]);

      const response = await request(app)
        .get('/api/teams/my-teams')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });
});
