const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  const keyBytes = fromBase64(base64Key);
  if (keyBytes.byteLength !== 32) {
    throw new Error('GITLAB_TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(value: string, base64Key: string): Promise<string> {
  const key = await importAesKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = ENCODER.encode(value);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(value: string, base64Key: string): Promise<string> {
  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new Error('Unsupported token format');
  }

  const key = await importAesKey(base64Key);
  const iv = fromBase64(parts[1]);
  const ciphertext = fromBase64(parts[2]);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return DECODER.decode(plaintext);
}
