import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { config } from '../config/env';

export const authService = {
  async login(username: string, password: string) {
    const telecaller = await prisma.telecaller.findUnique({
      where: { username },
    });

    if (!telecaller) {
      throw new Error('Invalid credentials');
    }

    if (!telecaller.isActive) {
      throw new Error('Account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, telecaller.passwordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      {
        id: telecaller.id,
        username: telecaller.username,
        email: telecaller.email,
        fullName: telecaller.fullName,
      },
      config.jwtSecret as string,
      { expiresIn: config.jwtExpiry } as jwt.SignOptions
    );

    return {
      token,
      telecaller: {
        id: telecaller.id,
        username: telecaller.username,
        email: telecaller.email,
        fullName: telecaller.fullName,
      },
    };
  },

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  },
};
