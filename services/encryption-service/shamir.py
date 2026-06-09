"""
CipherVault — Shamir Secret Sharing
Splits encryption keys into shares for secure recovery.

Uses polynomial interpolation over a finite field (GF(p)).
  - Split: key → N shares, where any K shares can reconstruct the key
  - Combine: K shares → original key
"""
import os
import secrets
from typing import List, Tuple

# Large prime for finite field arithmetic
PRIME = 2**521 - 1  # 13th Mersenne prime


def _mod_inverse(a: int, p: int) -> int:
    """Modular multiplicative inverse using extended Euclidean algorithm."""
    if a < 0:
        a = a % p
    g, x, _ = _extended_gcd(a, p)
    if g != 1:
        raise ValueError("Modular inverse does not exist")
    return x % p


def _extended_gcd(a: int, b: int) -> Tuple[int, int, int]:
    if a == 0:
        return b, 0, 1
    g, x, y = _extended_gcd(b % a, a)
    return g, y - (b // a) * x, x


def _eval_polynomial(coefficients: List[int], x: int, prime: int) -> int:
    """Evaluate polynomial at point x using Horner's method."""
    result = 0
    for coeff in reversed(coefficients):
        result = (result * x + coeff) % prime
    return result


def split_secret(
    secret: bytes,
    total_shares: int = 5,
    threshold: int = 3,
) -> List[Tuple[int, str]]:
    """
    Split a secret into shares using Shamir's Secret Sharing.
    
    Args:
        secret: The secret bytes to split
        total_shares: Total number of shares to generate (N)
        threshold: Minimum shares needed to reconstruct (K)
    
    Returns:
        List of (index, share_hex) tuples
    """
    if threshold > total_shares:
        raise ValueError("Threshold cannot exceed total shares")
    if threshold < 2:
        raise ValueError("Threshold must be at least 2")

    # Convert secret to integer
    secret_int = int.from_bytes(secret, byteorder="big")

    # Generate random polynomial coefficients
    # f(x) = secret + a1*x + a2*x^2 + ... + a(k-1)*x^(k-1)
    coefficients = [secret_int]
    for _ in range(threshold - 1):
        coefficients.append(secrets.randbelow(PRIME))

    # Generate shares: (i, f(i)) for i = 1..N
    shares = []
    for i in range(1, total_shares + 1):
        y = _eval_polynomial(coefficients, i, PRIME)
        shares.append((i, y.to_bytes((y.bit_length() + 7) // 8, byteorder="big").hex()))

    return shares


def combine_shares(shares: List[Tuple[int, str]]) -> bytes:
    """
    Reconstruct the secret from shares using Lagrange interpolation.
    
    Args:
        shares: List of (index, share_hex) tuples (minimum K shares)
    
    Returns:
        The reconstructed secret bytes
    """
    if len(shares) < 2:
        raise ValueError("Need at least 2 shares to reconstruct")

    points = [(x, int.from_bytes(bytes.fromhex(y_hex), byteorder="big")) for x, y_hex in shares]

    # Lagrange interpolation at x=0 to recover the secret
    secret = 0
    for i, (xi, yi) in enumerate(points):
        numerator = 1
        denominator = 1
        for j, (xj, _) in enumerate(points):
            if i != j:
                numerator = (numerator * (-xj)) % PRIME
                denominator = (denominator * (xi - xj)) % PRIME

        lagrange_coeff = (numerator * _mod_inverse(denominator, PRIME)) % PRIME
        secret = (secret + yi * lagrange_coeff) % PRIME

    return secret.to_bytes((secret.bit_length() + 7) // 8, byteorder="big")
