import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { llmService } from '../services/llmService';
import { config } from '../config/env';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'outlook', // You might want to make this configurable too if not using Gmail
    auth: {
        user: config.email.user,
        pass: config.email.pass,
    },
});

export const emailController = {
    async sendInsightEmail(req: AuthRequest, res: Response) {
        try {
            const { insightId } = req.body;

            if (!insightId) {
                return res.status(400).json({
                    success: false,
                    message: 'Insight ID is required',
                });
            }

            const result = await processEmailSend(insightId, req.telecaller!.id);

            res.json({
                success: true,
                message: 'Email sent successfully',
                data: result
            });

        } catch (error: any) {
            logger.error('Error sending insight email:', error);
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Failed to send email',
            });
        }
    },

    async sendBulkInsightEmails(req: AuthRequest, res: Response) {
        try {
            const { insightIds } = req.body;

            if (!insightIds || !Array.isArray(insightIds) || insightIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Array of Insight IDs is required',
                });
            }

            const results = [];

            // Process in parallel or sequential? Sequential is safer for rate limits / LLM
            // Let's do sequential for now to avoid overwhelming resources
            for (const id of insightIds) {
                try {
                    const result = await processEmailSend(id, req.telecaller!.id);
                    results.push({ id, status: 'success', data: result });
                } catch (error: any) {
                    logger.error(`Failed to send email for insight ${id}:`, error);
                    results.push({ id, status: 'failed', error: error.message });
                }
            }

            res.json({
                success: true,
                message: 'Bulk email processing completed',
                data: results
            });

        } catch (error: any) {
            logger.error('Error in bulk email sending:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to process bulk emails',
            });
        }
    },

    async trackEmailOpen(req: any, res: Response) {
        try {
            const emailId = parseInt(req.params.id);

            if (!isNaN(emailId)) {
                // Update seenAt only if it wasn't seen before (optional, or update every time)
                await prisma.serviceEmail.update({
                    where: { id: emailId },
                    data: {
                        seenAt: Date.now(),
                    },
                });
                logger.info(`Email ${emailId} opened at ${new Date().toISOString()}`);
            }
        } catch (error) {
            logger.error(`Error tracking email open:`, error);
        } finally {
            // Always return a 1x1 transparent GIF
            const transparentGif = Buffer.from(
                'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                'base64'
            );
            res.writeHead(200, {
                'Content-Type': 'image/gif',
                'Content-Length': transparentGif.length,
            });
            res.end(transparentGif);
        }
    },
    async getemailLogs(req: AuthRequest, res: Response) {
        try {
            const customerId = parseInt(req.params.id);

            const emails = await prisma.serviceEmail.findMany({
                where: { customerId: customerId },
                include: {
                    customer: true,
                    sender: {
                        select: {
                            fullName: true
                        }
                    }
                },
            });

            const formattedEmails = emails.map(email => ({
                ...email,
                sentBy: email.sender.fullName,
                sender: undefined
            }));

            res.json({
                success: true,
                data: formattedEmails,
            });
        } catch (error) {
            logger.error(`Error fetching email logs:`, error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch email logs',
            });
        }
    },
};

// Helper function to handle individual email sending logic
async function processEmailSend(insightId: number, telecallerId: number) {
    // 1. Fetch the insight and related customer details
    const insight = await prisma.serviceInsight.findUnique({
        where: { id: insightId },
        include: {
            customer: true,
        },
    });

    if (!insight) {
        throw { status: 404, message: 'Insight not found' };
    }

    const customer = insight.customer;

    if (!customer.email) {
        throw { status: 400, message: 'Customer does not have an email address' };
    }

    // 2. Create the email record FIRST to get the ID for tracking
    const serviceEmail = await prisma.serviceEmail.create({
        data: {
            insightId: insight.id,
            customerId: customer.id,
            sentAt: Date.now(),
            sentBy: telecallerId,
        },
    });

    // 3. Generate the email body using LLM
    logger.info(`Generating email summary for insight ${insightId}`);
    let emailHtml = await llmService.summarizeInsightsForEmail(
        insight.insightsJson as any,
        customer.customerName
    );

    // 4. Append Insight Link
    const linkRef = `email_${Date.now()}_${customer.id}`;
    const insightUrl = `https://nissancall-fe.vercel.app/customer-view/${customer.id}?source=email&ref=${linkRef}`;

    const linkHtml = `
        <br><br>
        <p style="text-align: center;">
            <a href="${insightUrl}" 
               style="display: inline-block; padding: 12px 24px; background-color: #C3002F; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
                View Full Service Insights
            </a>
        </p>
        <p style="text-align: center; font-size: 12px; color: #666;">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${insightUrl}" style="color: #666;">${insightUrl}</a>
        </p>
    `;

    if (emailHtml.includes('</body>')) {
        emailHtml = emailHtml.replace('</body>', `${linkHtml}</body>`);
    } else {
        emailHtml += linkHtml;
    }

    // 4. Append Tracking Pixel
    const trackingUrl = `${config.backendUrl}/api/email/track/${serviceEmail.id}`;
    logger.info(`Generated Tracking URL: ${trackingUrl}`); // DEBUG LOG
    const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;

    // Insert pixel before closing body tag or at end if no body tag
    if (emailHtml.includes('</body>')) {
        emailHtml = emailHtml.replace('</body>', `${trackingPixel}</body>`);
    } else {
        emailHtml += trackingPixel;
    }

    // 5. Send the email
    logger.info(`Sending email to ${customer.email} with tracking ID ${serviceEmail.id}`);
    const mailOptions = {
        from: `"${config.email.fromName}" <${config.email.user}>`,
        to: customer.email,
        subject: `Service Insights for your ${customer.vehicleMake} ${customer.vehicleModel}`,
        html: emailHtml,
    };

    await transporter.sendMail(mailOptions);

    // Update the record with the generated body
    await prisma.serviceEmail.update({
        where: { id: serviceEmail.id },
        data: { emailBody: emailHtml }
    });

    logger.info(`Email sent successfully to ${customer.email}`);

    return {
        emailId: serviceEmail.id
    };
}
