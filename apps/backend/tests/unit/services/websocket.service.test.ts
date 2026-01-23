/**
 * WebSocket Service Tests (TDD - RED phase)
 * Tests for WebSocket connection management operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocketConnection, WebSocketSubscription, WebSocketConnectionStatus } from '@prisma/client';

// Mock Prisma client - must be hoisted with vi.hoisted
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    webSocketConnection: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    webSocketSubscription: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/prisma.js', () => ({
  prisma: mockPrisma,
}));

// Import after mocking
import { WebSocketService } from '../../../src/services/websocket.service.js';

describe('WebSocketService', () => {
  let wsService: WebSocketService;

  const mockConnection: WebSocketConnection = {
    id: 'conn-123',
    socketId: 'socket-abc123',
    userId: 'user-123',
    status: 'connected' as WebSocketConnectionStatus,
    connectedAt: new Date(),
    lastPingAt: null,
    disconnectedAt: null,
    userAgent: 'Mozilla/5.0',
    ipAddress: '127.0.0.1',
    metadata: null,
  };

  const mockSubscription: WebSocketSubscription = {
    id: 'sub-123',
    connectionId: 'conn-123',
    channel: 'execution:exec-123',
    subscribedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    wsService = new WebSocketService();
  });

  describe('registerConnection', () => {
    it('should create a new connection', async () => {
      mockPrisma.webSocketConnection.create.mockResolvedValue(mockConnection);

      const result = await wsService.registerConnection({
        socketId: 'socket-abc123',
        userId: 'user-123',
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      });

      expect(result.socketId).toBe('socket-abc123');
      expect(result.userId).toBe('user-123');
      expect(result.status).toBe('connected');
    });
  });

  describe('disconnectConnection', () => {
    it('should mark connection as disconnected', async () => {
      mockPrisma.webSocketConnection.findUnique.mockResolvedValue(mockConnection);
      mockPrisma.webSocketConnection.update.mockResolvedValue({
        ...mockConnection,
        status: 'disconnected' as WebSocketConnectionStatus,
        disconnectedAt: new Date(),
      });

      const result = await wsService.disconnectConnection('socket-abc123');

      expect(result.status).toBe('disconnected');
      expect(result.disconnectedAt).toBeDefined();
    });

    it('should throw NotFoundError if connection does not exist', async () => {
      mockPrisma.webSocketConnection.findUnique.mockResolvedValue(null);

      await expect(wsService.disconnectConnection('nonexistent')).rejects.toThrow(
        "WebSocketConnection with id 'nonexistent' not found"
      );
    });
  });

  describe('updatePing', () => {
    it('should update lastPingAt', async () => {
      mockPrisma.webSocketConnection.findUnique.mockResolvedValue(mockConnection);
      mockPrisma.webSocketConnection.update.mockResolvedValue({
        ...mockConnection,
        lastPingAt: new Date(),
      });

      const result = await wsService.updatePing('socket-abc123');

      expect(result.lastPingAt).toBeDefined();
    });
  });

  describe('subscribe', () => {
    it('should create a subscription', async () => {
      mockPrisma.webSocketConnection.findUnique.mockResolvedValue(mockConnection);
      mockPrisma.webSocketSubscription.create.mockResolvedValue(mockSubscription);

      const result = await wsService.subscribe('socket-abc123', 'execution:exec-123');

      expect(result.channel).toBe('execution:exec-123');
      expect(result.connectionId).toBe('conn-123');
    });

    it('should throw NotFoundError if connection does not exist', async () => {
      mockPrisma.webSocketConnection.findUnique.mockResolvedValue(null);

      await expect(wsService.subscribe('nonexistent', 'channel')).rejects.toThrow(
        "WebSocketConnection with id 'nonexistent' not found"
      );
    });
  });

  describe('unsubscribe', () => {
    it('should delete a subscription', async () => {
      mockPrisma.webSocketConnection.findUnique.mockResolvedValue(mockConnection);
      mockPrisma.webSocketSubscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.webSocketSubscription.delete.mockResolvedValue(mockSubscription);

      await wsService.unsubscribe('socket-abc123', 'execution:exec-123');

      expect(mockPrisma.webSocketSubscription.delete).toHaveBeenCalled();
    });
  });

  describe('getConnectionsByUser', () => {
    it('should return connections for a user', async () => {
      mockPrisma.webSocketConnection.findMany.mockResolvedValue([mockConnection]);

      const result = await wsService.getConnectionsByUser('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-123');
    });
  });

  describe('getActiveConnections', () => {
    it('should return only connected connections', async () => {
      mockPrisma.webSocketConnection.findMany.mockResolvedValue([mockConnection]);

      const result = await wsService.getActiveConnections();

      expect(result).toHaveLength(1);
      expect(mockPrisma.webSocketConnection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'connected' },
        })
      );
    });
  });

  describe('getSubscriptionsForChannel', () => {
    it('should return subscriptions for a channel', async () => {
      mockPrisma.webSocketSubscription.findMany.mockResolvedValue([
        { ...mockSubscription, connection: mockConnection },
      ]);

      const result = await wsService.getSubscriptionsForChannel('execution:exec-123');

      expect(result).toHaveLength(1);
      expect(result[0].channel).toBe('execution:exec-123');
    });
  });

  describe('getSocketIdsForChannel', () => {
    it('should return socket IDs subscribed to a channel', async () => {
      mockPrisma.webSocketSubscription.findMany.mockResolvedValue([
        { ...mockSubscription, connection: mockConnection },
      ]);

      const result = await wsService.getSocketIdsForChannel('execution:exec-123');

      expect(result).toContain('socket-abc123');
    });
  });

  describe('cleanupStaleConnections', () => {
    it('should delete connections without recent ping', async () => {
      mockPrisma.webSocketConnection.updateMany.mockResolvedValue({ count: 5 });

      const result = await wsService.cleanupStaleConnections(5); // 5 minutes

      expect(result).toBe(5);
    });
  });

  describe('getConnectionStats', () => {
    it('should return connection statistics', async () => {
      mockPrisma.webSocketConnection.count.mockResolvedValueOnce(100); // total
      mockPrisma.webSocketConnection.count.mockResolvedValueOnce(80); // connected
      mockPrisma.webSocketSubscription.count.mockResolvedValue(150);
      mockPrisma.webSocketConnection.groupBy.mockResolvedValue([
        { status: 'connected', _count: { status: 80 } },
        { status: 'disconnected', _count: { status: 20 } },
      ]);

      const result = await wsService.getConnectionStats();

      expect(result.totalConnections).toBe(100);
      expect(result.activeConnections).toBe(80);
      expect(result.totalSubscriptions).toBe(150);
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return subscriptions for a user', async () => {
      mockPrisma.webSocketConnection.findMany.mockResolvedValue([
        { ...mockConnection, subscriptions: [mockSubscription] },
      ]);

      const result = await wsService.getUserSubscriptions('user-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('broadcastToChannel', () => {
    it('should return socket IDs for broadcasting', async () => {
      mockPrisma.webSocketSubscription.findMany.mockResolvedValue([
        { ...mockSubscription, connection: mockConnection },
      ]);

      const result = await wsService.broadcastToChannel('execution:exec-123');

      expect(result).toContain('socket-abc123');
    });
  });
});
