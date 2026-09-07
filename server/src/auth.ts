import { timingSafeEqual } from 'node:crypto';

/** Verifie un header Authorization: Bearer <token> en temps constant. */
export function isAuthorized(authorization: string | undefined, expectedToken: string): boolean {
  if (!authorization || expectedToken === '') return false;
  const [scheme, ...parts] = authorization.trim().split(/\s+/);
  const value = parts.join(' ');
  if (scheme !== 'Bearer' || !value) return false;
  return safeEqual(value, expectedToken);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual exige des buffers de meme longueur
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}