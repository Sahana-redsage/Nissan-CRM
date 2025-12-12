import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import documentRoutes from './routes/documents';
import insightRoutes from './routes/insights';
import callRoutes from './routes/calls';
import dashboardRoutes from './routes/dashboard';

const app = express();

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

export default app;
