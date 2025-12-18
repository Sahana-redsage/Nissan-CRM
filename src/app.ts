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
import surveyRoutes from './routes/survey';
import emailAnalyticsRoutes from './routes/emailAnalytics';
import emailRoutes from './routes/emailRoutes';
import whatsappRoutes from './routes/whatsapp';
import customerViewRoutes from './routes/customersView';
import smsRoutes from './routes/sms';
import whatsappAnalyticsRoutes from './routes/whatsappAnalytics';
import smsAnalyticsRoutes from './routes/smsAnalytics';
import sourceMetricsRoutes from './routes/sourceMetrics';
import analyticsRoutes from './routes/analyticsRoutes';
import serviceCenterRoutes from './routes/serviceCenterRoutes';
import serviceAppointmentRoutes from './routes/serviceAppointmentRoutes';
import callbackRequestRoutes from './routes/callbackRequestRoutes';

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
app.use('/api/survey', surveyRoutes);
app.use('/api/email-analytics', emailAnalyticsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/customerView', customerViewRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/whatsapp-analytics', whatsappAnalyticsRoutes);
app.use('/api/sms-analytics', smsAnalyticsRoutes);
app.use('/api/source-metrics', sourceMetricsRoutes);
app.use('/api/source-metrics', sourceMetricsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/service-centers', serviceCenterRoutes);
app.use('/api/service-appointments', serviceAppointmentRoutes);
app.use('/api/callback-requests', callbackRequestRoutes);

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

export default app;
