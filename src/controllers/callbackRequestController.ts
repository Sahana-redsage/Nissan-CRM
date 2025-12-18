import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const callbackRequestController = {
    async createCallbackRequest(req: AuthRequest, res: Response) {
        try {
            const { customerId, serviceCenterId } = req.body;

            const callbackRequest = await prisma.callbackRequest.create({
                data: {
                    customerId,
                    serviceCenterId,
                    status: 'pending',
                    requestedAt: new Date()
                }
            });

            res.status(201).json({
                success: true,
                data: callbackRequest
            });
        } catch (error: any) {
            logger.error('Error creating callback request:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create callback request'
            });
        }
    },

    async getAllCallbackRequests(req: AuthRequest, res: Response) {
        try {
            const { status } = req.query;
            const where: any = {};

            if (status) {
                where.status = status as string;
            }

            const requests = await prisma.callbackRequest.findMany({
                where,
                include: {
                    customer: {
                        select: {
                            customerName: true,
                            phone: true,
                            vehicleNumber: true
                        }
                    },
                    serviceCenter: true
                },
                orderBy: {
                    requestedAt: 'desc'
                }
            });

            res.json({
                success: true,
                data: requests
            });
        } catch (error: any) {
            logger.error('Error fetching callback requests:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch callback requests'
            });
        }
    },

    async getCustomerCallbackRequests(req: AuthRequest, res: Response) {
        try {
            // Allow finding by customerId param (from route /customers/:customerId/callback-requests)
            // or from authenticated user if we were validting that, but here it's CRM access.
            const customerId = parseInt(req.params.customerId || req.params.id);

            const requests = await prisma.callbackRequest.findMany({
                where: { customerId },
                include: {
                    serviceCenter: true
                },
                orderBy: {
                    requestedAt: 'desc'
                }
            });

            res.json({
                success: true,
                data: requests
            });
        } catch (error: any) {
            logger.error('Error fetching customer callback requests:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch customer callback requests'
            });
        }
    },

    async updateCallbackRequestStatus(req: AuthRequest, res: Response) {
        try {
            const id = parseInt(req.params.id);
            const { status } = req.body;

            const request = await prisma.callbackRequest.update({
                where: { id },
                data: {
                    status
                }
            });

            res.json({
                success: true,
                data: request
            });
        } catch (error: any) {
            logger.error('Error updating callback request:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update callback request'
            });
        }
    }
};
