import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthRequest extends Request {
  telecaller?: {
    id: number;
    username: string;
    email: string;
    fullName: string;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, config.jwtSecret) as any;

    req.telecaller = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      fullName: decoded.fullName,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};
