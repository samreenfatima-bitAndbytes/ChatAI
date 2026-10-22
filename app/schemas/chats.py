from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ChatBase(BaseModel):
    user_id: str
    chatbot_id: str
    message: str
    response: Optional[str] = None
    timestamp: Optional[datetime] = None

class ChatCreate(ChatBase):
    pass

class ChatRead(ChatBase):
    id: str

    class Config:
        orm_mode = True 