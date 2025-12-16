import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const whatsappAnalyticsController = {
  async getSummary(req: AuthRequest, res: Response) {
    try {
      const telecallerId = req.telecaller!.id;

      const [totals] = await prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*)::int as "totalMessagesSent",
          COUNT(DISTINCT "customer_id")::int as "uniqueCustomersContacted",
          MIN("sent_at") as "firstMessageAt",
          MAX("sent_at") as "lastMessageAt",
          SUM(CASE WHEN "status" = 'read' THEN 1 ELSE 0 END)::int as "messagesRead"
        FROM "whatsapp_messages"
        WHERE "telecaller_id" = ${telecallerId}
      `;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [last7] = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as "messagesLast7Days"
        FROM "whatsapp_messages"
        WHERE "telecaller_id" = ${telecallerId}
          AND "sent_at" >= ${sevenDaysAgo}
      `;

      const [last30] = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as "messagesLast30Days"
        FROM "whatsapp_messages"
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
            messagesRead: totals?.messagesRead || 0,
          },
        },
      });
    } catch (error: any) {
      logger.error('Error fetching WhatsApp summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch WhatsApp analytics summary',
      });
    }
  },

  async getByTelecaller(req: AuthRequest, res: Response) {
    try {
      const telecallerStats = await prisma.$queryRaw<any[]>`
        SELECT
          t.id as "telecallerId",
          t."full_name" as "fullName",
          COUNT(wm.id)::int as "messagesSent",
          COUNT(DISTINCT wm."customer_id")::int as "uniqueCustomersContacted",
          SUM(CASE WHEN wm.status = 'read' THEN 1 ELSE 0 END)::int as "messagesRead",
          MIN(wm."sent_at") as "firstMessageAt",
          MAX(wm."sent_at") as "lastMessageAt"
        FROM "telecallers" t
        LEFT JOIN "whatsapp_messages" wm ON t.id = wm."telecaller_id"
        GROUP BY t.id, t."full_name"
        ORDER BY "messagesSent" DESC
      `;

      res.json({
        success: true,
        data: telecallerStats,
      });
    } catch (error: any) {
      logger.error('Error fetching WhatsApp telecaller stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch WhatsApp telecaller analytics',
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
          COUNT(wm.id)::int as "messagesSent",
          SUM(CASE WHEN wm.status = 'read' THEN 1 ELSE 0 END)::int as "messagesRead",
          MAX(wm."sent_at") as "lastMessageAt"
        FROM "whatsapp_messages" wm
        JOIN "customers" c ON c.id = wm."customer_id"
        WHERE wm."telecaller_id" = ${telecallerId}
        GROUP BY c.id, c."customer_name", c."vehicle_number"
        ORDER BY "lastMessageAt" DESC
      `;

      res.json({
        success: true,
        data: customerStats,
      });
    } catch (error: any) {
      logger.error('Error fetching WhatsApp customer stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch WhatsApp customer analytics',
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
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END)::int as "messagesRead"
        FROM "whatsapp_messages"
        WHERE "telecaller_id" = ${telecallerId}
        GROUP BY DATE_TRUNC('day', "sent_at")
        ORDER BY "date" ASC
      `;

      res.json({
        success: true,
        data: timeseries,
      });
    } catch (error: any) {
      logger.error('Error fetching WhatsApp timeseries:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch WhatsApp timeseries analytics',
      });
    }
  },
};
