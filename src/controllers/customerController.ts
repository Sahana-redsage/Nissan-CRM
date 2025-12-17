import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const customerController = {
  async getDueForService(req: AuthRequest, res: Response) {
    try {
      const days = parseInt(req.query.days as string) || 7;

      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const customers = await prisma.customer.findMany({
        where: {
          nextServiceDueDate: {
            gte: today,
            lte: futureDate,
          },
        },
        orderBy: {
          nextServiceDueDate: 'asc',
        },
      });

      const customersWithDays = customers.map((customer) => {
        const daysUntilDue = Math.ceil(
          (customer.nextServiceDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          ...customer,
          daysUntilDue,
        };
      });

      res.json({
        success: true,
        data: customersWithDays,
        count: customersWithDays.length,
      });
    } catch (error: any) {
      logger.error('Error fetching customers due for service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch customers',
      });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const customerId = parseInt(req.params.id);

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          serviceDocuments: {
            orderBy: { uploadedAt: 'desc' },
          },
          serviceInsights: {
            orderBy: { generatedAt: 'desc' },
            take: 1,
          },
          callLogs: {
            orderBy: { callDate: 'desc' },
            take: 5,
            include: {
              telecaller: {
                select: {
                  fullName: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
      }

      res.json({
        success: true,
        data: {
          ...customer,
          documents: customer.serviceDocuments,
          latestInsights: customer.serviceInsights[0] || null,
          recentCalls: customer.callLogs,
          insightId: customer.serviceInsights[0]?.id || null,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching customer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch customer',
      });
    }
  },

  async getById2(req: AuthRequest, res: Response) {
    try {
      const customerId = parseInt(req.params.id);

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          serviceDocuments: {
            orderBy: { uploadedAt: 'desc' },
          },
          serviceInsights: {
            orderBy: { generatedAt: 'desc' },
            take: 1,
          },
          callLogs: {
            orderBy: { callDate: 'desc' },
            take: 5,
            include: {
              telecaller: {
                select: {
                  fullName: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
      }

      res.json({
        success: true,
        data: {
          ...customer,
          documents: customer.serviceDocuments,
          latestInsights: customer.serviceInsights[0] || null,
          recentCalls: customer.callLogs,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching customer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch customer',
      });
    }
  },

};


