import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { llmService } from '../services/llmService';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import twilio from 'twilio';

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

export const smsController = {
    async sendInsightSummary(req: AuthRequest, res: Response) {
        try {
            const { customerId, insightId } = req.body;

            console.log('entered')

            if (!customerId) {
                return res.status(400).json({ success: false, message: 'Customer ID is required' });
            }

            const result = await smsController.processSingleSms(customerId, insightId, req.telecaller?.id);

            if (!result.success) {
                return res.status(result.errorStatus || 500).json({ success: false, message: result.message });
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error: any) {
            logger.error('Error sending SMS:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to send SMS' });
        }
    },

    async sendBulkInsightSummary(req: AuthRequest, res: Response) {
        try {
            const { recipients } = req.body;
            // recipients expected to be: [{ customerId: 1, insightId: 2 }, ...]

            if (!Array.isArray(recipients) || recipients.length === 0) {
                return res.status(400).json({ success: false, message: 'Recipients array is required and cannot be empty' });
            }

            logger.info(`Starting bulk SMS send for ${recipients.length} recipients`);

            const results = await Promise.all(recipients.map(async (recipient) => {
                const { customerId, insightId } = recipient;
                try {
                    const result = await smsController.processSingleSms(customerId, insightId, req.telecaller?.id);
                    return {
                        customerId,
                        insightId,
                        success: result.success,
                        message: result.message,
                        data: result.data
                    };
                } catch (err: any) {
                    return {
                        customerId,
                        insightId,
                        success: false,
                        message: err.message || 'Unknown error'
                    };
                }
            }));

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            res.json({
                success: true,
                data: {
                    total: recipients.length,
                    successful,
                    failed,
                    results
                }
            });

        } catch (error: any) {
            logger.error('Error sending bulk SMS:', error);
            res.status(500).json({ success: false, message: error.message || 'Failed to process bulk SMS' });
        }
    },

    // Helper function to process a single SMS
    async processSingleSms(customerId: number, insightId: number | undefined, telecallerId: number | undefined) {
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            return { success: false, message: 'Customer not found', errorStatus: 404 };
        }

        const phone = customer.phone || customer.alternatePhone;

        if (!phone) {
            return { success: false, message: 'Customer phone number not available', errorStatus: 400 };
        }

        let insight;
        if (insightId) {
            insight = await prisma.serviceInsight.findUnique({ where: { id: insightId } });
        } else {
            insight = await prisma.serviceInsight.findFirst({
                where: { customerId },
                orderBy: { generatedAt: 'desc' },
            });
        }

        if (!insight) {
            return { success: false, message: 'No insights found for customer', errorStatus: 404 };
        }

        const vehicleData = {
            vehicleMake: customer.vehicleMake,
            vehicleModel: customer.vehicleModel,
            vehicleYear: customer.vehicleYear || undefined,
            totalMileage: customer.totalMileage,
        };

        // Generate Unique Tracking Link
        const trackingRef = `sms_${Date.now()}_${customerId}`;
        const uiLink = `https://nissancall-fe.vercel.app/customer-view/${customerId}?source=sms&ref=${trackingRef}`;

        const baseMessage = await llmService.generateWhatsappSummary(
            vehicleData,
            insight.insightsJson as any,
            customer.customerName || 'Customer'
        );

        // Append Call to Action and Link manually
        const personalizedMessage = baseMessage + `\n\nBook here: ${uiLink}\n\nYour Service Advisor`;

        console.log(personalizedMessage);

        logger.info(`Sending SMS to ${phone}: ${personalizedMessage}`);

        const message = await twilioClient.messages.create({
            body: personalizedMessage,
            from: config.twilio.phoneNumber,
            to: phone,
            riskCheck: 'disable' // Bypass automated fraud detection for testing
        } as any);

        await prisma.smsMessage.create({
            data: {
                customerId: customer.id,
                insightId: insight.id,
                telecallerId: telecallerId,
                messageSid: message.sid,
                messageBody: personalizedMessage,
                status: message.status,
                sentAt: new Date(),
            },
        });

        return {
            success: true,
            data: {
                message: personalizedMessage,
                to: phone,
                status: message.status,
                messageSid: message.sid
            }
        };
    },

    async webhook(req: AuthRequest, res: Response) {
        try {
            const { MessageSid, MessageStatus } = req.body;

            logger.info('Received SMS webhook:', req.body);

            if (MessageSid && MessageStatus) {
                const updateData: any = { status: MessageStatus };

                // Map Twilio statuses to our simplified status flow if needed
                // For now storing raw status (sent, delivered, undelivered, failed, etc.)

                await prisma.smsMessage.update({
                    where: { messageSid: MessageSid },
                    data: updateData,
                });
            }

            res.status(200).send('<Response></Response>');
        } catch (error) {
            logger.error('SMS Webhook error:', error);
            res.status(500).send('Error');
        }
    },

    async getLogsByCustomer(req: AuthRequest, res: Response) {
        try {
            const customerId = parseInt(req.params.customerId);

            console.log(`[DEBUG] getLogsByCustomer called for ID: ${req.params.customerId}, parsed: ${customerId}`);

            if (isNaN(customerId)) {
                return res.status(400).json({ success: false, message: 'Invalid customer ID' });
            }

            const logs = await prisma.smsMessage.findMany({
                where: { customerId },
                orderBy: { sentAt: 'desc' },
                include: {
                    telecaller: {
                        select: {
                            fullName: true,
                            username: true,
                        },
                    },
                },
            });

            console.log(`[DEBUG] Found ${logs.length} SMS logs for customer ${customerId}`);

            res.json({
                success: true,
                data: logs,
            });
        } catch (error: any) {
            logger.error('Error fetching SMS logs:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch SMS logs' });
        }
    },

    async getAnalytics(req: AuthRequest, res: Response) {
        try {
            const totalSent = await prisma.smsMessage.count();
            const totalDelivered = await prisma.smsMessage.count({
                where: { status: 'delivered' },
            });

            const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(2) : 0;

            const recentMessages = await prisma.smsMessage.findMany({
                take: 10,
                orderBy: { sentAt: 'desc' },
                include: {
                    customer: {
                        select: { customerName: true, phone: true }
                    }
                }
            });

            res.json({
                success: true,
                data: {
                    totalSent,
                    totalDelivered,
                    deliveryRate: `${deliveryRate}%`,
                    recentMessages
                },
            });
        } catch (error: any) {
            logger.error('SMS Analytics error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch SMS analytics' });
        }
    }
};
