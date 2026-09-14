import { createHash, randomInt } from 'crypto';

export function generateOtp(): string {
  return randomInt(0, 10000).toString().padStart(4, '0');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
