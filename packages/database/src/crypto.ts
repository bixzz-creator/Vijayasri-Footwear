// Cryptographic helper using browser Web Crypto API (AES-GCM)

const ALGORITHM = 'AES-GCM';
const KEY_LEN = 256;
const SALT = new Uint8Array([118, 105, 106, 97, 121, 97, 115, 114, 105, 95, 115, 101, 99, 114, 101, 116]); // "vijayasri_secret"

async function deriveKey(passcode: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(text: string, passcode: string): Promise<string> {
  const key = await deriveKey(passcode);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    enc.encode(text)
  );
  
  // Combine IV and CipherText
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedBase64: string, passcode: string): Promise<string> {
  try {
    const key = await deriveKey(passcode);
    const binaryStr = atob(encryptedBase64);
    const combined = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      combined[i] = binaryStr.charCodeAt(i);
    }
    
    const iv = combined.slice(0, 12);
    const cipherText = combined.slice(12);
    
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      cipherText
    );
    
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Decryption failed. Invalid passcode.');
  }
}
