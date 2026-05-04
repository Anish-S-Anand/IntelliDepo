"""
Intelli Platform — Authentication Service
Feature: AUTH-6.1

JWT-based authentication, password hashing, token management, and password reset.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.shared.models.user import User

# --- Password Hashing ---

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
REFRESH_TOKEN_EXPIRE_DAYS = 7
PASSWORD_RESET_EXPIRE_MINUTES = 30


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# --- JWT Token Management ---

def create_access_token(
    user_id: uuid.UUID, jti: str, roles: list[str] | None = None
) -> str:
    """Create an access token with jti and roles claims."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access",
        "jti": jti,
        "roles": roles or [],
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: uuid.UUID, jti: str) -> str:
    """Create a refresh token with jti claim."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {"sub": str(user_id), "exp": expire, "type": "refresh", "jti": jti}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT token. Returns payload dict or None if invalid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


# --- User Queries ---

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


# --- Auth Operations ---

async def register_user(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    *,
    tenant_id: uuid.UUID | None = None,
    tenant_key: str | None = None,
    account_type: str = "platform_user",
) -> User:
    """Create a new user account."""
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        tenant_id=tenant_id,
        tenant_key=tenant_key,
        account_type=account_type,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> User | None:
    """Verify credentials and return user, or None if invalid.

    Implements account lockout: after MAX_ATTEMPTS failures, lock for DURATION_MINUTES.
    """
    user = await get_user_by_email(db, email)

    # Check if account is locked
    if user and user.locked_until:
        if datetime.now(timezone.utc) < user.locked_until:
            # Account still locked
            return None
        else:
            # Lock expired, clear it
            user.locked_until = None
            await db.commit()

    # Verify credentials
    if not user or not verify_password(password, user.hashed_password):
        # Failed authentication — increment attempts if user exists
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= settings.ACCOUNT_LOCKOUT_MAX_ATTEMPTS:
                # Lock the account
                user.locked_until = datetime.now(timezone.utc) + timedelta(
                    minutes=settings.ACCOUNT_LOCKOUT_DURATION_MINUTES
                )
            await db.commit()
        return None

    # Check if user is active
    if not user.is_active:
        return None

    # Successful authentication — reset attempts and update last login
    user.failed_login_attempts = 0
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    return user


async def create_password_reset_token(db: AsyncSession, email: str) -> str | None:
    """Generate a password reset token for the user. Returns token or None if user not found."""
    user = await get_user_by_email(db, email)
    if not user:
        return None
    token = secrets.token_urlsafe(32)
    user.password_reset_token = token
    user.password_reset_expires = datetime.now(timezone.utc) + timedelta(
        minutes=PASSWORD_RESET_EXPIRE_MINUTES
    )
    await db.commit()
    return token


async def reset_password(db: AsyncSession, token: str, new_password: str) -> bool:
    """Reset password using a valid reset token. Returns True on success."""
    result = await db.execute(
        select(User).where(User.password_reset_token == token)
    )
    user = result.scalar_one_or_none()
    if not user:
        return False
    if user.password_reset_expires and user.password_reset_expires < datetime.now(
        timezone.utc
    ):
        # Token expired — clear it
        user.password_reset_token = None
        user.password_reset_expires = None
        await db.commit()
        return False
    user.hashed_password = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.commit()
    return True


async def change_password(
    db: AsyncSession, user: User, current_password: str, new_password: str
) -> bool:
    """Change password for authenticated user. Returns True on success."""
    if not verify_password(current_password, user.hashed_password):
        return False
    user.hashed_password = hash_password(new_password)
    await db.commit()
    return True
