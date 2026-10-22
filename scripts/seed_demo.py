#!/usr/bin/env python3
"""
Seed Loom-ready demo users, business profile, chatbot, and a sample FAQ doc.

Usage (from repo root, venv active):
  python scripts/seed_demo.py
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

from dotenv import load_dotenv

load_dotenv(os.path.join(ROOT, ".env"))

from app.core.config import Base, SessionLocal, engine, SQLALCHEMY_DATABASE_URL
import app.models  # noqa: F401 — register tables
from app.models.user import User
from app.models.tenant import BusinessProfile, BusinessDocument
from app.models.chatbot import Chatbot, ChatbotSuggestion, ChatbotStyle
from app.core.security import hash_password

DEMO_PASSWORD = "DemoPass1!"

ADMIN_EMAIL = "admin@chatai.example"
AGENT_EMAIL = "ana@acme.example"


def ensure_tables():
    print(f"DB: {SQLALCHEMY_DATABASE_URL}")
    Base.metadata.create_all(bind=engine)
    print("Tables ready.")


def upsert_profile(db, name: str, settings: dict) -> BusinessProfile:
    profile = db.query(BusinessProfile).filter(BusinessProfile.name == name).first()
    if profile:
        profile.settings = settings
        return profile
    profile = BusinessProfile(name=name, settings=settings)
    db.add(profile)
    db.flush()
    return profile


def upsert_user(
    db,
    *,
    email: str,
    full_name: str,
    is_admin: bool,
    profile: BusinessProfile,
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.full_name = full_name
        user.is_admin = is_admin
        user.is_active = True
        user.business_profile_id = profile.id
        user.hashed_password = hash_password(DEMO_PASSWORD)
        return user
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(DEMO_PASSWORD),
        is_admin=is_admin,
        is_active=True,
        business_profile_id=profile.id,
    )
    db.add(user)
    db.flush()
    return user


def seed():
    ensure_tables()
    db = SessionLocal()
    try:
        # Drop obsolete demo emails from earlier seeds
        for stale in ("admin@chatai.local", "ana@acme.local"):
            old = db.query(User).filter(User.email == stale).first()
            if old:
                db.query(Chatbot).filter(Chatbot.owner_id == old.id).delete()
                db.delete(old)

        admin_profile = upsert_profile(
            db,
            "ChatAI Platform",
            {"theme": "admin", "tagline": "Platform administration"},
        )
        acme_profile = upsert_profile(
            db,
            "Acme Portugal Realty",
            {
                "industry": "real_estate",
                "locale": "pt-PT",
                "support_email": "hello@acme.example",
            },
        )
        db.flush()

        admin = upsert_user(
            db,
            email=ADMIN_EMAIL,
            full_name="Samreen Admin",
            is_admin=True,
            profile=admin_profile,
        )
        ana = upsert_user(
            db,
            email=AGENT_EMAIL,
            full_name="Ana Costa",
            is_admin=False,
            profile=acme_profile,
        )
        db.flush()

        bots = (
            db.query(Chatbot)
            .filter(
                Chatbot.business_profile_id == acme_profile.id,
                Chatbot.name == "Acme Website Assistant",
            )
            .all()
        )
        bot = None
        for existing in bots:
            if existing.owner_id == ana.id and bot is None:
                bot = existing
            else:
                db.query(ChatbotSuggestion).filter(
                    ChatbotSuggestion.chatbot_id == existing.id
                ).delete()
                db.query(ChatbotStyle).filter(
                    ChatbotStyle.chatbot_id == existing.id
                ).delete()
                db.delete(existing)
        if not bot:
            bot = Chatbot(
                name="Acme Website Assistant",
                prompt=(
                    "You are Acme Portugal Realty's helpful website assistant. "
                    "Answer politely about listings, viewings, and office hours. "
                    "If unsure, ask the visitor to leave contact details."
                ),
                settings={"welcome": "Olá! How can we help you find a home?"},
                owner_id=ana.id,
                business_profile_id=acme_profile.id,
            )
            db.add(bot)
            db.flush()
        else:
            bot.owner_id = ana.id
            bot.business_profile_id = acme_profile.id

        sug = (
            db.query(ChatbotSuggestion)
            .filter(ChatbotSuggestion.chatbot_id == bot.id)
            .first()
        )
        if not sug:
            db.add(
                ChatbotSuggestion(
                    chatbot_id=bot.id,
                    suggestions={
                        "q1": "What areas do you cover?",
                        "q2": "How do I book a viewing?",
                        "q3": "What documents do I need to rent?",
                    },
                )
            )

        style = (
            db.query(ChatbotStyle)
            .filter(
                ChatbotStyle.chatbot_id == bot.id,
                ChatbotStyle.user_id == ana.id,
            )
            .first()
        )
        if not style:
            db.add(
                ChatbotStyle(
                    chatbot_id=bot.id,
                    user_id=ana.id,
                    style_json={
                        "primaryColor": "#004AAD",
                        "position": "bottom-right",
                        "bubbleText": "Chat with Acme",
                    },
                )
            )

        uploads = os.path.join(ROOT, "uploads", "demo")
        os.makedirs(uploads, exist_ok=True)
        faq_path = os.path.join(uploads, "acme-faq.txt")
        if not os.path.exists(faq_path):
            with open(faq_path, "w", encoding="utf-8") as f:
                f.write(
                    "Acme Portugal Realty FAQ\n"
                    "========================\n"
                    "Q: Office hours?\n"
                    "A: Mon–Fri 9:00–18:00, Lisboa Chiado.\n\n"
                    "Q: Viewing fee?\n"
                    "A: Viewings are free for registered buyers.\n\n"
                    "Q: Contact?\n"
                    "A: hello@acme.example\n"
                )

        doc = (
            db.query(BusinessDocument)
            .filter(
                BusinessDocument.business_profile_id == acme_profile.id,
                BusinessDocument.filename == "acme-faq.txt",
            )
            .first()
        )
        if not doc:
            db.add(
                BusinessDocument(
                    business_profile_id=acme_profile.id,
                    type="faq",
                    filename="acme-faq.txt",
                    storage_path=faq_path,
                    extracted_data={
                        "preview": "Office hours Mon–Fri 9–18; free viewings; hello@acme.example"
                    },
                )
            )

        db.commit()
        print("")
        print("Seed complete.")
        print("Demo logins (password for all: DemoPass1!):")
        print(f"  Admin : {ADMIN_EMAIL}  → /admin")
        print(f"  User  : {AGENT_EMAIL}  → /dashboard")
        print(f"  Chatbot: {bot.name} (id={bot.id})")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
