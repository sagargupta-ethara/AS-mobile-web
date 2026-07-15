"""User model + role enum. UUID string ids for clean JSON round-trip."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    TASKER = "tasker"


class UserBase(BaseModel):
    email: str
    full_name: str
    role: UserRole
    is_active: bool = True


class UserCreate(UserBase):
    password: str


class UserPublic(UserBase):
    """User shape returned to clients — never includes the password hash."""
    model_config = ConfigDict(extra="ignore")
    id: str


class UserInDB(UserBase):
    """Internal DB representation."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_mongo(self) -> dict:
        doc = self.model_dump()
        doc["role"] = doc["role"].value if isinstance(doc["role"], UserRole) else doc["role"]
        doc["created_at"] = doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"]
        doc["updated_at"] = doc["updated_at"].isoformat() if isinstance(doc["updated_at"], datetime) else doc["updated_at"]
        return doc

    @classmethod
    def from_mongo(cls, doc: dict) -> "UserInDB":
        d = dict(doc)
        d.pop("_id", None)
        return cls(**d)

    def public(self) -> UserPublic:
        return UserPublic(id=self.id, email=self.email, full_name=self.full_name, role=self.role, is_active=self.is_active)


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
