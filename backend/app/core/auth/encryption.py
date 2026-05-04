"""
Intelli Platform - Security & Data Encryption
Feature: SEC-6.22

AES-256-GCM encryption service with versioned keys and rotation support.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings


class EncryptionService:
    """Provides AES-256-GCM encryption for sensitive application data."""

    def __init__(
        self,
        current_version: str | None = None,
        current_key: str | None = None,
        fallback_keys: str | None = None,
    ) -> None:
        self.current_version = current_version or settings.ENCRYPTION_KEY_VERSION
        self._keys = self._build_keyring(
            current_key=current_key or settings.ENCRYPTION_MASTER_KEY,
            fallback_keys=fallback_keys or settings.ENCRYPTION_FALLBACK_KEYS,
        )

    def _build_keyring(self, current_key: str, fallback_keys: str) -> dict[str, bytes]:
        keys: dict[str, bytes] = {
            self.current_version: self._normalize_key_material(current_key, self.current_version)
        }

        for item in filter(None, (part.strip() for part in fallback_keys.split(","))):
            version, sep, value = item.partition(":")
            if not sep or not value:
                continue
            keys[version.strip()] = self._normalize_key_material(value.strip(), version.strip())
        return keys

    @staticmethod
    def _normalize_key_material(raw_value: str, context: str) -> bytes:
        if raw_value:
            try:
                decoded = base64.urlsafe_b64decode(raw_value.encode("utf-8"))
                if len(decoded) == 32:
                    return decoded
            except (binascii.Error, ValueError):
                pass
            candidate = raw_value.encode("utf-8")
        else:
            candidate = settings.SECRET_KEY.encode("utf-8")

        return hashlib.sha256(candidate + context.encode("utf-8")).digest()

    def encrypt(self, plaintext: str, *, associated_data: str | None = None) -> str:
        nonce = os.urandom(12)
        aad = associated_data.encode("utf-8") if associated_data else None
        aesgcm = AESGCM(self._keys[self.current_version])
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), aad)
        return ".".join(
            [
                self.current_version,
                base64.urlsafe_b64encode(nonce).decode("utf-8"),
                base64.urlsafe_b64encode(ciphertext).decode("utf-8"),
            ]
        )

    def decrypt(self, token: str, *, associated_data: str | None = None) -> str:
        try:
            version, nonce_b64, ciphertext_b64 = token.split(".", 2)
        except ValueError as exc:
            raise ValueError("Invalid encrypted payload format") from exc

        key = self._keys.get(version)
        if key is None:
            raise ValueError(f"Unknown key version '{version}'")

        nonce = base64.urlsafe_b64decode(nonce_b64.encode("utf-8"))
        ciphertext = base64.urlsafe_b64decode(ciphertext_b64.encode("utf-8"))
        aad = associated_data.encode("utf-8") if associated_data else None
        try:
            plaintext = AESGCM(key).decrypt(nonce, ciphertext, aad)
        except Exception as exc:
            raise ValueError("Unable to decrypt payload") from exc
        return plaintext.decode("utf-8")

    def rotate(self, token: str, *, associated_data: str | None = None) -> str:
        plaintext = self.decrypt(token, associated_data=associated_data)
        return self.encrypt(plaintext, associated_data=associated_data)

    def active_key_info(self) -> dict[str, str | bool]:
        key = self._keys[self.current_version]
        fingerprint = hashlib.sha256(key).hexdigest()[:16]
        return {
            "algorithm": "AES-256-GCM",
            "key_version": self.current_version,
            "fingerprint": fingerprint,
            "rotation_ready": len(self._keys) > 1,
        }


encryption_service = EncryptionService()
