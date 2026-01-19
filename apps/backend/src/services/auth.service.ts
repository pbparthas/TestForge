/**
 * Auth Service
 * Handles authentication, JWT tokens, and password management
 */

import type { User, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';
import { UnauthorizedError, ConflictError, NotFoundError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface LoginInput {
  identifier: string; // email or username
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  accessToken: string;
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
}

// =============================================================================
// CONFIG
// =============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'testforge-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

// =============================================================================
// SERVICE
// =============================================================================

export class AuthService {
  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingEmail) {
      throw new ConflictError('Email already exists');
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: input.username },
    });

    if (existingUsername) {
      throw new ConflictError('Username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        name: input.name,
        role: input.role ?? 'qae',
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    // Return user without passwordHash
    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    // Determine if identifier is email or username
    const isEmail = input.identifier.includes('@');

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: input.identifier }
        : { username: input.identifier },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedError('Account is inactive');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    // Return user without passwordHash
    const { passwordHash: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh tokens using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    // Verify the refresh token
    let payload: { userId: string };
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Find the stored refresh token
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userId: payload.userId,
      },
    });

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired');
    }

    // Check if token is revoked
    if (storedToken.isRevoked) {
      throw new UnauthorizedError('Refresh token revoked');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Delete old refresh tokens for this user
    await prisma.refreshToken.deleteMany({
      where: { userId: payload.userId },
    });

    // Generate new tokens
    return this.generateTokens(user);
  }

  /**
   * Verify access token and return payload
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
      return {
        userId: payload.userId,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedError('Invalid access token');
    }
  }

  /**
   * Logout user by revoking all refresh tokens
   */
  async logout(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all refresh tokens (force re-login)
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: User): Promise<TokenResponse> {
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

    // Calculate refresh token expiry
    const refreshExpiresIn = this.parseExpiresIn(JWT_REFRESH_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + refreshExpiresIn);

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Parse expires in string to milliseconds
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // Default 7 days
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
