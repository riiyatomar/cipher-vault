"""
CipherVault — Envelope Encryption
Implements DEK (Data Encryption Key) + Master Key encryption pattern.

Flow:
  1. Generate random DEK per file
  2. Encrypt file data with DEK using AES-256-GCM
  3. Encrypt DEK with Master Key (from env)
  4. Store encrypted DEK alongside file metadata
"""
import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


MASTER_KEY_HEX = os.getenv("MASTER_ENCRYPTION_KEY", "0" * 64)


def get_master_key() -> bytes:
    """Get the master encryption key from environment."""
    return bytes.fromhex(MASTER_KEY_HEX)


def generate_dek() -> bytes:
    """Generate a random 256-bit Data Encryption Key."""
    return AESGCM.generate_key(bit_length=256)


def encrypt_with_key(data: bytes, key: bytes) -> tuple[bytes, bytes]:
    """
    Encrypt data using AES-256-GCM.
    Returns (ciphertext, nonce).
    """
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit nonce for GCM
    ciphertext = aesgcm.encrypt(nonce, data, None)
    return ciphertext, nonce


def decrypt_with_key(ciphertext: bytes, key: bytes, nonce: bytes) -> bytes:
    """Decrypt data using AES-256-GCM."""
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)


def encrypt_dek(dek: bytes) -> tuple[str, str]:
    """
    Encrypt a DEK with the master key.
    Returns (encrypted_dek_b64, nonce_b64).
    """
    master_key = get_master_key()
    encrypted_dek, nonce = encrypt_with_key(dek, master_key)
    return base64.b64encode(encrypted_dek).decode(), base64.b64encode(nonce).decode()


def decrypt_dek(encrypted_dek_b64: str, nonce_b64: str) -> bytes:
    """Decrypt a DEK using the master key."""
    master_key = get_master_key()
    encrypted_dek = base64.b64decode(encrypted_dek_b64)
    nonce = base64.b64decode(nonce_b64)
    return decrypt_with_key(encrypted_dek, master_key, nonce)


def derive_key_from_password(password: str, salt: bytes = None) -> tuple[bytes, bytes]:
    """
    Derive a 256-bit key from a password using PBKDF2.
    Returns (derived_key, salt).
    """
    if salt is None:
        salt = os.urandom(16)
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=600_000,  # OWASP recommended minimum
    )
    key = kdf.derive(password.encode("utf-8"))
    return key, salt


def encrypt_file_data(data: bytes, password: str) -> dict:
    """
    Full envelope encryption of file data:
    1. Derive key from password (PBKDF2)
    2. Generate DEK
    3. Encrypt data with DEK
    4. Encrypt DEK with master key
    
    Returns dict with all components needed for decryption.
    """
    # Generate DEK
    dek = generate_dek()

    # Encrypt file data with DEK
    ciphertext, data_nonce = encrypt_with_key(data, dek)

    # Encrypt DEK with master key
    encrypted_dek_b64, dek_nonce_b64 = encrypt_dek(dek)

    # Also derive a key from password for client-side verification
    password_key, salt = derive_key_from_password(password)

    return {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "data_nonce": base64.b64encode(data_nonce).decode(),
        "encrypted_dek": encrypted_dek_b64,
        "dek_nonce": dek_nonce_b64,
        "salt": base64.b64encode(salt).decode(),
        "password_hash": base64.b64encode(password_key).decode(),
    }


def decrypt_file_data(
    ciphertext_b64: str,
    data_nonce_b64: str,
    encrypted_dek_b64: str,
    dek_nonce_b64: str,
) -> bytes:
    """
    Decrypt file data using envelope decryption:
    1. Decrypt DEK with master key
    2. Decrypt data with DEK
    """
    # Decrypt DEK
    dek = decrypt_dek(encrypted_dek_b64, dek_nonce_b64)

    # Decrypt data
    ciphertext = base64.b64decode(ciphertext_b64)
    data_nonce = base64.b64decode(data_nonce_b64)
    return decrypt_with_key(ciphertext, dek, data_nonce)
