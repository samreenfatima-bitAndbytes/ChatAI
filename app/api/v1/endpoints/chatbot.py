from fastapi import APIRouter, Depends, HTTPException, Request, Security
from sqlalchemy.orm import Session
from app.core.config import get_db
from app.models.chatbot import Chatbot, ChatbotSuggestion, ChatbotStyle
from app.models.user import User
from app.schemas.chatbot import ChatbotCreate, ChatbotRead, ChatbotSuggestionCreate, ChatbotSuggestionOut, ChatbotStyleCreate, ChatbotStyleRead
from typing import List
from app.core import config
from pydantic import BaseModel
import json
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import os
from app.api.v1.endpoints.auth import get_current_user_from_cookie
from app.services.chatbot_service import ChatbotService
from app.api.deps import get_db
from uuid import UUID
from fastapi import status

router = APIRouter()

templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), '../../../templates'))

@router.get("/view", response_class=HTMLResponse)
def chatbot_view(user_id: str, request: Request):
    # For demo, just render a simple chat UI. You can expand this to load chatbot settings, etc.
    return templates.TemplateResponse("chatbot_view.html", {"request": request, "user_id": user_id})

@router.get("/embed/{user_id}")
def get_embed_link(user_id: str, request: Request, db: Session = Depends(get_db)):
    # Use FRONTEND_HOST from config if set, otherwise fallback to request.base_url
    base_url = config.FRONTEND_HOST.rstrip("/") if config.FRONTEND_HOST else str(request.base_url).rstrip("/")
    return {"embed_link": f"{base_url}/static/js/embed.js?user_id={user_id}"}

@router.post("/", response_model=ChatbotRead)
def create_chatbot(chatbot: ChatbotCreate, db: Session = Depends(get_db)):
    return ChatbotService.create_chatbot(chatbot, db)

@router.get("/", response_model=List[ChatbotRead])
def list_chatbots(business_profile_id: str = None, user_id: str = None, db: Session = Depends(get_db)):
    return ChatbotService.list_chatbots(business_profile_id, user_id, db)

@router.get("/{chatbot_id}", response_model=ChatbotRead)
def get_chatbot(chatbot_id: str, db: Session = Depends(get_db)):
    return ChatbotService.get_chatbot(chatbot_id, db)

@router.put("/{chatbot_id}", response_model=ChatbotRead)
def update_chatbot(chatbot_id: str, chatbot: ChatbotCreate, db: Session = Depends(get_db)):
    return ChatbotService.update_chatbot(chatbot_id, chatbot, db)

class ChatRequest(BaseModel):
    prompt: str
    chatbot_id: str
    user_id: str

@router.post("/chat")
def chat_with_bot(request: ChatRequest, db: Session = Depends(get_db)):
    return ChatbotService.chat_with_bot(request.chatbot_id, request.prompt, request.user_id, db)

def admin_required(user: User = Depends(get_current_user_from_cookie)):
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@router.delete("/{chatbot_id}")
def delete_chatbot_by_admin(chatbot_id: str, db: Session = Depends(get_db), admin: User = Depends(admin_required)):
    return ChatbotService.delete_chatbot(chatbot_id, db)

@router.post("/{chatbot_id}/suggestions", response_model=ChatbotSuggestionOut)
def add_suggestions(chatbot_id: str, suggestion: ChatbotSuggestionCreate, db: Session = Depends(get_db)):
    db_suggestion = db.query(ChatbotSuggestion).filter(ChatbotSuggestion.chatbot_id == chatbot_id).first()
    if db_suggestion:
        db_suggestion.suggestions = suggestion.suggestions
    else:
        db_suggestion = ChatbotSuggestion(chatbot_id=chatbot_id, suggestions=suggestion.suggestions)
        db.add(db_suggestion)
    db.commit()
    db.refresh(db_suggestion)
    # Delete any duplicate suggestions for this chatbot (keep only the latest)
    duplicates = db.query(ChatbotSuggestion).filter(ChatbotSuggestion.chatbot_id == chatbot_id, ChatbotSuggestion.id != db_suggestion.id).all()
    for dup in duplicates:
        db.delete(dup)
    db.commit()
    return db_suggestion

@router.get("/{chatbot_id}/suggestions", response_model=ChatbotSuggestionOut)
def get_suggestions(chatbot_id: str, db: Session = Depends(get_db)):
    suggestion = db.query(ChatbotSuggestion).filter(ChatbotSuggestion.chatbot_id == chatbot_id).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestions not found")
    return suggestion

@router.get("/{chatbot_id}/style", response_model=ChatbotStyleRead)
def get_chatbot_style(chatbot_id: str, user_id: str = None, db: Session = Depends(get_db)):
    # If user_id is not provided, fallback to default style for chatbot
    style = ChatbotService.get_chatbot_style(chatbot_id, user_id, db)
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    return style

@router.post("/{chatbot_id}/style", response_model=ChatbotStyleRead, status_code=status.HTTP_201_CREATED)
def set_chatbot_style(chatbot_id: str, style: ChatbotStyleCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user_from_cookie)):
    # Only allow user to set their own style
    if style.user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Cannot set style for another user")
    style.chatbot_id = chatbot_id
    return ChatbotService.set_chatbot_style(style, db) 