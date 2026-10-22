from sqlalchemy import Column, String, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.core.config import Base
from datetime import datetime
import uuid
from app.core.db_types import GUID

class BusinessProfile(Base):
    __tablename__ = "business_profiles"
    id = Column(GUID(), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), unique=True, nullable=False)
    settings = Column(JSON, default={})

    users = relationship("User", back_populates="business_profile")
    chatbots = relationship("Chatbot", back_populates="business_profile")
    documents = relationship("BusinessDocument", back_populates="business_profile", cascade="all, delete-orphan")

class BusinessDocument(Base):
    __tablename__ = "business_documents"
    id = Column(GUID(), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    business_profile_id = Column(GUID(), ForeignKey("business_profiles.id"), nullable=False)
    type = Column(String(50), nullable=False)  # e.g., 'faq', 'product_list', 'policy', etc.
    filename = Column(String(255), nullable=True)
    url = Column(String(1024), nullable=True)  # For links
    storage_path = Column(String(1024), nullable=True)  # For uploaded files
    extracted_data = Column(JSON, default={})  # Parsed/structured data
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    business_profile = relationship("BusinessProfile", back_populates="documents") 