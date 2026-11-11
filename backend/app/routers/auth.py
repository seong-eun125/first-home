from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import User
from ..schemas import LoginIn, SignupIn, UserOut
from ..security import COOKIE_NAME, create_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _set_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        COOKIE_NAME,
        create_token(user_id),
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=settings.jwt_expire_hours * 3600,
        path="/",
    )


@router.post("/signup", response_model=UserOut, status_code=201)
def signup(body: SignupIn, response: Response, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "이미 가입된 이메일입니다.")
    user = User(email=email, password_hash=hash_password(body.password), name=body.name.strip())
    db.add(user)
    db.commit()
    _set_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다.")
    _set_cookie(response, user.id)
    return user


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
