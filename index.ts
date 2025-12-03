import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/env.config';
import userRoutes from './routes/user.routes';
import chatRoutes from './routes/chat.routes';
import projectRoutes from './routes/project.routes';
import sqlAssistantRoutes from './routes/sql-assistant.routes';
import { sendError } from './utils/response';
import { AppError } from './utils/errors';
import logger from './utils/logger';

const app = express();

// Middleware
app.use(cors({ origin: "http://192.168.1.112:5174" }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/sql-assistant', sqlAssistantRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errorCode, err.details);
  } else {
    logger.error('Unhandled Error:', err);
    sendError(res, 'Internal Server Error', 500);
  }
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
