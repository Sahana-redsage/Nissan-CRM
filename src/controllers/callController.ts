import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const callController = {
  async log(req: AuthRequest, res: Response) {
    try {
      const {
        customerId,
        callStatus,
        callDuration,
        notes,
        followUpRequired,
        followUpDate,
        serviceBooked,
        bookingDate,
      } = req.body;

      if (!customerId || !callStatus) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID and call status are required',
        });
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
      }

      const callLog = await prisma.callLog.create({
        data: {
          customerId,
          telecallerId: req.telecaller!.id,
          callStatus,
          callDuration: callDuration || null,
          notes: notes || null,
          followUpRequired: followUpRequired || false,
          followUpDate: followUpDate ? new Date(followUpDate) : null,
          serviceBooked: serviceBooked || false,
          bookingDate: bookingDate ? new Date(bookingDate) : null,
        },
      });

      res.json({
        success: true,
        data: callLog,
      });
    } catch (error: any) {
      logger.error('Error logging call:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to log call',
      });
    }
  },

  async getByCustomerId(req: AuthRequest, res: Response) {
    try {
      const customerId = parseInt(req.params.customerId);

      const callLogs = await prisma.callLog.findMany({
        where: { customerId },
        orderBy: { callDate: 'desc' },
        include: {
          telecaller: {
            select: {
              fullName: true,
              username: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: callLogs,
      });
    } catch (error: any) {
      logger.error('Error fetching call logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch call logs',
      });
    }
  },
};
