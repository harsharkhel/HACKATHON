/**
 * Cryptographic Utilities (Stub for Phase 1)
 * 
 * This will be expanded in Phase 3 (JWT) and Phase 7 (QR tokens).
 * For now, we establish the file in the project structure.
 * 
 * Will eventually contain:
 * - generateToken(): Creates cryptographically secure random tokens
 * - hashToken(): SHA-256 hashes a token for secure storage
 * - compareTokenHash(): Compares a token against its stored hash
 */

import crypto from 'crypto';

/**
 * Generate a cryptographically secure random string.
 * @param bytes - Number of random bytes (default 32 = 64 hex chars)
 * @returns Hex-encoded random string
 */
export const generateSecureToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Hash a string using SHA-256.
 * Used to store token hashes in the database instead of raw tokens.
 * @param input - The string to hash
 * @returns SHA-256 hex digest
 */
export const hashSHA256 = (input: string): string => {
  return crypto.createHash('sha256').update(input).digest('hex');
};
