export type UserRole = 'PARTICIPANT' | 'JUDGE' | 'ORGANIZER';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}
