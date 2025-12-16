import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const smsAnalyticsController = {
  async getSummary(req: AuthRequest, res: Response) {
    try {
      const telecallerId = req.telecaller!.id;

      const [totals] = await prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*)::int as "totalMessagesSent",
          COUNT(DISTINCT "customer_id")::int as "uniqueCustomersContacted",
          MIN("sent_at") as "firstMessageAt",
          MAX("sent_at") as "lastMessageAt",
          SUM(CASE WHEN "status" = 'delivered' THEN 1 ELSE 0 END)::int as "messagesDelivered",
          SUM(CASE WHEN "status" = 'failed' THEN 1 ELSE 0 END)::int as "messagesFailed"
        FROM "sms_messages"
        WHERE "telecaller_id" = ${telecallerId}
      `;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [last7] = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as "messagesLast7Days"
        FROM "sms_messages"
        WHERE "telecaller_id" = ${telecallerId}
          AND "sent_at" >= ${sevenDaysAgo}
      `;

      const [last30] = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as "messagesLast30Days"
        FROM "sms_messages"
        WHERE "telecaller_id" = ${telecallerId}
          AND "sent_at" >= ${thirtyDaysAgo}
      `;

      res.json({
        success: true,
        data: {
          overview: {
            totalMessagesSent: totals?.totalMessagesSent || 0,
            messagesLast7Days: last7?.messagesLast7Days || 0,
            messagesLast30Days: last30?.messagesLast30Days || 0,
            uniqueCustomersContacted: totals?.uniqueCustomersContacted || 0,
            firstMessageAt: totals?.firstMessageAt || null,
            lastMessageAt: totals?.lastMessageAt || null,
            messagesDelivered: totals?.messagesDelivered || 0,
            messagesFailed: totals?.messagesFailed || 0,
          },
        },
      });
    } catch (error: any) {
      logger.error('Error fetching SMS summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SMS analytics summary',
      });
    }
  },

  async getByTelecaller(req: AuthRequest, res: Response) {
    try {
      const telecallerStats = await prisma.$queryRaw<any[]>`
        SELECT
          t.id as "telecallerId",
          t."full_name" as "fullName",
          COUNT(sm.id)::int as "messagesSent",
          COUNT(DISTINCT sm."customer_id")::int as "uniqueCustomersContacted",
          SUM(CASE WHEN sm.status = 'delivered' THEN 1 ELSE 0 END)::int as "messagesDelivered",
          SUM(CASE WHEN sm.status = 'failed' THEN 1 ELSE 0 END)::int as "messagesFailed",
          MIN(sm."sent_at") as "firstMessageAt",
          MAX(sm."sent_at") as "lastMessageAt"
        FROM "telecallers" t
        LEFT JOIN "sms_messages" sm ON t.id = sm."telecaller_id"
        GROUP BY t.id, t."full_name"
        ORDER BY "messagesSent" DESC
      `;

      res.json({
        success: true,
        data: telecallerStats,
      });
    } catch (error: any) {
      logger.error('Error fetching SMS telecaller stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SMS telecaller analytics',
      });
    }
  },

  async getByCustomer(req: AuthRequest, res: Response) {
    try {
      const telecallerId = req.telecaller!.id;

      const customerStats = await prisma.$queryRaw<any[]>`
        SELECT
          c.id as "customerId",
          c."customer_name" as "customerName",
          c."vehicle_number" as "vehicleNumber",
          COUNT(sm.id)::int as "messagesSent",
          SUM(CASE WHEN sm.status = 'delivered' THEN 1 ELSE 0 END)::int as "messagesDelivered",
          SUM(CASE WHEN sm.status = 'failed' THEN 1 ELSE 0 END)::int as "messagesFailed",
          MAX(sm."sent_at") as "lastMessageAt"
        FROM "sms_messages" sm
        JOIN "customers" c ON c.id = sm."customer_id"
        WHERE sm."telecaller_id" = ${telecallerId}
        GROUP BY c.id, c."customer_name", c."vehicle_number"
        ORDER BY "lastMessageAt" DESC
      `;

      res.json({
        success: true,
        data: customerStats,
      });
    } catch (error: any) {
      logger.error('Error fetching SMS customer stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SMS customer analytics',
      });
    }
  },

  async getTimeseries(req: AuthRequest, res: Response) {
    try {
      const telecallerId = req.telecaller!.id;

      const timeseries = await prisma.$queryRaw<any[]>`
        SELECT
          DATE_TRUNC('day', "sent_at") as "date",
          COUNT(*)::int as "messagesSent",
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)::int as "messagesDelivered",
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::int as "messagesFailed"
        FROM "sms_messages"
        WHERE "telecaller_id" = ${telecallerId}
        GROUP BY DATE_TRUNC('day', "sent_at")
        ORDER BY "date" ASC
      `;

      res.json({
        success: true,
        data: timeseries,
      });
    } catch (error: any) {
      logger.error('Error fetching SMS timeseries:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch SMS timeseries analytics',
      });
    }
  },
};
