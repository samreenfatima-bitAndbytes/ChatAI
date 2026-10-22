from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.config import Base
import uuid
from app.core.db_types import GUID

class User(Base):
    __tablename__ = "users"
    id = Column(GUID(), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    business_profile_id = Column(GUID(), ForeignKey("business_profiles.id"))

    business_profile = relationship("BusinessProfile", back_populates="users")
    chatbots = relationship("Chatbot", back_populates="owner")
    chats = relationship("Chat", back_populates="user") 