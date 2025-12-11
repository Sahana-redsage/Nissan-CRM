import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required',
        });
      }

      const result = await authService.login(username, password);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Login error:', error);
      res.status(401).json({
        success: false,
        message: error.message || 'Login failed',
      });
    }
  },

  async logout(req: Request, res: Response) {
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  },
};
