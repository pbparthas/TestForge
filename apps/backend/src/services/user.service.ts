/**
 * User Service
 * Handles user CRUD operations and password management
 */

import type { User, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, ConflictError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface FindAllParams {
  page: number;
  limit: number;
  role?: UserRole;
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

// =============================================================================
// SERVICE
// =============================================================================

export class UserService {
  private readonly SALT_ROUNDS = 10;

  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<User> {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role ?? 'qae',
      },
    });

    return user;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User', id);
    }

    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find all users with pagination and filtering
   */
  async findAll(params: FindAllParams): Promise<PaginatedResult<User>> {
    const { page, limit, role, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = params;

    const where: { role?: UserRole; isActive?: boolean } = {};
    if (role !== undefined) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.user.count({ where }),
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
   * Update user fields (excluding password)
   */
  async update(id: string, input: UpdateUserInput): Promise<User> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundError('User', id);
    }

    // If updating email, check it's not taken
    if (input.email && input.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (emailExists) {
        throw new ConflictError('Email already exists');
      }
    }

    // Remove any password fields from input
    const safeInput: UpdateUserInput = {
      email: input.email,
      name: input.name,
      role: input.role,
      isActive: input.isActive,
    };

    // Remove undefined values
    const cleanInput = Object.fromEntries(
      Object.entries(safeInput).filter(([_, v]) => v !== undefined)
    );

    const user = await prisma.user.update({
      where: { id },
      data: cleanInput,
    });

    return user;
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundError('User', id);
    }

    const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundError('User', id);
    }

    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivate(id: string): Promise<User> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundError('User', id);
    }

    return prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Activate user
   */
  async activate(id: string): Promise<User> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundError('User', id);
    }

    return prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

// Export singleton instance
export const userService = new UserService();
