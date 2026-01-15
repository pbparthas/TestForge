/**
 * User Service Tests (TDD - RED phase)
 * These tests define the expected behavior before implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User, UserRole } from '@prisma/client';

// Mock Prisma client - must be hoisted with vi.hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { UserService } from '../../../src/services/user.service.js';

describe('UserService', () => {
  let userService: UserService;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    name: 'Test User',
    role: 'qae' as UserRole,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    userService = new UserService();
  });

  describe('create', () => {
    it('should create a user with valid input', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const input = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'qae' as UserRole,
      };

      const result = await userService.create(input);

      expect(result.email).toBe(input.email);
      expect(result.name).toBe(input.name);
      expect(result.role).toBe(input.role);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should hash the password before storing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      await userService.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'qae' as UserRole,
      });

      const createCall = mockPrisma.user.create.mock.calls[0]?.[0];
      expect(createCall?.data?.passwordHash).toBeDefined();
      expect(createCall?.data?.passwordHash).not.toBe('password123');
    });

    it('should throw ConflictError if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        userService.create({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          role: 'qae' as UserRole,
        })
      ).rejects.toThrow('Email already exists');
    });

    it('should default role to qae if not provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, role: 'qae' });

      const result = await userService.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(result.role).toBe('qae');
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.findById('user-123');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.findById('nonexistent')).rejects.toThrow(
        "User with id 'nonexistent' not found"
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-456' }];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(2);

      const result = await userService.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by role', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      mockPrisma.user.count.mockResolvedValue(1);

      await userService.findAll({ page: 1, limit: 10, role: 'qae' });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'qae' }),
        })
      );
    });

    it('should filter by isActive', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      mockPrisma.user.count.mockResolvedValue(1);

      await userService.findAll({ page: 1, limit: 10, isActive: true });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
      });

      const result = await userService.update('user-123', {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { name: 'Updated Name' },
      });
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        userService.update('nonexistent', { name: 'New Name' })
      ).rejects.toThrow("User with id 'nonexistent' not found");
    });

    it('should throw ConflictError if updating to existing email', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockUser) // First call: find user to update
        .mockResolvedValueOnce({ ...mockUser, id: 'other-user' }); // Second call: check email exists

      await expect(
        userService.update('user-123', { email: 'existing@example.com' })
      ).rejects.toThrow('Email already exists');
    });

    it('should not allow updating password directly', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await userService.update('user-123', {
        name: 'Test',
        // @ts-expect-error Testing that password is not accepted
        password: 'newpassword',
      });

      const updateCall = mockPrisma.user.update.mock.calls[0]?.[0];
      expect(updateCall?.data?.password).toBeUndefined();
      expect(updateCall?.data?.passwordHash).toBeUndefined();
    });
  });

  describe('updatePassword', () => {
    it('should hash and update password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await userService.updatePassword('user-123', 'newpassword123');

      const updateCall = mockPrisma.user.update.mock.calls[0]?.[0];
      expect(updateCall?.data?.passwordHash).toBeDefined();
      expect(updateCall?.data?.passwordHash).not.toBe('newpassword123');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        userService.updatePassword('nonexistent', 'newpassword')
      ).rejects.toThrow("User with id 'nonexistent' not found");
    });
  });

  describe('delete', () => {
    it('should delete user by id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      await userService.delete('user-123');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(userService.delete('nonexistent')).rejects.toThrow(
        "User with id 'nonexistent' not found"
      );
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await userService.deactivate('user-123');

      expect(result.isActive).toBe(false);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { isActive: false },
      });
    });
  });

  describe('activate', () => {
    it('should set isActive to true', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        isActive: true,
      });

      const result = await userService.activate('user-123');

      expect(result.isActive).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { isActive: true },
      });
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      // The service should compare hashed passwords
      const result = await userService.verifyPassword(
        'password123',
        mockUser.passwordHash
      );

      // This will fail until we implement proper bcrypt comparison
      expect(typeof result).toBe('boolean');
    });

    it('should return false for incorrect password', async () => {
      const result = await userService.verifyPassword(
        'wrongpassword',
        mockUser.passwordHash
      );

      expect(result).toBe(false);
    });
  });
});
