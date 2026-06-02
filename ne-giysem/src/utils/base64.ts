/** Saf-JS base64 encode/decode — atob/btoa gerektirmez (Hermes-uyumlu). */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Uint8Array → base64 string */
export function base64Encode(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    result += CHARS[b0 >> 2];
    result += CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    result += CHARS[((b1 & 15) << 2) | (b2 >> 6)];
    result += CHARS[b2 & 63];
  }
  const pad = len % 3;
  if (pad === 1) return result.slice(0, -2) + '==';
  if (pad === 2) return result.slice(0, -1) + '=';
  return result;
}

/** base64 string → Uint8Array */
export function base64Decode(b64: string): Uint8Array {
  const lookup = new Uint8Array(256).fill(255);
  for (let i = 0; i < CHARS.length; i++) lookup[CHARS.charCodeAt(i)] = i;
  lookup['='.charCodeAt(0)] = 0;

  const len    = b64.length;
  const pad    = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const bytes  = new Uint8Array((len * 3) / 4 - pad);
  let j = 0;

  for (let i = 0; i < len; i += 4) {
    const b0 = lookup[b64.charCodeAt(i)];
    const b1 = lookup[b64.charCodeAt(i + 1)];
    const b2 = lookup[b64.charCodeAt(i + 2)];
    const b3 = lookup[b64.charCodeAt(i + 3)];
    if (j < bytes.length) bytes[j++] = (b0 << 2) | (b1 >> 4);
    if (j < bytes.length) bytes[j++] = ((b1 & 15) << 4) | (b2 >> 2);
    if (j < bytes.length) bytes[j++] = ((b2 & 3) << 6) | b3;
  }
  return bytes;
}
