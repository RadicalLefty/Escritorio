import crypto from 'crypto';

// Use encryption key from environment, or generate/reuse a stable key
const ENCRYPTION_KEY = process.env.DATABASE_ENCRYPTION_KEY 
  ? crypto.createHash('sha256').update(process.env.DATABASE_ENCRYPTION_KEY).digest()
  : crypto.createHash('sha256').update('screenplay-studio-default-key-2026').digest();

const IV_LENGTH = 16; // For AES, this is always 16

export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('Encryption failed:', err);
    throw err;
  }
}

export function decrypt(text: string): string {
  if (!text) return '';
  const isEncryptedFormat = /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(text);
  if (!isEncryptedFormat) {
    return text;
  }
  try {
    const textParts = text.split(':');
    const ivHex = textParts.shift() || '';
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedTextHex = textParts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedTextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed, returning original text:', err);
    return text;
  }
}
