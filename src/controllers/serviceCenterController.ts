import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const serviceCenterController = {
    async getAllServiceCenters(req: AuthRequest, res: Response) {
        try {
            const centers = await prisma.serviceCenter.findMany({
                orderBy: { name: 'asc' }
            });

            res.json({
                success: true,
                data: centers
            });
        } catch (error: any) {
            logger.error('Error fetching service centers:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch service centers'
            });
        }
    },

    async getServiceCenterById(req: AuthRequest, res: Response) {
        try {
            const centerId = parseInt(req.params.id);

            const center = await prisma.serviceCenter.findUnique({
                where: { id: centerId }
            });

            if (!center) {
                return res.status(404).json({
                    success: false,
                    message: 'Service center not found'
                });
            }

            res.json({
                success: true,
                data: center
            });
        } catch (error: any) {
            logger.error('Error fetching service center:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch service center'
            });
        }
    },

    async getServiceCenterAppointments(req: AuthRequest, res: Response) {
        try {
            const centerId = parseInt(req.params.id);
            const date = req.query.date as string;

            const whereClause: any = {
                serviceCenterId: centerId
            };

            if (date) {
                const queryDate = new Date(date);
                const nextDate = new Date(queryDate);
                nextDate.setDate(queryDate.getDate() + 1);

                whereClause.slot = {
                    gte: queryDate,
                    lt: nextDate
                };
            }

            const appointments = await prisma.serviceAppointment.findMany({
                where: whereClause,
                include: {
                    customer: {
                        select: {
                            customerName: true,
                            phone: true,
                            vehicleNumber: true,
                            vehicleModel: true
                        }
                    }
                },
                orderBy: {
                    slot: 'asc'
                }
            });

            res.json({
                success: true,
                data: appointments
            });

        } catch (error: any) {
            logger.error('Error fetching service center appointments:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch appointments'
            });
        }
    }
};
