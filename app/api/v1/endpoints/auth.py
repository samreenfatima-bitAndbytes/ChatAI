# Placeholder for authentication endpoints 

from fastapi import APIRouter, Depends, HTTPException, Query, Body, Cookie, Response, Security
from sqlalchemy.orm import Session
from app.core.config import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token, is_strong_password, get_current_user_from_cookie, get_current_user_from_cookie_optional, admin_required
from app.models.tenant import BusinessProfile
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

router = APIRouter()

RESET_TOKEN_EXPIRE_MINUTES = 30
reset_tokens = {}  # For demo only: {token: user_id}

@router.post("/register", response_model=UserRead)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    if not is_strong_password(user.password):
        raise HTTPException(status_code=400, detail="Password is not strong enough")
    business_name = user.full_name or user.email
    new_profile = BusinessProfile(name=business_name, settings={})
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    business_profile_id = new_profile.id
    hashed_password = hash_password(user.password)
    new_user = User(email=user.email, hashed_password=hashed_password, full_name=user.full_name, business_profile_id=business_profile_id)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/logout", name="auth.logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"msg": "Logged out"}

@router.post("/login")
def login(user: UserCreate, response: Response, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": db_user.email, "user_id": db_user.id})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60*60*24*7
    )
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserRead)
def get_me(token: str = Query(...), db: Session = Depends(get_db)):
    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/user/all", response_model=List[UserRead])
def get_all_users(db: Session = Depends(get_db), admin: User = Depends(admin_required)):
    return db.query(User).all()

@router.get("/user/{user_id}", response_model=UserRead)
def get_user_by_id(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/forgot-password")
def forgot_password(email: str = Body(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # For security, don't reveal if user exists
        return {"msg": "If this email exists, a reset link has been sent."}
    expire = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    token_data = {"user_id": user.id, "exp": expire.timestamp()}
    token = create_access_token(token_data)
    reset_tokens[token] = user.id  # For demo only
    # In production, send email with link containing token
    return {"msg": "Reset link generated.", "reset_link": f"/reset-password?token={token}", "token": token}

@router.post("/reset-password")
def reset_password(token: str = Body(...), new_password: str = Body(...), db: Session = Depends(get_db)):
    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        exp = payload.get("exp")
        if not user_id or not exp or datetime.utcnow().timestamp() > exp:
            raise HTTPException(status_code=400, detail="Invalid or expired token")
        if token not in reset_tokens or reset_tokens[token] != user_id:
            raise HTTPException(status_code=400, detail="Invalid or expired token")
        if not is_strong_password(new_password):
            raise HTTPException(status_code=400, detail="Password is not strong enough")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.hashed_password = hash_password(new_password)
        db.commit()
        del reset_tokens[token]
        return {"msg": "Password reset successful."}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

@router.put("/user/{user_id}", response_model=UserRead)
def update_user_by_admin(user_id: str, user_update: UserUpdate, db: Session = Depends(get_db), admin: User = Depends(admin_required)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_update.full_name is not None:
        db_user.full_name = user_update.full_name
    if user_update.email is not None:
        db_user.email = user_update.email
    if user_update.password:
        if not is_strong_password(user_update.password):
            raise HTTPException(status_code=400, detail="Password too weak")
        db_user.hashed_password = hash_password(user_update.password)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/user/{user_id}")
def delete_user_by_admin(user_id: str, db: Session = Depends(get_db), admin: User = Depends(admin_required)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(db_user)
    db.commit()
    return {"msg": "User deleted"} 