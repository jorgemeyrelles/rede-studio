const FALLBACK_RADIX = 36;

export function makeServiceId(prefix: string): string {
  const hasCrypto = typeof crypto !== 'undefined' && 'randomUUID' in crypto;
  if (hasCrypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  const timestamp = Date.now().toString(FALLBACK_RADIX);
  const random = Math.floor(Math.random() * 10_000_000).toString(FALLBACK_RADIX);
  return `${prefix}-${timestamp}-${random}`;
}
