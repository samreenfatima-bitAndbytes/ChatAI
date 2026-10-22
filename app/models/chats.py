from sqlalchemy import Column, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.config import Base
import uuid
from app.core.db_types import GUID

class Chat(Base):
    __tablename__ = "chats"
    id = Column(GUID(), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(GUID(), ForeignKey("users.id"))
    chatbot_id = Column(GUID(), ForeignKey("chatbots.id"))
    message = Column(Text, nullable=False)
    response = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="chats")
    chatbot = relationship("Chatbot", back_populates="chats") 