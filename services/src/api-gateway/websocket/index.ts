import { Server as SocketIOServer } from 'socket.io';
import { Logger } from '../../shared/utils/logger';
import { verifyToken } from '../../shared/utils/auth';

const logger = new Logger('WebSocket');

export const setupWebSocket = (io: SocketIOServer): void => {
  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        throw new Error('No token provided');
      }

      const decoded = verifyToken(token);
      (socket as any).userId = decoded.userId;
      (socket as any).userEmail = decoded.email;
      
      next();
    } catch (error) {
      logger.error('WebSocket authentication failed', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    const userEmail = (socket as any).userEmail;
    
    logger.info('User connected via WebSocket', { userId, userEmail, socketId: socket.id });

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('User disconnected from WebSocket', { userId, userEmail, reason });
    });

    // Handle task updates subscription
    socket.on('subscribe:tasks', () => {
      socket.join('tasks');
      logger.info('User subscribed to task updates', { userId });
    });

    socket.on('unsubscribe:tasks', () => {
      socket.leave('tasks');
      logger.info('User unsubscribed from task updates', { userId });
    });

    // Handle workflow updates subscription
    socket.on('subscribe:workflows', () => {
      socket.join('workflows');
      logger.info('User subscribed to workflow updates', { userId });
    });

    socket.on('unsubscribe:workflows', () => {
      socket.leave('workflows');
      logger.info('User unsubscribed from workflow updates', { userId });
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Business Task Automation platform',
      timestamp: new Date().toISOString()
    });
  });

  // Utility functions for broadcasting updates
  (io as any).broadcastTaskUpdate = (taskId: string, update: any) => {
    io.to('tasks').emit('task:updated', { taskId, ...update });
  };

  (io as any).broadcastWorkflowUpdate = (workflowId: string, update: any) => {
    io.to('workflows').emit('workflow:updated', { workflowId, ...update });
  };

  (io as any).notifyUser = (userId: string, notification: any) => {
    io.to(`user:${userId}`).emit('notification', notification);
  };
};