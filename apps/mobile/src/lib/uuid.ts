/**
 * Generates an RFC 4122 version 4 UUID.
 *
 * Expense ids are minted on-device so an entry written offline already has its
 * canonical server identity — the sync API upserts on this id, which is what
 * makes a replayed queue idempotent. The platform CSPRNG is used when present
 * (browsers, newer Hermes); otherwise a `Math.random` fallback is plenty, since
 * a collision would require two devices to draw the same 122 random bits.
 */
export function randomUuid(): string {
  const platformCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof platformCrypto?.randomUUID === 'function') {
    return platformCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  // Pin the version (4) and variant (10xx) bits to make it a valid v4 UUID.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
