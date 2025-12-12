import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { pdfService } from '../services/pdfService';
import { llmService } from '../services/llmService';
import { logger } from '../utils/logger';

export const insightController = {
  async generate(req: AuthRequest, res: Response) {
    try {
      const { customerId, documentIds } = req.body;

      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required',
        });
      }

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Document IDs are required',
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

      const documents = await prisma.serviceDocument.findMany({
        where: {
          id: { in: documentIds },
          customerId,
        },
      });

      if (documents.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No documents found',
        });
      }

      logger.info(`Extracting text from ${documents.length} documents`);
      const pdfTexts: string[] = [];

      for (const doc of documents) {
        try {
          const text = await pdfService.extractTextFromR2(doc.documentPath);
          pdfTexts.push(text);
        } catch (error) {
          logger.error(`Failed to extract text from document ${doc.id}:`, error);
        }
      }

      if (pdfTexts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Failed to extract text from any documents',
        });
      }

      logger.info('Generating insights using LLM');
      const { insights, rawResponse } = await llmService.generateServiceInsights(
        {
          vehicleMake: customer.vehicleMake,
          vehicleModel: customer.vehicleModel,
          vehicleYear: customer.vehicleYear || undefined,
          totalMileage: customer.totalMileage,
          lastServiceDate: customer.lastServiceDate || undefined,
        },
        pdfTexts
      );

      const serviceInsight = await prisma.serviceInsight.create({
        data: {
          customerId,
          generatedBy: req.telecaller!.id,
          insightsJson: insights as any,
          rawLlmResponse: rawResponse,
          documentIds,
        },
      });

      res.json({
        success: true,
        data: {
          insightId: serviceInsight.id,
          insights: serviceInsight.insightsJson,
          generatedAt: serviceInsight.generatedAt,
        },
      });
    } catch (error: any) {
      logger.error('Error generating insights:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate insights',
      });
    }
  },

  async getByCustomerId(req: AuthRequest, res: Response) {
    try {
      const customerId = parseInt(req.params.customerId);

      const insights = await prisma.serviceInsight.findMany({
        where: { customerId },
        orderBy: { generatedAt: 'desc' },
        take: 1,
        include: {
          telecaller: {
            select: {
              fullName: true,
            },
          },
        },
      });

      if (insights.length === 0) {
        return res.json({
          success: true,
          data: null,
        });
      }

      res.json({
        success: true,
        data: insights[0],
      });
    } catch (error: any) {
      logger.error('Error fetching insights:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch insights',
      });
    }
  },

  async uploadAndAnalyze(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'PDF file is required',
        });
      }

      logger.info('Extracting text from uploaded PDF');
      
      // Extract text from the uploaded PDF buffer
      const text = await pdfService.extractTextFromBuffer(req.file.buffer);

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Failed to extract text from PDF or PDF is empty',
        });
      }

      logger.info('Extracting customer details from PDF');
      const customerDetails = await llmService.extractCustomerDetails(text);

      logger.info('Generating insights using LLM for standalone analysis');
      
      // Generate insights with extracted customer context
      const { insights, rawResponse } = await llmService.generateServiceInsights(
        {
          vehicleMake: customerDetails.vehicleMake || 'Unknown',
          vehicleModel: customerDetails.vehicleModel || 'Unknown',
          vehicleYear: customerDetails.vehicleYear,
          totalMileage: customerDetails.totalMileage || 0,
          lastServiceDate: customerDetails.lastServiceDate ? new Date(customerDetails.lastServiceDate) : undefined,
        },
        [text]
      );

      res.json({
        success: true,
        data: {
          customerDetails,
          insights,
          generatedAt: new Date().toISOString(),
          rawResponse,
        },
      });
    } catch (error: any) {
      logger.error('Error in upload and analyze:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to analyze document',
      });
    }
  },
};
