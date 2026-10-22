from sqlalchemy import Column, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.config import Base
import uuid
from app.core.db_types import GUID

class Chatbot(Base):
    __tablename__ = "chatbots"
    id = Column(GUID(), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    prompt = Column(String(2048))
    settings = Column(JSON, default={})
    owner_id = Column(GUID(), ForeignKey("users.id"))
    business_profile_id = Column(GUID(), ForeignKey("business_profiles.id"))

    owner = relationship("User", back_populates="chatbots")
    business_profile = relationship("BusinessProfile", back_populates="chatbots")
    chats = relationship("Chat", back_populates="chatbot")
    suggestions = relationship("ChatbotSuggestion", back_populates="chatbot", cascade="all, delete-orphan")

class ChatbotSuggestion(Base):
    __tablename__ = "chatbot_suggestions"
    id = Column(GUID(), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    chatbot_id = Column(GUID(), ForeignKey("chatbots.id"), nullable=False)
    suggestions = Column(JSON, nullable=False)  # e.g., {"question1": "What is your name?", ...}
    chatbot = relationship("Chatbot", back_populates="suggestions")

class ChatbotStyle(Base):
    __tablename__ = "chatbot_styles"
    id = Column(GUID(), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    chatbot_id = Column(GUID(), ForeignKey("chatbots.id"), nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    style_json = Column(JSON, nullable=False, default={})

    chatbot = relationship("Chatbot", backref="styles")
    user = relationship("User") 