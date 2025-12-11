import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { r2Service } from '../services/r2Service';
import { logger } from '../utils/logger';

export const documentController = {
  async upload(req: AuthRequest, res: Response) {
    try {
      const { customerId } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!customerId) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID is required',
        });
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded',
        });
      }

      const customer = await prisma.customer.findUnique({
        where: { id: parseInt(customerId) },
      });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found',
        });
      }

      const uploadedFiles = [];

      for (const file of files) {
        const documentPath = await r2Service.uploadFile(file, customer.id);

        const document = await prisma.serviceDocument.create({
          data: {
            customerId: customer.id,
            uploadedBy: req.telecaller!.id,
            documentName: file.originalname,
            documentPath,
            fileSize: file.size,
          },
        });

        uploadedFiles.push({
          id: document.id,
          documentName: document.documentName,
          fileSize: document.fileSize,
          uploadedAt: document.uploadedAt,
        });
      }

      res.json({
        success: true,
        data: {
          uploadedFiles,
        },
      });
    } catch (error: any) {
      logger.error('Error uploading documents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload documents',
      });
    }
  },

  async getByCustomerId(req: AuthRequest, res: Response) {
    try {
      const customerId = parseInt(req.params.customerId);

      const documents = await prisma.serviceDocument.findMany({
        where: { customerId },
        orderBy: { uploadedAt: 'desc' },
        include: {
          telecaller: {
            select: {
              fullName: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: documents,
      });
    } catch (error: any) {
      logger.error('Error fetching documents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch documents',
      });
    }
  },

  async delete(req: AuthRequest, res: Response) {
    try {
      const documentId = parseInt(req.params.documentId);

      // Find the document first
      const document = await prisma.serviceDocument.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found',
        });
      }

      // Delete from R2 storage
      await r2Service.deleteFile(document.documentPath);

      // Delete from database
      await prisma.serviceDocument.delete({
        where: { id: documentId },
      });

      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting document:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete document',
      });
    }
  },
};
