"""
Intelli Platform — MFA/2FA Service
Feature: AUTH-6.2

TOTP-based multi-factor authentication with backup codes.
"""
import secrets
import string
import hashlib
import pyotp
from cryptography.fernet import Fernet
from base64 import urlsafe_b64encode
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.shared.models.user import User


class MFAService:
    """Manages TOTP-based MFA setup, verification, and backup codes."""

    @staticmethod
    def _get_fernet() -> Fernet:
        """Derive a Fernet cipher from SECRET_KEY for encrypting MFA secrets."""
        # Generate a Fernet key from SECRET_KEY
        key_material = settings.SECRET_KEY.encode()[:32].ljust(32, b"\x00")
        key = urlsafe_b64encode(key_material)
        return Fernet(key)

    @staticmethod
    def _encrypt_secret(secret: str) -> str:
        """Encrypt a TOTP secret with Fernet."""
        fernet = MFAService._get_fernet()
        encrypted = fernet.encrypt(secret.encode())
        return encrypted.decode()

    @staticmethod
    def _decrypt_secret(encrypted_secret: str) -> str:
        """Decrypt a TOTP secret with Fernet."""
        fernet = MFAService._get_fernet()
        decrypted = fernet.decrypt(encrypted_secret.encode())
        return decrypted.decode()

    @staticmethod
    def _hash_code(code: str) -> str:
        """Hash a backup code for storage."""
        return hashlib.sha256(code.encode()).hexdigest()

    @staticmethod
    def _generate_backup_codes(count: int = 10) -> list[str]:
        """Generate backup codes (8-character alphanumeric strings)."""
        codes = []
        for _ in range(count):
            code = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            codes.append(code)
        return codes

    @staticmethod
    async def setup_mfa(db: AsyncSession, user: User) -> dict:
        """Initiate MFA setup: generate secret and backup codes.

        Returns:
            {
                "secret": plain_secret (for manual entry if QR doesn't scan),
                "qr_uri": provisioning URI for QR code,
                "backup_codes": list of plain backup codes (shown once)
            }
        """
        # Generate TOTP secret
        secret = pyotp.random_base32()

        # Encrypt and store secret
        encrypted_secret = MFAService._encrypt_secret(secret)
        user.mfa_secret = encrypted_secret

        # Generate backup codes
        plain_codes = MFAService._generate_backup_codes(10)
        hashed_codes = [MFAService._hash_code(code) for code in plain_codes]
        user.mfa_backup_codes = hashed_codes

        # Don't enable MFA yet — wait for verification
        user.mfa_enabled = False
        await db.commit()

        # Generate QR provisioning URI
        totp = pyotp.TOTP(secret)
        qr_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name=settings.MFA_ISSUER_NAME,
        )

        return {
            "secret": secret,
            "qr_uri": qr_uri,
            "backup_codes": plain_codes,
        }

    @staticmethod
    async def verify_setup(db: AsyncSession, user: User, code: str) -> bool:
        """Verify TOTP code and enable MFA.

        Args:
            db: Database session
            user: User object with mfa_secret already set
            code: 6-digit TOTP code from authenticator app

        Returns:
            True if code is valid and MFA is enabled, False otherwise
        """
        if not user.mfa_secret:
            return False

        try:
            secret = MFAService._decrypt_secret(user.mfa_secret)
            totp = pyotp.TOTP(secret)
            # Allow ±1 time window for clock skew
            if not totp.verify(code, valid_window=1):
                return False

            # Code is valid — enable MFA
            user.mfa_enabled = True
            await db.commit()
            return True
        except Exception:
            return False

    @staticmethod
    async def verify_totp(user: User, code: str) -> bool:
        """Verify a TOTP code against user's stored secret.

        Args:
            user: User with mfa_enabled=True
            code: 6-digit TOTP code

        Returns:
            True if code is valid, False otherwise
        """
        if not user.mfa_enabled or not user.mfa_secret:
            return False

        try:
            secret = MFAService._decrypt_secret(user.mfa_secret)
            totp = pyotp.TOTP(secret)
            return totp.verify(code, valid_window=1)
        except Exception:
            return False

    @staticmethod
    async def use_backup_code(db: AsyncSession, user: User, code: str) -> bool:
        """Use a backup code (single-use, removes it from list).

        Args:
            db: Database session
            user: User with mfa_backup_codes
            code: Plain backup code

        Returns:
            True if code was valid and used, False otherwise
        """
        if not user.mfa_backup_codes:
            return False

        code_hash = MFAService._hash_code(code)

        # Check if code exists in list
        if code_hash not in user.mfa_backup_codes:
            return False

        # Remove code from list
        user.mfa_backup_codes.remove(code_hash)
        await db.commit()
        return True

    @staticmethod
    async def disable_mfa(db: AsyncSession, user: User, code: str) -> bool:
        """Disable MFA after verifying current TOTP code.

        Args:
            db: Database session
            user: User with MFA enabled
            code: Current 6-digit TOTP code for verification

        Returns:
            True if code is valid and MFA is disabled, False otherwise
        """
        # Verify code first
        if not await MFAService.verify_totp(user, code):
            return False

        # Clear MFA
        user.mfa_enabled = False
        user.mfa_secret = None
        user.mfa_backup_codes = None
        await db.commit()
        return True
