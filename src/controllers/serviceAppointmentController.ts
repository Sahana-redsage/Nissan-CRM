import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const serviceAppointmentController = {
    async createAppointment(req: AuthRequest, res: Response) {
        try {
            const {
                customerId,
                serviceCenterId,
                slot,
                reason,
                serviceType,
                odometer,
                isPreferred
            } = req.body;

            // Use a transaction to create appointment and update customer preference
            const result = await prisma.$transaction(async (tx) => {
                // Create the appointment
                const appointment = await tx.serviceAppointment.create({
                    data: {
                        customerId,
                        serviceCenterId,
                        slot: new Date(slot),
                        reason,
                        serviceType,
                        odometer,
                        isPreferred,
                        status: 'booked' // Initial status
                    }
                });

                // If this is a preferred service center, update the customer record
                if (isPreferred) {
                    await tx.customer.update({
                        where: { id: customerId },
                        data: {
                            prefServiceCenter: serviceCenterId
                        }
                    });
                }

                return appointment;
            });

            res.status(201).json({
                success: true,
                data: result
            });
        } catch (error: any) {
            logger.error('Error creating service appointment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create appointment'
            });
        }
    },

    async getAppointmentById(req: AuthRequest, res: Response) {
        try {
            const appointmentId = parseInt(req.params.id);

            const appointment = await prisma.serviceAppointment.findUnique({
                where: { id: appointmentId },
                include: {
                    customer: {
                        select: {
                            customerName: true,
                            phone: true,
                            vehicleNumber: true
                        }
                    },
                    serviceCenter: true
                }
            });

            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    message: 'Appointment not found'
                });
            }

            res.json({
                success: true,
                data: appointment
            });
        } catch (error: any) {
            logger.error('Error fetching appointment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch appointment'
            });
        }
    },

    async updateAppointment(req: AuthRequest, res: Response) {
        try {
            const appointmentId = parseInt(req.params.id);
            const { serviceType, reason, odometer, status } = req.body;

            const appointment = await prisma.serviceAppointment.update({
                where: { id: appointmentId },
                data: {
                    serviceType,
                    reason,
                    odometer,
                    status
                }
            });

            res.json({
                success: true,
                data: appointment
            });
        } catch (error: any) {
            logger.error('Error updating appointment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update appointment'
            });
        }
    },

    async rescheduleAppointment(req: AuthRequest, res: Response) {
        try {
            const appointmentId = parseInt(req.params.id);
            const { slot } = req.body;

            // Note: User said "for rescheduling appoingmrnts, we will just use the update endpoint"
            // But they also listed "PUT /api/service-appointments/{appointment_id}/reschedule"
            // I'll implement this as a specific endpoint for clarity, but it essentially does an update.

            const appointment = await prisma.serviceAppointment.update({
                where: { id: appointmentId },
                data: {
                    slot: new Date(slot)
                }
            });

            res.json({
                success: true,
                data: appointment
            });
        } catch (error: any) {
            logger.error('Error rescheduling appointment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reschedule appointment'
            });
        }
    },

    async cancelAppointment(req: AuthRequest, res: Response) {
        try {
            const appointmentId = parseInt(req.params.id);

            const appointment = await prisma.serviceAppointment.update({
                where: { id: appointmentId },
                data: {
                    isCancelled: true,
                    status: 'cancelled'
                }
            });

            res.json({
                success: true,
                data: appointment
            });
        } catch (error: any) {
            logger.error('Error cancelling appointment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to cancel appointment'
            });
        }
    },

    async getCustomerAppointments(req: AuthRequest, res: Response) {
        try {
            const customerId = parseInt(req.params.customerId || req.params.id);

            const appointments = await prisma.serviceAppointment.findMany({
                where: { customerId },
                include: {
                    serviceCenter: true
                },
                orderBy: {
                    slot: 'desc'
                }
            });

            res.json({
                success: true,
                data: appointments
            });
        } catch (error: any) {
            logger.error('Error fetching customer appointments:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch customer appointments'
            });
        }
    }
};
