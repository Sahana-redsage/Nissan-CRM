import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { llmService } from '../services/llmService';
import { config } from '../config/env';
import { logger } from '../utils/logger';
 
import twilio from 'twilio';
 
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
 
export const whatsappController = {
  async sendInsightSummary(req: AuthRequest, res: Response) {
    try {
      const { customerId, insightId } = req.body;
 
      if (!customerId) {
        return res.status(400).json({ success: false, message: 'Customer ID is required' });
      }
 
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });
 
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
 
      const phone = customer.phone || customer.alternatePhone;
 
      if (!phone) {
        return res.status(400).json({ success: false, message: 'Customer phone number not available' });
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
        return res.status(404).json({ success: false, message: 'No insights found for customer' });
      }
 
      const vehicleData = {
        vehicleMake: customer.vehicleMake,
        vehicleModel: customer.vehicleModel,
        vehicleYear: customer.vehicleYear || undefined,
        totalMileage: customer.totalMileage,
      };
 
      const baseMessage = await llmService.generateWhatsappSummary(
        vehicleData,
        insight.insightsJson as any,
        customer.customerName || 'Customer'
      );
 
      // Generate Unique Tracking Link
      const trackingRef = `wa_${Date.now()}_${customerId}`;
      const uiLink = `${config.frontendUrl}/insights/${insight.id}?source=whatsapp&ref=${trackingRef}`;
 
      const personalizedMessage = await llmService.generateWhatsappSummary(
        vehicleData,
        insight.insightsJson as any,
        customer.customerName || 'Customer',
        uiLink
      );
 
      // Helper to ensure whatsapp: prefix
      const formatWhatsappNum = (num: string) => num.startsWith('whatsapp:') ? num : `whatsapp:${num}`;
 
      const fromNum = formatWhatsappNum(config.twilio.phoneNumber);
      const toNum = formatWhatsappNum(phone);
 
      logger.info(`Attempting to send WhatsApp from ${fromNum} to ${toNum}`);
 
      // Send via Twilio WhatsApp API
      const message = await twilioClient.messages.create({
        body: personalizedMessage,
        from: fromNum,
        to: toNum
      });
 
      logger.info(`Sending WhatsApp message to ${phone}: ${personalizedMessage}`);
 
      await prisma.whatsappMessage.create({
        data: {
          messageSid: message.sid,
          messageBody: personalizedMessage,
          status: message.status,
          sentAt: new Date(),
 
          customerId: customer.id,
          insightId: insight.id,
          telecallerId: req.telecaller?.id ?? null
        },
      });
 
 
      res.json({
        success: true,
        data: {
          message: personalizedMessage,
          to: phone,
          status: message.status,
          messageSid: message.sid
        },
      });
 
    } catch (error: any) {
      logger.error('Error sending WhatsApp message:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to send WhatsApp message' });
    }
  },
 
  async webhook(req: AuthRequest, res: Response) {
    try {
      // Twilio sends data as form-urlencoded (or JSON if configured), keys are usually PascalCase
      const { MessageSid, MessageStatus } = req.body;
 
      logger.info('Received WhatsApp webhook:', req.body);
 
      if (MessageSid && MessageStatus) {
        const updateData: any = { status: MessageStatus };
 
        // If status is 'read', mark the readAt timestamp
        if (MessageStatus === 'read') {
          updateData.readAt = new Date();
        }
 
        await prisma.whatsappMessage.update({
          where: { messageSid: MessageSid },
          data: updateData,
        });
      }
 
      // Twilio expects TwiML response or 200 OK
      res.status(200).send('<Response></Response>');
    } catch (error) {
      logger.error('Webhook error:', error);
      res.status(500).send('Error');
    }
  },
 
  async getLogsByCustomer(req: AuthRequest, res: Response) {
    try {
      const customerId = parseInt(req.params.customerId);
 
      if (isNaN(customerId)) {
        return res.status(400).json({ success: false, message: 'Invalid customer ID' });
      }
 
      const logs = await prisma.whatsappMessage.findMany({
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
 
      res.json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      logger.error('Error fetching WhatsApp logs:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch WhatsApp logs' });
    }
  },
 
  async getAnalytics(req: AuthRequest, res: Response) {
    try {
      const totalSent = await prisma.whatsappMessage.count();
      const totalRead = await prisma.whatsappMessage.count({
        where: { status: 'read' },
      });
 
      const readRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(2) : 0;
 
      const recentMessages = await prisma.whatsappMessage.findMany({
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
          totalRead,
          readRate: `${readRate}%`,
          recentMessages
        },
      });
    } catch (error: any) {
      logger.error('Analytics error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
  }
};