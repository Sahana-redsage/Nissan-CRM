import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const customerController = {

  async getAll(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const where: any = {};

      if (startDate || endDate) {
        where.nextServiceDueDate = {};
        if (startDate) {
          const start = new Date(startDate as string);
          if (!isNaN(start.getTime())) {
            where.nextServiceDueDate.gte = start;
          }
        }
        if (endDate) {
          const end = new Date(endDate as string);
          if (!isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            where.nextServiceDueDate.lte = end;
          }
        }
      }

      const customers = await prisma.customer.findMany({
        where,
        orderBy: {
          customerName: 'asc',
        },
      });

      const today = new Date();
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
      logger.error('Error fetching all customers:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch all customers',
      });
    }
  },

  async getServiceAnalytics(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const where: any = {};

      if (startDate || endDate) {
        where.nextServiceDueDate = {};
        if (startDate) {
          const start = new Date(startDate as string);
          if (!isNaN(start.getTime())) {
            where.nextServiceDueDate.gte = start;
          }
        }
        if (endDate) {
          const end = new Date(endDate as string);
          if (!isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            where.nextServiceDueDate.lte = end;
          }
        }
      }

      const customers = await prisma.customer.findMany({
        where,
        include: {
          callLogs: {
            orderBy: { callDate: 'desc' },
            take: 1,
            include: { telecaller: { select: { fullName: true } } }
          },
          smsMessages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            include: { telecaller: { select: { fullName: true } } }
          },
          serviceEmails: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            include: { sender: { select: { fullName: true } } }
          },
          appointments: {
            orderBy: { slot: 'desc' },
            take: 1,
            select: {
              id: true,
              slot: true,
              status: true,
              createdAt: true
            }
          }
        },
        orderBy: {
          nextServiceDueDate: 'asc'
        }
      });

      let totalContacted = 0;
      let totalBooked = 0;

      const results = customers.map(customer => {
        const latestCall = customer.callLogs[0];
        const latestSms = customer.smsMessages[0];
        const latestEmail = customer.serviceEmails[0];
        const latestAppointment = customer.appointments[0];

        const isContacted = !!(latestCall || latestSms || latestEmail);
        const isBooked = !!latestAppointment;

        if (isContacted) {
          totalContacted++;
          if (isBooked) totalBooked++;
        }

        return {
          id: customer.id,
          customerName: customer.customerName,
          phone: customer.phone,
          vehicleNumber: customer.vehicleNumber,
          nextServiceDueDate: customer.nextServiceDueDate,
          lastContact: {
            call: latestCall ? {
              when: latestCall.callDate,
              by: latestCall.telecaller.fullName,
              status: latestCall.callStatus
            } : null,
            sms: latestSms ? {
              when: latestSms.sentAt,
              by: latestSms.telecaller?.fullName || 'System',
              status: latestSms.status
            } : null,
            email: latestEmail ? {
              when: new Date(latestEmail.sentAt * 1000),
              by: latestEmail.sender.fullName,
              status: latestEmail.seenAt ? 'seen' : 'sent'
            } : null
          },
          isContacted,
          appointment: latestAppointment ? {
            id: latestAppointment.id,
            slot: latestAppointment.slot,
            status: latestAppointment.status,
            bookedAt: latestAppointment.createdAt
          } : null,
          isBooked
        };
      });

      res.json({
        success: true,
        summary: {
          totalDue: customers.length,
          totalContacted,
          totalBooked,
          conversionRate: totalContacted > 0 ? (totalBooked / totalContacted * 100).toFixed(2) : 0
        },
        data: results
      });
    } catch (error: any) {
      logger.error('Error fetching service analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics'
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

      const recentCalls = customer.callLogs.map(log => ({
        ...log,
        recordingUrl: log.recordingSid ? `/api/calls/recordings/${log.recordingSid}/play` : log.recordingUrl
      }));

      res.json({
        success: true,
        data: {
          ...customer,
          documents: customer.serviceDocuments,
          latestInsights: customer.serviceInsights[0] || null,
          recentCalls: recentCalls,
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

      const recentCalls = customer.callLogs.map(log => ({
        ...log,
        recordingUrl: log.recordingSid ? `/api/calls/recordings/${log.recordingSid}/play` : log.recordingUrl
      }));

      res.json({
        success: true,
        data: {
          ...customer,
          documents: customer.serviceDocuments,
          latestInsights: customer.serviceInsights[0] || null,
          recentCalls: recentCalls,
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

  async create(req: AuthRequest, res: Response) {
    try {
      const {
        customerName,
        email,
        phone,
        alternatePhone,
        address,
        city,
        state,
        pincode,
        vehicleNumber,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        purchaseDate,
        lastServiceDate,
        nextServiceDueDate,
        totalMileage,
        prefServiceCenter,
        vinNumber
      } = req.body;

      // Basic validation
      if (!customerName || !phone || !vehicleNumber || !vehicleMake || !vehicleModel || !nextServiceDueDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
      }

      const customer = await prisma.customer.create({
        data: {
          customerName,
          email,
          phone,
          alternatePhone,
          address,
          city,
          state,
          pincode,
          vehicleNumber,
          vehicleMake,
          vehicleModel,
          vehicleYear: vehicleYear ? parseInt(vehicleYear.toString()) : null,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
          lastServiceDate: lastServiceDate ? new Date(lastServiceDate) : null,
          nextServiceDueDate: new Date(nextServiceDueDate),
          totalMileage: totalMileage ? parseInt(totalMileage.toString()) : 0,
          prefServiceCenter: prefServiceCenter ? parseInt(prefServiceCenter.toString()) : null,
          vinNumber: vinNumber || null,
        },
      });

      res.status(201).json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        if (target && Array.isArray(target) && target.includes('vin_number')) {
          return res.status(400).json({
            success: false,
            message: 'A customer with this VIN number already exists',
          });
        }
        return res.status(400).json({
          success: false,
          message: 'A customer with this vehicle number already exists',
        });
      }
      logger.error('Error creating customer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create customer',
      });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const customerId = parseInt(req.params.id);
      const {
        customerName,
        email,
        phone,
        alternatePhone,
        address,
        city,
        state,
        pincode,
        vehicleNumber,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        purchaseDate,
        lastServiceDate,
        nextServiceDueDate,
        totalMileage,
        prefServiceCenter,
        vinNumber
      } = req.body;

      // Check if customer exists
      const existingCustomer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!existingCustomer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          customerName,
          email,
          phone,
          alternatePhone,
          address,
          city,
          state,
          pincode,
          vehicleNumber,
          vehicleMake,
          vehicleModel,
          vehicleYear: vehicleYear ? parseInt(vehicleYear.toString()) : undefined,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          lastServiceDate: lastServiceDate ? new Date(lastServiceDate) : undefined,
          nextServiceDueDate: nextServiceDueDate ? new Date(nextServiceDueDate) : undefined,
          totalMileage: totalMileage ? parseInt(totalMileage.toString()) : undefined,
          prefServiceCenter: prefServiceCenter ? parseInt(prefServiceCenter.toString()) : undefined,
          vinNumber,
        },
      });

      res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        if (target && Array.isArray(target) && target.includes('vin_number')) {
          return res.status(400).json({
            success: false,
            message: 'A customer with this VIN number already exists',
          });
        }
        return res.status(400).json({
          success: false,
          message: 'A customer with this vehicle number already exists',
        });
      }
      logger.error('Error updating customer:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update customer',
      });
    }
  },

};
