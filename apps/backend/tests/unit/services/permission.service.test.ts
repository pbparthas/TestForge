/**
 * Permission Service Tests (TDD - RED phase)
 * Tests for RBAC/permission management operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Permission, Role, RolePermission, UserRoleAssignment, UserPermission } from '@prisma/client';

// Mock Prisma client - must be hoisted with vi.hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    permission: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    role: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    rolePermission: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    userRoleAssignment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    userPermission: {
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
import { PermissionService } from '../../../src/services/permission.service.js';

describe('PermissionService', () => {
  let permissionService: PermissionService;

  const mockPermission: Permission = {
    id: 'perm-123',
    name: 'project.create',
    description: 'Create projects',
    resource: 'project',
    action: 'create',
    createdAt: new Date(),
  };

  const mockRole: Role = {
    id: 'role-123',
    name: 'project_manager',
    description: 'Project Manager',
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRolePermission: RolePermission = {
    id: 'rp-123',
    roleId: 'role-123',
    permissionId: 'perm-123',
    createdAt: new Date(),
  };

  const mockUserRoleAssignment: UserRoleAssignment = {
    id: 'ura-123',
    userId: 'user-123',
    roleId: 'role-123',
    projectId: null,
    assignedAt: new Date(),
    assignedBy: 'admin-123',
    expiresAt: null,
  };

  const mockUserPermission: UserPermission = {
    id: 'up-123',
    userId: 'user-123',
    permissionId: 'perm-123',
    projectId: null,
    isGranted: true,
    grantedAt: new Date(),
    grantedBy: 'admin-123',
    expiresAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    permissionService = new PermissionService();
  });

  // =============================================================================
  // PERMISSION TESTS
  // =============================================================================

  describe('createPermission', () => {
    it('should create a permission', async () => {
      mockPrisma.permission.create.mockResolvedValue(mockPermission);

      const result = await permissionService.createPermission({
        name: 'project.create',
        description: 'Create projects',
        resource: 'project',
        action: 'create',
      });

      expect(result.name).toBe('project.create');
      expect(result.resource).toBe('project');
      expect(result.action).toBe('create');
    });
  });

  describe('findPermissionById', () => {
    it('should return permission by id', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);

      const result = await permissionService.findPermissionById('perm-123');

      expect(result).toEqual(mockPermission);
    });

    it('should throw NotFoundError if permission does not exist', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      await expect(permissionService.findPermissionById('nonexistent')).rejects.toThrow(
        "Permission with id 'nonexistent' not found"
      );
    });
  });

  describe('findAllPermissions', () => {
    it('should return all permissions', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);

      const result = await permissionService.findAllPermissions();

      expect(result).toHaveLength(1);
    });

    it('should filter by resource', async () => {
      mockPrisma.permission.findMany.mockResolvedValue([mockPermission]);

      await permissionService.findAllPermissions({ resource: 'project' });

      expect(mockPrisma.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resource: 'project' }),
        })
      );
    });
  });

  // =============================================================================
  // ROLE TESTS
  // =============================================================================

  describe('createRole', () => {
    it('should create a role', async () => {
      mockPrisma.role.create.mockResolvedValue(mockRole);

      const result = await permissionService.createRole({
        name: 'project_manager',
        description: 'Project Manager',
      });

      expect(result.name).toBe('project_manager');
    });
  });

  describe('findRoleById', () => {
    it('should return role by id', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);

      const result = await permissionService.findRoleById('role-123');

      expect(result).toEqual(mockRole);
    });

    it('should throw NotFoundError if role does not exist', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);

      await expect(permissionService.findRoleById('nonexistent')).rejects.toThrow(
        "Role with id 'nonexistent' not found"
      );
    });
  });

  describe('findAllRoles', () => {
    it('should return all roles', async () => {
      mockPrisma.role.findMany.mockResolvedValue([mockRole]);

      const result = await permissionService.findAllRoles();

      expect(result).toHaveLength(1);
    });
  });

  describe('deleteRole', () => {
    it('should delete a role', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.role.delete.mockResolvedValue(mockRole);

      await permissionService.deleteRole('role-123');

      expect(mockPrisma.role.delete).toHaveBeenCalledWith({
        where: { id: 'role-123' },
      });
    });

    it('should throw error when deleting system role', async () => {
      mockPrisma.role.findUnique.mockResolvedValue({ ...mockRole, isSystem: true });

      await expect(permissionService.deleteRole('role-123')).rejects.toThrow(
        'Cannot delete system role'
      );
    });
  });

  // =============================================================================
  // ROLE PERMISSION TESTS
  // =============================================================================

  describe('assignPermissionToRole', () => {
    it('should assign permission to role', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.rolePermission.create.mockResolvedValue(mockRolePermission);

      const result = await permissionService.assignPermissionToRole('role-123', 'perm-123');

      expect(result.roleId).toBe('role-123');
      expect(result.permissionId).toBe('perm-123');
    });
  });

  describe('removePermissionFromRole', () => {
    it('should remove permission from role', async () => {
      mockPrisma.rolePermission.findUnique.mockResolvedValue(mockRolePermission);
      mockPrisma.rolePermission.delete.mockResolvedValue(mockRolePermission);

      await permissionService.removePermissionFromRole('role-123', 'perm-123');

      expect(mockPrisma.rolePermission.delete).toHaveBeenCalled();
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for a role', async () => {
      mockPrisma.rolePermission.findMany.mockResolvedValue([
        { ...mockRolePermission, permission: mockPermission },
      ]);

      const result = await permissionService.getRolePermissions('role-123');

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================================
  // USER ROLE ASSIGNMENT TESTS
  // =============================================================================

  describe('assignRoleToUser', () => {
    it('should assign role to user', async () => {
      mockPrisma.role.findUnique.mockResolvedValue(mockRole);
      mockPrisma.userRoleAssignment.create.mockResolvedValue(mockUserRoleAssignment);

      const result = await permissionService.assignRoleToUser(
        'user-123',
        'role-123',
        null,
        'admin-123'
      );

      expect(result.userId).toBe('user-123');
      expect(result.roleId).toBe('role-123');
    });
  });

  describe('removeRoleFromUser', () => {
    it('should remove role from user', async () => {
      mockPrisma.userRoleAssignment.findUnique.mockResolvedValue(mockUserRoleAssignment);
      mockPrisma.userRoleAssignment.delete.mockResolvedValue(mockUserRoleAssignment);

      await permissionService.removeRoleFromUser('user-123', 'role-123', null);

      expect(mockPrisma.userRoleAssignment.delete).toHaveBeenCalled();
    });
  });

  describe('getUserRoles', () => {
    it('should return roles for a user', async () => {
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        { ...mockUserRoleAssignment, role: mockRole },
      ]);

      const result = await permissionService.getUserRoles('user-123');

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================================
  // USER PERMISSION TESTS
  // =============================================================================

  describe('grantPermissionToUser', () => {
    it('should grant permission to user', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.create.mockResolvedValue(mockUserPermission);

      const result = await permissionService.grantPermissionToUser(
        'user-123',
        'perm-123',
        null,
        'admin-123'
      );

      expect(result.userId).toBe('user-123');
      expect(result.permissionId).toBe('perm-123');
      expect(result.isGranted).toBe(true);
    });
  });

  describe('denyPermissionToUser', () => {
    it('should deny permission to user', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(mockPermission);
      mockPrisma.userPermission.create.mockResolvedValue({
        ...mockUserPermission,
        isGranted: false,
      });

      const result = await permissionService.denyPermissionToUser(
        'user-123',
        'perm-123',
        null,
        'admin-123'
      );

      expect(result.isGranted).toBe(false);
    });
  });

  describe('removePermissionFromUser', () => {
    it('should remove permission from user', async () => {
      mockPrisma.userPermission.findUnique.mockResolvedValue(mockUserPermission);
      mockPrisma.userPermission.delete.mockResolvedValue(mockUserPermission);

      await permissionService.removePermissionFromUser('user-123', 'perm-123', null);

      expect(mockPrisma.userPermission.delete).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // PERMISSION CHECK TESTS
  // =============================================================================

  describe('checkPermission', () => {
    it('should return true if user has direct permission', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([mockUserPermission]);
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([]);

      const result = await permissionService.checkPermission('user-123', 'project', 'create');

      expect(result).toBe(true);
    });

    it('should return true if user has permission via role', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([]);
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([
        {
          ...mockUserRoleAssignment,
          role: {
            ...mockRole,
            permissions: [{ permission: mockPermission }],
          },
        },
      ]);

      const result = await permissionService.checkPermission('user-123', 'project', 'create');

      expect(result).toBe(true);
    });

    it('should return false if user has denied permission', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([
        { ...mockUserPermission, isGranted: false },
      ]);
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([]);

      const result = await permissionService.checkPermission('user-123', 'project', 'create');

      expect(result).toBe(false);
    });

    it('should return false if user has no permission', async () => {
      mockPrisma.userPermission.findMany.mockResolvedValue([]);
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([]);

      const result = await permissionService.checkPermission('user-123', 'project', 'create');

      expect(result).toBe(false);
    });
  });

  describe('getUserEffectivePermissions', () => {
    it('should return all effective permissions for a user', async () => {
      // First call: get direct granted permissions
      mockPrisma.userPermission.findMany.mockResolvedValueOnce([
        { ...mockUserPermission, permission: mockPermission },
      ]);
      // Second call: get denied permissions
      mockPrisma.userPermission.findMany.mockResolvedValueOnce([]);
      mockPrisma.userRoleAssignment.findMany.mockResolvedValue([]);

      const result = await permissionService.getUserEffectivePermissions('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('project.create');
    });
  });
});
