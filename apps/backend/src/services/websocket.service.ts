/**
 * WebSocket Service
 * Handles WebSocket connection management and subscriptions
 */

import type { WebSocketConnection, WebSocketSubscription, WebSocketConnectionStatus } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RegisterConnectionInput {
  socketId: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectionWithSubscriptions extends WebSocketConnection {
  subscriptions: WebSocketSubscription[];
}

export interface SubscriptionWithConnection extends WebSocketSubscription {
  connection: WebSocketConnection;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  totalSubscriptions: number;
  connectionsByStatus: Record<string, number>;
}

// =============================================================================
// SERVICE
// =============================================================================

export class WebSocketService {
  /**
   * Register a new WebSocket connection
   */
  async registerConnection(input: RegisterConnectionInput): Promise<WebSocketConnection> {
    const connection = await prisma.webSocketConnection.create({
      data: {
        socketId: input.socketId,
        userId: input.userId,
        status: 'connected',
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        metadata: input.metadata ?? undefined,
        connectedAt: new Date(),
      },
    });

    return connection;
  }

  /**
   * Find connection by socket ID
   */
  async findBySocketId(socketId: string): Promise<WebSocketConnection | null> {
    return prisma.webSocketConnection.findUnique({
      where: { socketId },
    });
  }

  /**
   * Disconnect a connection
   */
  async disconnectConnection(socketId: string): Promise<WebSocketConnection> {
    const connection = await prisma.webSocketConnection.findUnique({
      where: { socketId },
    });

    if (!connection) {
      throw new NotFoundError('WebSocketConnection', socketId);
    }

    return prisma.webSocketConnection.update({
      where: { socketId },
      data: {
        status: 'disconnected',
        disconnectedAt: new Date(),
      },
    });
  }

  /**
   * Update ping timestamp
   */
  async updatePing(socketId: string): Promise<WebSocketConnection> {
    const connection = await prisma.webSocketConnection.findUnique({
      where: { socketId },
    });

    if (!connection) {
      throw new NotFoundError('WebSocketConnection', socketId);
    }

    return prisma.webSocketConnection.update({
      where: { socketId },
      data: {
        lastPingAt: new Date(),
        status: 'connected',
      },
    });
  }

  /**
   * Set connection to idle
   */
  async setIdle(socketId: string): Promise<WebSocketConnection> {
    return prisma.webSocketConnection.update({
      where: { socketId },
      data: {
        status: 'idle',
      },
    });
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(socketId: string, channel: string): Promise<WebSocketSubscription> {
    const connection = await prisma.webSocketConnection.findUnique({
      where: { socketId },
    });

    if (!connection) {
      throw new NotFoundError('WebSocketConnection', socketId);
    }

    // Check if subscription already exists
    const existing = await prisma.webSocketSubscription.findUnique({
      where: {
        connectionId_channel: {
          connectionId: connection.id,
          channel,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.webSocketSubscription.create({
      data: {
        connectionId: connection.id,
        channel,
      },
    });
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(socketId: string, channel: string): Promise<void> {
    const connection = await prisma.webSocketConnection.findUnique({
      where: { socketId },
    });

    if (!connection) {
      throw new NotFoundError('WebSocketConnection', socketId);
    }

    const subscription = await prisma.webSocketSubscription.findUnique({
      where: {
        connectionId_channel: {
          connectionId: connection.id,
          channel,
        },
      },
    });

    if (subscription) {
      await prisma.webSocketSubscription.delete({
        where: { id: subscription.id },
      });
    }
  }

  /**
   * Get all connections for a user
   */
  async getConnectionsByUser(userId: string): Promise<WebSocketConnection[]> {
    return prisma.webSocketConnection.findMany({
      where: { userId },
    });
  }

  /**
   * Get active connections for a user
   */
  async getActiveConnectionsByUser(userId: string): Promise<WebSocketConnection[]> {
    return prisma.webSocketConnection.findMany({
      where: { userId, status: 'connected' },
    });
  }

  /**
   * Get all active connections
   */
  async getActiveConnections(): Promise<WebSocketConnection[]> {
    return prisma.webSocketConnection.findMany({
      where: { status: 'connected' },
    });
  }

  /**
   * Get subscriptions for a channel
   */
  async getSubscriptionsForChannel(channel: string): Promise<SubscriptionWithConnection[]> {
    return prisma.webSocketSubscription.findMany({
      where: { channel },
      include: { connection: true },
    });
  }

  /**
   * Get socket IDs subscribed to a channel
   */
  async getSocketIdsForChannel(channel: string): Promise<string[]> {
    const subscriptions = await prisma.webSocketSubscription.findMany({
      where: {
        channel,
        connection: { status: 'connected' },
      },
      include: { connection: true },
    });

    return subscriptions.map(s => s.connection.socketId);
  }

  /**
   * Broadcast to channel - returns socket IDs to send to
   */
  async broadcastToChannel(channel: string): Promise<string[]> {
    return this.getSocketIdsForChannel(channel);
  }

  /**
   * Broadcast to user - returns socket IDs for all user connections
   */
  async broadcastToUser(userId: string): Promise<string[]> {
    const connections = await this.getActiveConnectionsByUser(userId);
    return connections.map(c => c.socketId);
  }

  /**
   * Get user subscriptions
   */
  async getUserSubscriptions(userId: string): Promise<WebSocketSubscription[]> {
    const connections = await prisma.webSocketConnection.findMany({
      where: { userId },
      include: { subscriptions: true },
    });

    return connections.flatMap(c => c.subscriptions);
  }

  /**
   * Get connection with subscriptions
   */
  async getConnectionWithSubscriptions(socketId: string): Promise<ConnectionWithSubscriptions | null> {
    return prisma.webSocketConnection.findUnique({
      where: { socketId },
      include: { subscriptions: true },
    });
  }

  /**
   * Cleanup stale connections (no ping in X minutes)
   */
  async cleanupStaleConnections(timeoutMinutes: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - timeoutMinutes);

    const result = await prisma.webSocketConnection.updateMany({
      where: {
        status: 'connected',
        OR: [
          { lastPingAt: { lt: cutoff } },
          { lastPingAt: null, connectedAt: { lt: cutoff } },
        ],
      },
      data: {
        status: 'disconnected',
        disconnectedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Delete disconnected connections older than X hours
   */
  async deleteOldConnections(hoursOld: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hoursOld);

    const result = await prisma.webSocketConnection.deleteMany({
      where: {
        status: 'disconnected',
        disconnectedAt: { lt: cutoff },
      },
    });

    return result.count;
  }

  /**
   * Get connection statistics
   */
  async getConnectionStats(): Promise<ConnectionStats> {
    const [total, active, subscriptions] = await Promise.all([
      prisma.webSocketConnection.count(),
      prisma.webSocketConnection.count({ where: { status: 'connected' } }),
      prisma.webSocketSubscription.count(),
    ]);

    const byStatus = await prisma.webSocketConnection.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const connectionsByStatus: Record<string, number> = {};
    for (const item of byStatus) {
      connectionsByStatus[item.status] = item._count.status;
    }

    return {
      totalConnections: total,
      activeConnections: active,
      totalSubscriptions: subscriptions,
      connectionsByStatus,
    };
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();
