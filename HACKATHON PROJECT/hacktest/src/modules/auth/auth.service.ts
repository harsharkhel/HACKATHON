import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import type { AuthenticatedUser, AuthTokens, PublicUser, UserRole } from './auth.types';

const sanitizeUser = (user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role as UserRole,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const signToken = (payload: AuthenticatedUser, secret: string, expiresIn: string) => {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
};

const verifyToken = (token: string, secret: string) => {
  return jwt.verify(token, secret) as { userId?: string; role?: string };
};

export const getCurrentUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }

  return sanitizeUser(user);
};

export const registerUser = async (input: {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}): Promise<AuthTokens> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw new ConflictError('An account with this email already exists', 'USER_ALREADY_EXISTS');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: (input.role ?? 'PARTICIPANT') as Role,
    },
  });

  const authUser: AuthenticatedUser = {
    userId: user.id,
    role: user.role as UserRole,
  };

  return {
    accessToken: signToken(authUser, env.JWT_SECRET, env.JWT_ACCESS_EXPIRATION),
    refreshToken: signToken(authUser, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRATION),
    user: sanitizeUser(user),
  };
};

export const loginUser = async (input: {
  email: string;
  password: string;
}): Promise<AuthTokens> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValidPassword) {
    throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const authUser: AuthenticatedUser = {
    userId: user.id,
    role: user.role as UserRole,
  };

  return {
    accessToken: signToken(authUser, env.JWT_SECRET, env.JWT_ACCESS_EXPIRATION),
    refreshToken: signToken(authUser, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRATION),
    user: sanitizeUser(user),
  };
};

export const refreshTokenUser = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> => {
  if (!refreshToken || refreshToken.trim().length === 0) {
    throw new UnauthorizedError('Refresh token is required', 'MISSING_REFRESH_TOKEN');
  }

  let payload: { userId?: string; role?: string };

  try {
    payload = verifyToken(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new UnauthorizedError('Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
  }

  if (!payload.userId || !payload.role) {
    throw new UnauthorizedError('Refresh token payload is invalid', 'INVALID_REFRESH_TOKEN');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new UnauthorizedError('User associated with this refresh token no longer exists', 'INVALID_REFRESH_TOKEN');
  }

  const authUser: AuthenticatedUser = {
    userId: user.id,
    role: user.role as UserRole,
  };

  const accessToken = signToken(authUser, env.JWT_SECRET, env.JWT_ACCESS_EXPIRATION);
  const nextRefreshToken = signToken(authUser, env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRATION);

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    user: sanitizeUser(user),
  };
};
