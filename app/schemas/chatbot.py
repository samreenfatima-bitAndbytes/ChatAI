from pydantic import BaseModel
from typing import Dict, Any, Optional

class ChatbotBase(BaseModel):
    name: str
    prompt: Optional[str] = None
    settings: Optional[Dict[str, Any]] = {}
    owner_id: Optional[str] = None
    business_profile_id: Optional[str] = None

class ChatbotCreate(ChatbotBase):
    pass

class ChatbotRead(ChatbotBase):
    id: str

    class Config:
        orm_mode = True

class ChatbotSuggestionBase(BaseModel):
    suggestions: Dict[str, str]

class ChatbotSuggestionCreate(ChatbotSuggestionBase):
    chatbot_id: str

class ChatbotSuggestionOut(ChatbotSuggestionBase):
    id: str
    chatbot_id: str
    class Config:
        orm_mode = True

class ChatbotStyleBase(BaseModel):
    style_json: Dict[str, Any]
    class Config:
        orm_mode = True

class ChatbotStyleCreate(ChatbotStyleBase):
    chatbot_id: str
    user_id: str

class ChatbotStyleRead(ChatbotStyleBase):
    id: str
    chatbot_id: str
    user_id: str 