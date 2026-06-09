/**
 * CipherVault — Client-Side Encryption (Web Crypto API)
 * Zero-knowledge encryption: files are encrypted in the browser before upload.
 *
 * Flow:
 *   1. User enters password
 *   2. PBKDF2 derives a 256-bit AES key from the password
 *   3. AES-256-GCM encrypts the file data
 *   4. Only ciphertext + salt + IV are sent to the server
 *   5. Server NEVER sees plaintext or password
 */

/**
 * Derive a 256-bit AES key from a password using PBKDF2.
 * @param {string} password - User-provided password
 * @param {Uint8Array} [salt] - Optional salt (generated if not provided)
 * @returns {Promise<{key: CryptoKey, salt: Uint8Array}>}
 */
export async function deriveKey(password, salt = null, iterations = 600000) {
  const enc = new TextEncoder();
  if (!salt) {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, salt };
}

/**
 * Encrypt a file using AES-256-GCM with a password-derived key.
 * @param {ArrayBuffer} fileData - Raw file data
 * @param {string} password - User password
 * @returns {Promise<{encrypted: ArrayBuffer, salt: string, iv: string}>}
 */
export async function encryptFile(fileData, password, iterations = 600000) {
  const { key, salt } = await deriveKey(password, null, iterations);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce for GCM

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    fileData
  );

  return {
    encrypted,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    iterations,
  };
}

/**
 * Decrypt a file using AES-256-GCM with a password-derived key.
 * @param {ArrayBuffer} encryptedData - Encrypted file data
 * @param {string} password - User password
 * @param {string} saltB64 - Base64-encoded salt
 * @param {string} ivB64 - Base64-encoded IV
 * @returns {Promise<ArrayBuffer>} Decrypted file data
 */
export async function decryptFile(encryptedData, password, saltB64, ivB64, iterations = 600000) {
  const salt = base64ToArrayBuffer(saltB64);
  const iv = base64ToArrayBuffer(ivB64);

  const { key } = await deriveKey(password, new Uint8Array(salt), iterations);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    encryptedData
  );

  return decrypted;
}

/**
 * Generate SHA-256 hash of file data for integrity verification.
 * @param {ArrayBuffer} data
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashFile(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Utility Functions ───────────────────────────────────
function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
