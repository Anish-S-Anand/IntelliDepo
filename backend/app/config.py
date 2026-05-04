"""
Intelli Platform — Application Configuration
"""
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "Intelli Platform"
    VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://intelli:intelli@localhost:5432/intelli"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # Redis removed — all features use DB or in-memory alternatives

    # Auth — MUST be overridden via .env in production
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"
    ACCOUNT_LOCKOUT_MAX_ATTEMPTS: int = 5
    ACCOUNT_LOCKOUT_DURATION_MINUTES: int = 15

    # MFA
    MFA_ISSUER_NAME: str = "Intelli Platform"

    # OAuth2
    OAUTH_GOOGLE_CLIENT_ID: str = ""
    OAUTH_GOOGLE_CLIENT_SECRET: str = ""
    OAUTH_MICROSOFT_CLIENT_ID: str = ""
    OAUTH_MICROSOFT_CLIENT_SECRET: str = ""
    OAUTH_REDIRECT_BASE_URL: str = "http://localhost:8000"

    # API Keys
    API_KEY_PREFIX: str = "intelli_"

    # Rate Limiting
    RATE_LIMIT_GLOBAL_MAX: int = 1000
    RATE_LIMIT_GLOBAL_WINDOW: int = 60
    RATE_LIMIT_LOGIN_MAX: int = 5
    RATE_LIMIT_LOGIN_WINDOW: int = 60
    RATE_LIMIT_REGISTER_MAX: int = 3
    RATE_LIMIT_REGISTER_WINDOW: int = 60

    # Sessions
    SESSION_MAX_AGE_SECONDS: int = 604800  # 7 days

    # Encryption (if needed)
    ENCRYPTION_MASTER_KEY: str = ""
    ENCRYPTION_FALLBACK_KEYS: str = ""
    ENCRYPTION_KEY_VERSION: str = "v1"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Storage
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "intelli"

    # AI / LLM
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # Vector DB (Pinecone)
    PINECONE_API_KEY: str = ""
    PINECONE_ENVIRONMENT: str = ""  # e.g. "us-east-1"
    PINECONE_INDEX_NAME: str = "intelli-default"
    VECTOR_DB_PROVIDER: str = "memory"  # "pinecone" | "memory"
    VECTOR_EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"  # sentence-transformers model
    VECTOR_EMBEDDING_DIMENSION: int = 384  # dimension for all-MiniLM-L6-v2

    # Pinecone (for agent self-learning) — reuses PINECONE_API_KEY above
    PINECONE_AGENT_INDEX: str = "agent-outcomes"

    # Product modules
    ENABLE_DEPOT_MODULES: bool = True
    ENABLE_STREAM_MODULES: bool = False

    # Agent Confidence & Fallback
    CONFIDENCE_DEFAULT_THRESHOLD: float = 0.7

    # Celery (async task dispatch — optional)
    CELERY_BROKER_URL: str = ""

    # Email / SMTP
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@intelli.ai"
    SMTP_USE_TLS: bool = False

    # Notifications
    NOTIFICATION_WEBHOOK_TIMEOUT: int = 10
    NOTIFICATION_WEBHOOK_RETRIES: int = 3
    NOTIFICATION_QUIET_HOURS_ENABLED: bool = True

    @field_validator("DEBUG", mode="before")
    @classmethod
    def normalize_debug(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"dev", "debug", "development"}:
                return True
        return value

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
