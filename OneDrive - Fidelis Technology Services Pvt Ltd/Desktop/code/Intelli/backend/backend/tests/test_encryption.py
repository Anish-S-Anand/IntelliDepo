"""
Tests for SEC-6.22: Security & Data Encryption
"""
import base64
import os
from types import SimpleNamespace

import pytest

from app.core.auth.dependencies import get_current_user
from app.core.auth.encryption import EncryptionService
from app.main import app


def test_encrypt_decrypt_roundtrip():
    service = EncryptionService(
        current_key=base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8")
    )
    ciphertext = service.encrypt("top-secret", associated_data="customer:42")
    assert ciphertext.startswith("v1.")
    assert service.decrypt(ciphertext, associated_data="customer:42") == "top-secret"


def test_rotation_uses_new_version():
    old_key = base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8")
    new_key = base64.urlsafe_b64encode(os.urandom(32)).decode("utf-8")
    old_service = EncryptionService(current_version="v1", current_key=old_key)
    ciphertext = old_service.encrypt("rotate-me")

    new_service = EncryptionService(
        current_version="v2",
        current_key=new_key,
        fallback_keys=f"v1:{old_key}",
    )
    rotated = new_service.rotate(ciphertext)
    assert rotated.startswith("v2.")
    assert new_service.decrypt(rotated) == "rotate-me"


@pytest.mark.asyncio
async def test_encryption_endpoints(client):
    async def override_current_user():
        return SimpleNamespace(
            email="security@example.com",
            full_name="Security Tester",
            is_active=True,
            is_superuser=False,
            roles=[],
        )

    app.dependency_overrides[get_current_user] = override_current_user
    try:
        encrypt_response = await client.post(
            "/api/v1/security/encrypt",
            json={"plaintext": "classified", "context": "doc:1"},
        )
        assert encrypt_response.status_code == 200
        ciphertext = encrypt_response.json()["ciphertext"]

        decrypt_response = await client.post(
            "/api/v1/security/decrypt",
            json={"ciphertext": ciphertext, "context": "doc:1"},
        )
        assert decrypt_response.status_code == 200
        assert decrypt_response.json()["plaintext"] == "classified"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
