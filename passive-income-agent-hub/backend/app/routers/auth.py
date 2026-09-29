import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import User
from ..security import COOKIE_NAME, create_token, current_user, hash_password, verify_password
from ..serializers import row

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("hub.auth")


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)
    display_name: str = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _set_cookie(resp: Response, user: User) -> None:
    s = get_settings()
    resp.set_cookie(COOKIE_NAME, create_token(user.id), httponly=True, samesite="strict", secure=s.cookie_secure,
                    max_age=s.access_token_minutes * 60, path="/")


@router.get("/status")
def status(db: Session = Depends(get_db)):
    users = db.scalar(select(func.count(User.id))) or 0
    return {"has_users": users > 0, "registration_open": users == 0 or get_settings().allow_registration}


@router.post("/register")
def register(data: RegisterIn, response: Response, db: Session = Depends(get_db)):
    users = db.scalar(select(func.count(User.id))) or 0
    if users > 0 and not get_settings().allow_registration:
        raise HTTPException(403, "El registro está cerrado (ALLOW_REGISTRATION=false).")
    if db.scalar(select(User).where(User.email == data.email.lower())):
        raise HTTPException(409, "Ese correo ya está registrado.")
    user = User(email=data.email.lower(), password_hash=hash_password(data.password), display_name=data.display_name)
    db.add(user)
    db.commit()
    log.info("usuario registrado id=%s", user.id)
    _set_cookie(response, user)
    return row(user)


@router.post("/login")
def login(data: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash):
        log.warning("login fallido para %s", data.email)
        raise HTTPException(401, "Correo o contraseña incorrectos.")
    _set_cookie(response, user)
    return row(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return row(user)
