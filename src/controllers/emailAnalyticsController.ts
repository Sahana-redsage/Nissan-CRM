import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const emailAnalyticsController = {
  async getSummary(req: AuthRequest, res: Response) {
    try {
      const telecallerId = req.telecaller!.id;

      const [totals] = await prisma.$queryRaw<any[]>`
        SELECT 
          COUNT(*)::int as "totalEmailsSent",
          COUNT(DISTINCT "customer_id")::int as "uniqueCustomersEmailed",
          MIN(to_timestamp("sent_at" / 1000.0)) as "firstEmailSentAt",
          MAX(to_timestamp("sent_at" / 1000.0)) as "lastEmailSentAt"
        FROM "service_emails"
        WHERE "sent_by" = ${telecallerId}
      `;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [last7] = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as "emailsLast7Days"
        FROM "service_emails"
        WHERE "sent_by" = ${telecallerId}
          AND to_timestamp("sent_at" / 1000.0) >= ${sevenDaysAgo}
      `;

      const [last30] = await prisma.$queryRaw<any[]>`
        SELECT COUNT(*)::int as "emailsLast30Days"
        FROM "service_emails"
        WHERE "sent_by" = ${telecallerId}
          AND to_timestamp("sent_at" / 1000.0) >= ${thirtyDaysAgo}
      `;

      res.json({
        success: true,
        data: {
          overview: {
            totalEmailsSent: totals?.totalEmailsSent || 0,
            emailsLast7Days: last7?.emailsLast7Days || 0,
            emailsLast30Days: last30?.emailsLast30Days || 0,
            uniqueCustomersEmailed: totals?.uniqueCustomersEmailed || 0,
            firstEmailSentAt: totals?.firstEmailSentAt || null,
            lastEmailSentAt: totals?.lastEmailSentAt || null,
          },
        },
      });
    } catch (error: any) {
      logger.error('Error fetching email summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch email analytics summary',
      });
    }
  },

  async getByTelecaller(req: AuthRequest, res: Response) {
    try {
      const telecallerStats = await prisma.$queryRaw<any[]>`
        SELECT
          t.id as "telecallerId",
          t."full_name" as "fullName",
          COUNT(se.id)::int as "emailsSent",
          COUNT(DISTINCT se."customer_id")::int as "uniqueCustomersEmailed",
          MIN(to_timestamp(se."sent_at" / 1000.0)) as "firstEmailSentAt",
          MAX(to_timestamp(se."sent_at" / 1000.0)) as "lastEmailSentAt"
        FROM "telecallers" t
        LEFT JOIN "service_emails" se ON t.id = se."sent_by"
        GROUP BY t.id, t."full_name"
        ORDER BY "emailsSent" DESC
      `;


      res.json({
        success: true,
        data: telecallerStats,
      });
    } catch (error: any) {
      logger.error('Error fetching telecaller email stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch telecaller email analytics',
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
          COUNT(se.id)::int as "emailsSent",
          MIN(to_timestamp(se."sent_at" / 1000.0)) as "firstEmailSentAt",
          MAX(to_timestamp(se."sent_at" / 1000.0)) as "lastEmailSentAt"
        FROM "service_emails" se
        JOIN "customers" c ON c.id = se."customer_id"
        WHERE se."sent_by" = ${telecallerId}
        GROUP BY c.id, c."customer_name", c."vehicle_number"
        ORDER BY "lastEmailSentAt" DESC
      `;

      res.json({
        success: true,
        data: customerStats,
      });
    } catch (error: any) {
      logger.error('Error fetching customer email stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch customer email analytics',
      });
    }
  },

  async getTimeseries(req: AuthRequest, res: Response) {
    try {
      const telecallerId = req.telecaller!.id;

      const timeseries = await prisma.$queryRaw<any[]>`
        SELECT
          DATE_TRUNC('day', to_timestamp("sent_at" / 1000.0)) as "date",
          COUNT(*)::int as "emailsSent"
        FROM "service_emails"
        WHERE "sent_by" = ${telecallerId}
        GROUP BY DATE_TRUNC('day', to_timestamp("sent_at" / 1000.0))
        ORDER BY "date" ASC
      `;

      res.json({
        success: true,
        data: timeseries,
      });
    } catch (error: any) {
      logger.error('Error fetching email timeseries:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch email timeseries analytics',
      });
    }
  },
};
