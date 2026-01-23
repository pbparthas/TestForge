/**
 * Permission Service
 * Handles RBAC/permission management operations
 */

import type { Permission, Role, RolePermission, UserRoleAssignment, UserPermission } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, ForbiddenError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreatePermissionInput {
  name: string;
  description?: string;
  resource: string;
  action: string;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  isSystem?: boolean;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
}

export interface FindPermissionsParams {
  resource?: string;
  action?: string;
}

export interface PermissionWithDetails extends Permission {
  rolePermissions?: RolePermission[];
  userPermissions?: UserPermission[];
}

export interface RoleWithPermissions extends Role {
  permissions: (RolePermission & { permission: Permission })[];
}

export interface UserRoleWithRole extends UserRoleAssignment {
  role: Role;
}

export interface UserPermissionWithDetails extends UserPermission {
  permission: Permission;
}

// =============================================================================
// SERVICE
// =============================================================================

export class PermissionService {
  // ===========================================================================
  // PERMISSION CRUD
  // ===========================================================================

  /**
   * Create a new permission
   */
  async createPermission(input: CreatePermissionInput): Promise<Permission> {
    const permission = await prisma.permission.create({
      data: {
        name: input.name,
        description: input.description,
        resource: input.resource,
        action: input.action,
      },
    });

    return permission;
  }

  /**
   * Find permission by ID
   */
  async findPermissionById(id: string): Promise<Permission> {
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundError('Permission', id);
    }

    return permission;
  }

  /**
   * Find permission by name
   */
  async findPermissionByName(name: string): Promise<Permission | null> {
    return prisma.permission.findUnique({
      where: { name },
    });
  }

  /**
   * Find all permissions
   */
  async findAllPermissions(params?: FindPermissionsParams): Promise<Permission[]> {
    const where: { resource?: string; action?: string } = {};

    if (params?.resource) where.resource = params.resource;
    if (params?.action) where.action = params.action;

    return prisma.permission.findMany({
      where,
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * Delete permission
   */
  async deletePermission(id: string): Promise<void> {
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundError('Permission', id);
    }

    await prisma.permission.delete({
      where: { id },
    });
  }

  // ===========================================================================
  // ROLE CRUD
  // ===========================================================================

  /**
   * Create a new role
   */
  async createRole(input: CreateRoleInput): Promise<Role> {
    const role = await prisma.role.create({
      data: {
        name: input.name,
        description: input.description,
        isSystem: input.isSystem ?? false,
      },
    });

    return role;
  }

  /**
   * Find role by ID
   */
  async findRoleById(id: string): Promise<Role> {
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundError('Role', id);
    }

    return role;
  }

  /**
   * Find role by name
   */
  async findRoleByName(name: string): Promise<Role | null> {
    return prisma.role.findUnique({
      where: { name },
    });
  }

  /**
   * Find all roles
   */
  async findAllRoles(): Promise<Role[]> {
    return prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update role
   */
  async updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundError('Role', id);
    }

    const cleanInput = Object.fromEntries(
      Object.entries(input).filter(([_, v]) => v !== undefined)
    );

    return prisma.role.update({
      where: { id },
      data: cleanInput,
    });
  }

  /**
   * Delete role
   */
  async deleteRole(id: string): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundError('Role', id);
    }

    if (role.isSystem) {
      throw new ForbiddenError('Cannot delete system role');
    }

    await prisma.role.delete({
      where: { id },
    });
  }

  // ===========================================================================
  // ROLE PERMISSION MANAGEMENT
  // ===========================================================================

  /**
   * Assign permission to role
   */
  async assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission> {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundError('Role', roleId);

    const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) throw new NotFoundError('Permission', permissionId);

    return prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
      },
    });
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    const rolePermission = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: { roleId, permissionId },
      },
    });

    if (!rolePermission) {
      throw new NotFoundError('RolePermission', `${roleId}/${permissionId}`);
    }

    await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: { roleId, permissionId },
      },
    });
  }

  /**
   * Get permissions for a role
   */
  async getRolePermissions(roleId: string): Promise<(RolePermission & { permission: Permission })[]> {
    return prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
  }

  // ===========================================================================
  // USER ROLE ASSIGNMENT
  // ===========================================================================

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    projectId: string | null,
    assignedBy?: string,
    expiresAt?: Date
  ): Promise<UserRoleAssignment> {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundError('Role', roleId);

    return prisma.userRoleAssignment.create({
      data: {
        userId,
        roleId,
        projectId,
        assignedBy,
        expiresAt,
      },
    });
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, roleId: string, projectId: string | null): Promise<void> {
    const assignment = await prisma.userRoleAssignment.findUnique({
      where: {
        userId_roleId_projectId: { userId, roleId, projectId: projectId ?? 'NULL_PROJECT' },
      },
    });

    // Try with actual null if composite key fails
    if (!assignment) {
      const assignments = await prisma.userRoleAssignment.findMany({
        where: { userId, roleId, projectId },
      });

      if (assignments.length === 0) {
        throw new NotFoundError('UserRoleAssignment', `${userId}/${roleId}/${projectId}`);
      }

      await prisma.userRoleAssignment.delete({
        where: { id: assignments[0].id },
      });
      return;
    }

    await prisma.userRoleAssignment.delete({
      where: { id: assignment.id },
    });
  }

  /**
   * Get roles for a user
   */
  async getUserRoles(userId: string, projectId?: string | null): Promise<UserRoleWithRole[]> {
    const where: { userId: string; projectId?: string | null } = { userId };
    if (projectId !== undefined) {
      where.projectId = projectId;
    }

    return prisma.userRoleAssignment.findMany({
      where,
      include: { role: true },
    });
  }

  // ===========================================================================
  // USER PERMISSION MANAGEMENT
  // ===========================================================================

  /**
   * Grant permission to user (direct permission)
   */
  async grantPermissionToUser(
    userId: string,
    permissionId: string,
    projectId: string | null,
    grantedBy?: string,
    expiresAt?: Date
  ): Promise<UserPermission> {
    const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) throw new NotFoundError('Permission', permissionId);

    return prisma.userPermission.create({
      data: {
        userId,
        permissionId,
        projectId,
        isGranted: true,
        grantedBy,
        expiresAt,
      },
    });
  }

  /**
   * Deny permission to user (explicit deny)
   */
  async denyPermissionToUser(
    userId: string,
    permissionId: string,
    projectId: string | null,
    grantedBy?: string
  ): Promise<UserPermission> {
    const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) throw new NotFoundError('Permission', permissionId);

    return prisma.userPermission.create({
      data: {
        userId,
        permissionId,
        projectId,
        isGranted: false,
        grantedBy,
      },
    });
  }

  /**
   * Remove permission from user
   */
  async removePermissionFromUser(
    userId: string,
    permissionId: string,
    projectId: string | null
  ): Promise<void> {
    const userPermission = await prisma.userPermission.findUnique({
      where: {
        userId_permissionId_projectId: {
          userId,
          permissionId,
          projectId: projectId ?? 'NULL_PROJECT',
        },
      },
    });

    // Try with actual null if composite key fails
    if (!userPermission) {
      const permissions = await prisma.userPermission.findMany({
        where: { userId, permissionId, projectId },
      });

      if (permissions.length === 0) {
        throw new NotFoundError('UserPermission', `${userId}/${permissionId}/${projectId}`);
      }

      await prisma.userPermission.delete({
        where: { id: permissions[0].id },
      });
      return;
    }

    await prisma.userPermission.delete({
      where: { id: userPermission.id },
    });
  }

  /**
   * Get direct permissions for a user
   */
  async getUserDirectPermissions(
    userId: string,
    projectId?: string | null
  ): Promise<UserPermissionWithDetails[]> {
    const where: { userId: string; projectId?: string | null } = { userId };
    if (projectId !== undefined) {
      where.projectId = projectId;
    }

    return prisma.userPermission.findMany({
      where,
      include: { permission: true },
    });
  }

  // ===========================================================================
  // PERMISSION CHECKING
  // ===========================================================================

  /**
   * Check if user has permission
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string,
    projectId?: string | null
  ): Promise<boolean> {
    // 1. Check direct user permissions (explicit deny takes priority)
    const directPermissions = await prisma.userPermission.findMany({
      where: {
        userId,
        OR: [
          { projectId: projectId ?? null },
          { projectId: null }, // Global permissions
        ],
        permission: {
          resource,
          action,
        },
      },
      include: { permission: true },
    });

    // Check for explicit deny
    const denied = directPermissions.find(p => !p.isGranted);
    if (denied) return false;

    // Check for explicit grant
    const granted = directPermissions.find(p => p.isGranted);
    if (granted) return true;

    // 2. Check role-based permissions
    const userRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId,
        AND: [
          {
            OR: [
              { projectId: projectId ?? null },
              { projectId: null }, // Global roles
            ],
          },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    for (const userRole of userRoles) {
      const hasPermission = userRole.role.permissions.some(
        rp => rp.permission.resource === resource && rp.permission.action === action
      );
      if (hasPermission) return true;
    }

    return false;
  }

  /**
   * Get all effective permissions for a user
   */
  async getUserEffectivePermissions(
    userId: string,
    projectId?: string | null
  ): Promise<Permission[]> {
    const permissionMap = new Map<string, Permission>();

    // 1. Get direct permissions
    const directPermissions = await prisma.userPermission.findMany({
      where: {
        userId,
        isGranted: true,
        OR: [
          { projectId: projectId ?? null },
          { projectId: null },
        ],
      },
      include: { permission: true },
    });

    for (const dp of directPermissions) {
      permissionMap.set(dp.permission.id, dp.permission);
    }

    // 2. Get role-based permissions
    const userRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId,
        OR: [
          { projectId: projectId ?? null },
          { projectId: null },
        ],
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    for (const userRole of userRoles) {
      for (const rp of userRole.role.permissions) {
        permissionMap.set(rp.permission.id, rp.permission);
      }
    }

    // 3. Remove denied permissions
    const deniedPermissions = await prisma.userPermission.findMany({
      where: {
        userId,
        isGranted: false,
        OR: [
          { projectId: projectId ?? null },
          { projectId: null },
        ],
      },
    });

    for (const denied of deniedPermissions) {
      permissionMap.delete(denied.permissionId);
    }

    return Array.from(permissionMap.values());
  }

  /**
   * Bulk check permissions
   */
  async checkPermissions(
    userId: string,
    checks: Array<{ resource: string; action: string }>,
    projectId?: string | null
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const check of checks) {
      const key = `${check.resource}.${check.action}`;
      const hasPermission = await this.checkPermission(
        userId,
        check.resource,
        check.action,
        projectId
      );
      results.set(key, hasPermission);
    }

    return results;
  }
}

// Export singleton instance
export const permissionService = new PermissionService();
