"""
Intelli Platform - Security & Data Encryption Router
Feature: SEC-6.22
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth.dependencies import get_current_user
from app.core.auth.encryption import encryption_service
from app.shared.models.user import User

router = APIRouter(prefix="/api/v1/security", tags=["Security"])


class EncryptionRequest(BaseModel):
    plaintext: str = Field(min_length=1)
    context: str | None = None


class DecryptionRequest(BaseModel):
    ciphertext: str = Field(min_length=1)
    context: str | None = None


class EncryptionResponse(BaseModel):
    ciphertext: str
    algorithm: str
    key_version: str


class DecryptionResponse(BaseModel):
    plaintext: str


class KeyInfoResponse(BaseModel):
    algorithm: str
    key_version: str
    fingerprint: str
    rotation_ready: bool


@router.get("/keys", response_model=KeyInfoResponse)
async def get_key_info(current_user: User = Depends(get_current_user)):
    return encryption_service.active_key_info()


@router.post("/encrypt", response_model=EncryptionResponse)
async def encrypt_payload(
    body: EncryptionRequest,
    current_user: User = Depends(get_current_user),
):
    ciphertext = encryption_service.encrypt(body.plaintext, associated_data=body.context)
    info = encryption_service.active_key_info()
    return EncryptionResponse(
        ciphertext=ciphertext,
        algorithm=info["algorithm"],
        key_version=info["key_version"],
    )


@router.post("/decrypt", response_model=DecryptionResponse)
async def decrypt_payload(
    body: DecryptionRequest,
    current_user: User = Depends(get_current_user),
):
    plaintext = encryption_service.decrypt(body.ciphertext, associated_data=body.context)
    return DecryptionResponse(plaintext=plaintext)
