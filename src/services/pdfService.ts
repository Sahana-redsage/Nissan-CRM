import pdfParse from 'pdf-parse';
import { r2Service } from './r2Service';

export const pdfService = {
  async extractTextFromBuffer(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error}`);
    }
  },

  async extractTextFromR2(documentPath: string): Promise<string> {
    try {
      const buffer = await r2Service.getFileBuffer(documentPath);
      return this.extractTextFromBuffer(buffer);
    } catch (error) {
      throw new Error(`Failed to extract text from R2 PDF: ${error}`);
    }
  },
};
