import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const sourceMetricsController = {
    /**
     * Track link open by source
     * This endpoint is called when a customer opens a link from email or SMS
     * It ensures each customer+source combination is counted only once
     */
    async trackLinkOpen(req: AuthRequest, res: Response) {
        try {
            const customerId = parseInt(req.params.customerId);
            const source = req.query.source as string;

            // Validate customerId
            if (isNaN(customerId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid customer ID',
                });
            }

            // Validate source
            if (!source || !['email', 'sms'].includes(source.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid source. Must be "email" or "sms"',
                });
            }

            // Check if customer exists
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
            });

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found',
                });
            }

            // Use upsert to handle both insert and update cases
            // This ensures we only count unique customer+source combinations
            const sourceMetric = await prisma.sourceMetric.upsert({
                where: {
                    customerId_source: {
                        customerId,
                        source: source.toLowerCase(),
                    },
                },
                update: {
                    openCount: {
                        increment: 1,
                    },
                    lastOpenedAt: new Date(),
                },
                create: {
                    customerId,
                    source: source.toLowerCase(),
                    openCount: 1,
                },
            });

            logger.info(
                `Link opened by customer ${customerId} from source ${source}. Total opens: ${sourceMetric.openCount}`
            );

            res.json({
                success: true,
                message: 'Link open tracked successfully',
                data: {
                    customerId,
                    source: sourceMetric.source,
                    firstOpenedAt: sourceMetric.firstOpenedAt,
                    lastOpenedAt: sourceMetric.lastOpenedAt,
                    openCount: sourceMetric.openCount,
                },
            });
        } catch (error: any) {
            logger.error('Error tracking link open:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to track link open',
            });
        }
    },

    /**
     * Get comprehensive source metrics analytics
     * Returns detailed statistics about link opens by source including:
     * - Total sent (emails/SMS)
     * - Customers who opened (read)
     * - Customers who didn't open (not seen)
     * - Percentages and rates
     */
    async getAnalytics(req: AuthRequest, res: Response) {
        try {
            // Get total emails sent and unique customers who received emails
            const [emailStats] = await prisma.$queryRaw<any[]>`
                SELECT 
                    COUNT(*)::int as "totalSent",
                    COUNT(DISTINCT "customer_id")::int as "uniqueCustomersSent"
                FROM "service_emails"
            `;

            // Get total SMS sent and unique customers who received SMS
            const [smsStats] = await prisma.$queryRaw<any[]>`
                SELECT 
                    COUNT(*)::int as "totalSent",
                    COUNT(DISTINCT "customer_id")::int as "uniqueCustomersSent"
                FROM "sms_messages"
            `;

            // Get customers who opened links by source
            const emailOpens = await prisma.sourceMetric.findMany({
                where: { source: 'email' },
                select: { customerId: true, openCount: true },
            });

            const smsOpens = await prisma.sourceMetric.findMany({
                where: { source: 'sms' },
                select: { customerId: true, openCount: true },
            });

            // Calculate email metrics
            const emailTotalSent = emailStats?.totalSent || 0;
            const emailUniqueCustomersSent = emailStats?.uniqueCustomersSent || 0;
            const emailCustomersOpened = emailOpens.length;
            const emailCustomersNotOpened = emailUniqueCustomersSent - emailCustomersOpened;
            const emailTotalOpens = emailOpens.reduce((sum: number, item: any) => sum + item.openCount, 0);
            const emailOpenRate = emailUniqueCustomersSent > 0
                ? ((emailCustomersOpened / emailUniqueCustomersSent) * 100).toFixed(2)
                : '0.00';
            const emailNotOpenedRate = emailUniqueCustomersSent > 0
                ? ((emailCustomersNotOpened / emailUniqueCustomersSent) * 100).toFixed(2)
                : '0.00';

            // Calculate SMS metrics
            const smsTotalSent = smsStats?.totalSent || 0;
            const smsUniqueCustomersSent = smsStats?.uniqueCustomersSent || 0;
            const smsCustomersOpened = smsOpens.length;
            const smsCustomersNotOpened = smsUniqueCustomersSent - smsCustomersOpened;
            const smsTotalOpens = smsOpens.reduce((sum: number, item: any) => sum + item.openCount, 0);
            const smsOpenRate = smsUniqueCustomersSent > 0
                ? ((smsCustomersOpened / smsUniqueCustomersSent) * 100).toFixed(2)
                : '0.00';
            const smsNotOpenedRate = smsUniqueCustomersSent > 0
                ? ((smsCustomersNotOpened / smsUniqueCustomersSent) * 100).toFixed(2)
                : '0.00';

            // Get recent opens
            const recentOpens = await prisma.sourceMetric.findMany({
                take: 10,
                orderBy: { lastOpenedAt: 'desc' },
                include: {
                    customer: {
                        select: {
                            customerName: true,
                            vehicleNumber: true,
                            email: true,
                            phone: true,
                        },
                    },
                },
            });

            res.json({
                success: true,
                data: {
                    email: {
                        totalMessagesSent: emailTotalSent,
                        uniqueCustomersSent: emailUniqueCustomersSent,
                        customersOpened: emailCustomersOpened,
                        customersNotOpened: emailCustomersNotOpened,
                        totalOpens: emailTotalOpens,
                        openRate: `${emailOpenRate}%`,
                        notOpenedRate: `${emailNotOpenedRate}%`,
                        metrics: {
                            averageOpensPerCustomer: emailCustomersOpened > 0
                                ? (emailTotalOpens / emailCustomersOpened).toFixed(2)
                                : '0.00',
                        }
                    },
                    sms: {
                        totalMessagesSent: smsTotalSent,
                        uniqueCustomersSent: smsUniqueCustomersSent,
                        customersOpened: smsCustomersOpened,
                        customersNotOpened: smsCustomersNotOpened,
                        totalOpens: smsTotalOpens,
                        openRate: `${smsOpenRate}%`,
                        notOpenedRate: `${smsNotOpenedRate}%`,
                        metrics: {
                            averageOpensPerCustomer: smsCustomersOpened > 0
                                ? (smsTotalOpens / smsCustomersOpened).toFixed(2)
                                : '0.00',
                        }
                    },
                    overall: {
                        totalMessagesSent: emailTotalSent + smsTotalSent,
                        totalCustomersReached: emailUniqueCustomersSent + smsUniqueCustomersSent,
                        totalCustomersOpened: emailCustomersOpened + smsCustomersOpened,
                        totalCustomersNotOpened: emailCustomersNotOpened + smsCustomersNotOpened,
                        totalOpens: emailTotalOpens + smsTotalOpens,
                    },
                    recentOpens: recentOpens.map((open: any) => ({
                        customerId: open.customerId,
                        customerName: open.customer.customerName,
                        vehicleNumber: open.customer.vehicleNumber,
                        source: open.source,
                        firstOpenedAt: open.firstOpenedAt,
                        lastOpenedAt: open.lastOpenedAt,
                        openCount: open.openCount,
                    })),
                },
            });
        } catch (error: any) {
            logger.error('Error fetching source metrics analytics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch source metrics analytics',
            });
        }
    },

    /**
     * Get source metrics for a specific customer
     */
    async getByCustomer(req: AuthRequest, res: Response) {
        try {
            const customerId = parseInt(req.params.customerId);

            if (isNaN(customerId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid customer ID',
                });
            }

            const metrics = await prisma.sourceMetric.findMany({
                where: { customerId },
                orderBy: { lastOpenedAt: 'desc' },
            });

            res.json({
                success: true,
                data: metrics,
            });
        } catch (error: any) {
            logger.error('Error fetching customer source metrics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch customer source metrics',
            });
        }
    },

    /**
     * Get detailed metrics by source
     */
    async getBySource(req: AuthRequest, res: Response) {
        try {
            const source = req.query.source as string;

            if (!source || !['email', 'sms'].includes(source.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid source. Must be "email" or "sms"',
                });
            }

            const metrics = await prisma.sourceMetric.findMany({
                where: { source: source.toLowerCase() },
                orderBy: { lastOpenedAt: 'desc' },
                include: {
                    customer: {
                        select: {
                            customerName: true,
                            vehicleNumber: true,
                            email: true,
                            phone: true,
                        },
                    },
                },
            });

            res.json({
                success: true,
                data: metrics.map((metric: any) => ({
                    customerId: metric.customerId,
                    customerName: metric.customer.customerName,
                    vehicleNumber: metric.customer.vehicleNumber,
                    firstOpenedAt: metric.firstOpenedAt,
                    lastOpenedAt: metric.lastOpenedAt,
                    openCount: metric.openCount,
                })),
            });
        } catch (error: any) {
            logger.error('Error fetching source-specific metrics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch source-specific metrics',
            });
        }
    },
};
