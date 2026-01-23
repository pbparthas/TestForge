/**
 * Socket.io Server Setup
 * Configures and exports the Socket.io server instance
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { webSocketService } from '../services/websocket.service.js';
import { authService } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AuthenticatedSocket extends Socket {
  userId: string;
  username?: string;
}

export interface ExecutionUpdatePayload {
  executionId: string;
  status: string;
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
}

export interface TestResultPayload {
  executionId: string;
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  durationMs?: number;
  error?: string;
}

export interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// =============================================================================
// SOCKET.IO SERVER
// =============================================================================

let io: Server | null = null;

/**
 * Initialize Socket.io server
 */
export function initializeSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const payload = authService.verifyAccessToken(token as string);
      (socket as AuthenticatedSocket).userId = payload.userId;

      next();
    } catch (error) {
      logger.error({ error }, 'Socket authentication failed');
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', async (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    logger.info({ socketId: socket.id, userId }, 'Client connected');

    try {
      // Register connection in database
      await webSocketService.registerConnection({
        socketId: socket.id,
        userId,
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address,
      });
    } catch (error) {
      logger.error({ error, socketId: socket.id }, 'Failed to register connection');
    }

    // Handle ping
    socket.on('ping', async () => {
      try {
        await webSocketService.updatePing(socket.id);
        socket.emit('pong');
      } catch (error) {
        logger.error({ error, socketId: socket.id }, 'Failed to update ping');
      }
    });

    // Handle subscribe to channels
    socket.on('subscribe', async (channels: string | string[]) => {
      const channelList = Array.isArray(channels) ? channels : [channels];

      for (const channel of channelList) {
        try {
          await webSocketService.subscribe(socket.id, channel);
          socket.join(channel);
          logger.debug({ socketId: socket.id, channel }, 'Subscribed to channel');
        } catch (error) {
          logger.error({ error, socketId: socket.id, channel }, 'Failed to subscribe');
        }
      }
    });

    // Handle unsubscribe from channels
    socket.on('unsubscribe', async (channels: string | string[]) => {
      const channelList = Array.isArray(channels) ? channels : [channels];

      for (const channel of channelList) {
        try {
          await webSocketService.unsubscribe(socket.id, channel);
          socket.leave(channel);
          logger.debug({ socketId: socket.id, channel }, 'Unsubscribed from channel');
        } catch (error) {
          logger.error({ error, socketId: socket.id, channel }, 'Failed to unsubscribe');
        }
      }
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      logger.info({ socketId: socket.id, userId, reason }, 'Client disconnected');

      try {
        await webSocketService.disconnectConnection(socket.id);
      } catch (error) {
        logger.error({ error, socketId: socket.id }, 'Failed to disconnect connection');
      }
    });
  });

  logger.info('Socket.io server initialized');

  return io;
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): Server | null {
  return io;
}

// =============================================================================
// EMIT HELPERS
// =============================================================================

/**
 * Emit execution update to subscribers
 */
export async function emitExecutionUpdate(payload: ExecutionUpdatePayload): Promise<void> {
  if (!io) return;

  const channel = `execution:${payload.executionId}`;
  io.to(channel).emit('execution:update', payload);

  logger.debug({ channel, payload }, 'Emitted execution update');
}

/**
 * Emit test result to subscribers
 */
export async function emitTestResult(payload: TestResultPayload): Promise<void> {
  if (!io) return;

  const channel = `execution:${payload.executionId}`;
  io.to(channel).emit('test:result', payload);

  logger.debug({ channel, payload }, 'Emitted test result');
}

/**
 * Emit notification to user
 */
export async function emitNotification(
  userId: string,
  payload: NotificationPayload
): Promise<void> {
  if (!io) return;

  try {
    const socketIds = await webSocketService.broadcastToUser(userId);

    for (const socketId of socketIds) {
      io.to(socketId).emit('notification', payload);
    }

    logger.debug({ userId, socketIds: socketIds.length, payload }, 'Emitted notification');
  } catch (error) {
    logger.error({ error, userId }, 'Failed to emit notification');
  }
}

/**
 * Emit project update to subscribers
 */
export async function emitProjectUpdate(
  projectId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!io) return;

  const channel = `project:${projectId}`;
  io.to(channel).emit(event, data);

  logger.debug({ channel, event, data }, 'Emitted project update');
}

/**
 * Broadcast to all connected clients
 */
export function broadcastToAll(event: string, data: unknown): void {
  if (!io) return;

  io.emit(event, data);
  logger.debug({ event }, 'Broadcasted to all clients');
}

/**
 * Get connected socket count
 */
export async function getConnectedCount(): Promise<number> {
  if (!io) return 0;

  const sockets = await io.fetchSockets();
  return sockets.length;
}
