import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { config } from '../config/env';

// Configure clients
const transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    },
});

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

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

            // Send notification asynchronously
            sendAppointmentNotification('create', result.id).catch((err: any) =>
                logger.error('Failed to send appointment creation notification:', err)
            );

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

            // Send notification asynchronously
            sendAppointmentNotification('update', appointment.id).catch((err: any) =>
                logger.error('Failed to send appointment update notification:', err)
            );

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

            // Send notification asynchronously
            sendAppointmentNotification('reschedule', appointment.id).catch((err: any) =>
                logger.error('Failed to send appointment reschedule notification:', err)
            );

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

            // Send notification asynchronously
            sendAppointmentNotification('cancel', appointment.id).catch((err: any) =>
                logger.error('Failed to send appointment cancellation notification:', err)
            );

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

// Helper function to send notifications
async function sendAppointmentNotification(
    type: 'create' | 'update' | 'reschedule' | 'cancel',
    appointmentId: number
) {
    // Fetch full appointment details
    const appointment = await prisma.serviceAppointment.findUnique({
        where: { id: appointmentId },
        include: {
            customer: true,
            serviceCenter: true
        }
    });

    if (!appointment || !appointment.customer || !appointment.serviceCenter) {
        logger.warn(`Could not fetch details for appointment ${appointmentId} notification`);
        return;
    }

    const { customer, serviceCenter, slot, serviceType } = appointment;
    const formattedDate = new Date(slot).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Generate Dashboard Link
    const linkRef = `appt_${type}_${Date.now()}_${customer.id}`;
    const dashboardUrl = `https://nissancall-fe.vercel.app/customer-view/${customer.id}?source=email&ref=${linkRef}`;
    const smsUrl = `https://nissancall-fe.vercel.app/customer-view/${customer.id}?source=sms&ref=${linkRef}`;

    // Construct Message Content
    let subject = '';
    let emailBody = '';
    let smsBody = '';

    const centerDetails = `
        <strong>${serviceCenter.name}</strong><br>
        ${serviceCenter.address || ''}<br>
        Phone: ${serviceCenter.phoneNo || 'N/A'}<br>
        ${serviceCenter.mapsLink ? `<a href="${serviceCenter.mapsLink}">View on Map</a>` : ''}
    `;

    const commonStyles = `
        font-family: Arial, sans-serif; 
        color: #333; 
        line-height: 1.6;
        max-width: 600px;
        margin: 0 auto;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
    `;

    const headerStyle = `
        background-color: #C3002F; 
        color: white; 
        padding: 20px; 
        text-align: center;
    `;

    const contentStyle = `padding: 20px;`;

    const footerStyle = `
        background-color: #f5f5f5; 
        padding: 15px; 
        text-align: center; 
        font-size: 12px; 
        color: #666;
    `;

    const linkHtml = `
        <br>
        <p style="text-align: center;">
            <a href="${dashboardUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #C3002F; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                View Appointment Dashboard
            </a>
        </p>
        <p style="text-align: center; font-size: 12px; color: #666;">
            Or visit: <a href="${dashboardUrl}" style="color: #666;">${dashboardUrl}</a>
        </p>
    `;

    switch (type) {
        case 'create':
            subject = 'Nissan Service Appointment Confirmed';
            emailBody = `
                <div style="${commonStyles}">
                    <div style="${headerStyle}">
                        <h2 style="margin:0;">Appointment Confirmed</h2>
                    </div>
                    <div style="${contentStyle}">
                        <p>Dear ${customer.customerName},</p>
                        <p>Your service appointment has been successfully booked. We look forward to seeing you.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
                            <h3 style="margin-top:0; color: #C3002F;">Appointment Details</h3>
                            <p><strong>Date & Time:</strong> ${formattedDate}</p>
                            <p><strong>Service Type:</strong> ${serviceType || 'General Service'}</p>
                            <p><strong>Vehicle:</strong> ${customer.vehicleMake} ${customer.vehicleModel} (${customer.vehicleNumber})</p>
                            
                            <h3 style="margin-bottom:5px; color: #C3002F;">Service Center</h3>
                            ${centerDetails}
                        </div>
                        
                        ${linkHtml}
                        
                        <p>If you need to reschedule or cancel, please contact us or visit your dashboard.</p>
                    </div>
                    <div style="${footerStyle}">
                        &copy; ${new Date().getFullYear()} Nissan Service. All rights reserved.
                    </div>
                </div>
            `;
            smsBody = `Nissan Service: Appointment Confirmed!\nDate: ${formattedDate}\nCenter: ${serviceCenter.name}\nLoc: ${serviceCenter.mapsLink || serviceCenter.address}\n\nView details: ${smsUrl}`;
            break;

        case 'update':
            subject = 'Nissan Service Appointment Updated';
            emailBody = `
                <div style="${commonStyles}">
                    <div style="${headerStyle}">
                        <h2 style="margin:0;">Appointment Updated</h2>
                    </div>
                    <div style="${contentStyle}">
                        <p>Dear ${customer.customerName},</p>
                        <p>Your service appointment details have been updated.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
                            <h3 style="margin-top:0; color: #C3002F;">Updated Details</h3>
                            <p><strong>Date & Time:</strong> ${formattedDate}</p>
                            <p><strong>Service Type:</strong> ${serviceType || 'General Service'}</p>
                            <p><strong>Status:</strong> ${appointment.status}</p>
                            
                            <h3 style="margin-bottom:5px; color: #C3002F;">Service Center</h3>
                            ${centerDetails}
                        </div>

                        ${linkHtml}
                    </div>
                    <div style="${footerStyle}">
                        &copy; ${new Date().getFullYear()} Nissan Service. All rights reserved.
                    </div>
                </div>
            `;
            smsBody = `Nissan Service: Appointment Updated.\nNew Details: ${formattedDate}\nCenter: ${serviceCenter.name}\n\nView details: ${smsUrl}`;
            break;

        case 'reschedule':
            subject = 'Nissan Service Appointment Rescheduled';
            emailBody = `
                <div style="${commonStyles}">
                    <div style="${headerStyle}">
                        <h2 style="margin:0;">Appointment Rescheduled</h2>
                    </div>
                    <div style="${contentStyle}">
                        <p>Dear ${customer.customerName},</p>
                        <p>Your service appointment has been rescheduled to a new time.</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
                            <h3 style="margin-top:0; color: #C3002F;">New Time</h3>
                            <p><strong>Date & Time:</strong> ${formattedDate}</p>
                            
                            <h3 style="margin-bottom:5px; color: #C3002F;">Service Center</h3>
                            ${centerDetails}
                        </div>

                        ${linkHtml}
                    </div>
                    <div style="${footerStyle}">
                        &copy; ${new Date().getFullYear()} Nissan Service. All rights reserved.
                    </div>
                </div>
            `;
            smsBody = `Nissan Service: Appointment Rescheduled.\nNew Time: ${formattedDate}\nCenter: ${serviceCenter.name}\nLoc: ${serviceCenter.mapsLink || serviceCenter.address}\n\nView details: ${smsUrl}`;
            break;

        case 'cancel':
            subject = 'Nissan Service Appointment Cancelled';
            emailBody = `
                <div style="${commonStyles}">
                    <div style="${headerStyle}">
                        <h2 style="margin:0;">Appointment Cancelled</h2>
                    </div>
                    <div style="${contentStyle}">
                        <p>Dear ${customer.customerName},</p>
                        <p>Your service appointment for <strong>${formattedDate}</strong> at <strong>${serviceCenter.name}</strong> has been cancelled.</p>
                        <p>If this was a mistake or you'd like to book a new appointment, please visit our website or contact support.</p>
                        
                        ${linkHtml}
                    </div>
                    <div style="${footerStyle}">
                        &copy; ${new Date().getFullYear()} Nissan Service. All rights reserved.
                    </div>
                </div>
            `;
            smsBody = `Nissan Service: Appointment Cancelled.\nRef: ${formattedDate} at ${serviceCenter.name}.\n\nRebook here: ${smsUrl}`;
            break;
    }

    // Send Email
    if (customer.email) {
        try {
            await transporter.sendMail({
                from: `"${config.email.fromName}" <${config.email.user}>`,
                to: customer.email,
                subject,
                html: emailBody
            });
            logger.info(`Appointment notification email sent to ${customer.email}`);
        } catch (error) {
            logger.error(`Failed to send email to ${customer.email}:`, error);
        }
    }

    // Send SMS
    const phone = customer.phone || customer.alternatePhone;
    if (phone) {
        try {
            logger.info(`Attempting to send SMS to ${phone} for appointment ${appointmentId}`);

            // Validate and format phone number
            let formattedPhone = phone.trim();
            // Assuming Indian numbers if 10 digits provided without code. Adjust logic as per region requirements.
            if (/^\d{10}$/.test(formattedPhone)) {
                formattedPhone = `+91${formattedPhone}`;
            }

            const message = await twilioClient.messages.create({
                body: smsBody,
                from: config.twilio.phoneNumber,
                to: formattedPhone,
                riskCheck: 'disable'
            } as any);
            logger.info(`Appointment notification SMS sent to ${formattedPhone}. SID: ${message.sid}`);
        } catch (error) {
            logger.error(`Failed to send SMS to ${phone}:`, error);
        }
    }
}
