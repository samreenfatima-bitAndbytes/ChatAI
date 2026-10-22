from sqlalchemy.orm import Session
from app.models.chatbot import Chatbot, ChatbotStyle
from app.schemas.chatbot import ChatbotCreate, ChatbotStyleCreate
from app.core import config
from fastapi import HTTPException
import json
import os

# Optional RAG stack (chromadb / tiktoken) — not required for Loom UI
try:
    import chromadb
    from chromadb.config import Settings
    from chromadb.utils import embedding_functions
except Exception:  # pragma: no cover
    chromadb = None
    Settings = None
    embedding_functions = None

try:
    import tiktoken
except Exception:  # pragma: no cover
    tiktoken = None

class ChatbotService:
    @staticmethod
    def create_chatbot(chatbot_data: ChatbotCreate, db: Session) -> Chatbot:
        db_chatbot = Chatbot(**chatbot_data.dict())
        db.add(db_chatbot)
        db.commit()
        db.refresh(db_chatbot)
        return db_chatbot

    @staticmethod
    def list_chatbots(business_profile_id: str = None, user_id: str = None, db: Session = None):
        query = db.query(Chatbot)
        if business_profile_id is not None:
            query = query.filter(Chatbot.business_profile_id == business_profile_id)
        if user_id is not None:
            query = query.filter(Chatbot.owner_id == user_id)
        return query.all()

    @staticmethod
    def get_chatbot(chatbot_id: str, db: Session) -> Chatbot:
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not chatbot:
            raise HTTPException(status_code=404, detail="Chatbot not found")
        return chatbot

    @staticmethod
    def update_chatbot(chatbot_id: str, chatbot_data: ChatbotCreate, db: Session) -> Chatbot:
        db_chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not db_chatbot:
            raise HTTPException(status_code=404, detail="Chatbot not found")
        for key, value in chatbot_data.dict().items():
            setattr(db_chatbot, key, value)
        db.commit()
        db.refresh(db_chatbot)
        return db_chatbot

    @staticmethod
    def delete_chatbot(chatbot_id: str, db: Session):
        db_chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not db_chatbot:
            raise HTTPException(status_code=404, detail="Chatbot not found")
        db.delete(db_chatbot)
        db.commit()
        return {"msg": "Chatbot deleted"}

    @staticmethod
    def chat_with_bot(chatbot_id: str, user_prompt: str, user_id: str, db: Session):
        pipe = config.PIPE
        llm_model = config.LLM_MODEL
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not chatbot:
            raise HTTPException(status_code=404, detail="Chatbot not found")
        # System role: define the bot's role and context
        system_message = chatbot.prompt or "You are a helpful AI assistant."
        # RAG: Retrieve relevant context chunks from Chroma
        context_chunks = retrieve_relevant_chunks(user_id, user_prompt, top_k=5)
        context_text = '\n---\n'.join(context_chunks) if context_chunks else ''
        # Compose messages with context
        messages = [
            {"role": "system", "content": system_message},
        ]
        if context_text:
            messages.append({"role": "system", "content": f"Relevant business info:\n{context_text}"})
        messages.append({"role": "user", "content": user_prompt})
        try:
            if config.IS_TESTING_MODE:
                response = pipe(
                    model=llm_model,
                    messages=messages,
                    max_new_tokens=100,
                    use_pipeline=False
                )
                # Assume response is already a dict with the answer
                return response
            else:
                response = pipe(
                    model=llm_model,
                    messages=messages
                )
                if hasattr(response, 'message') and hasattr(response.message, 'content'):
                    content = response.message.content
                elif isinstance(response, dict) and 'message' in response:
                    content = response['message']['content']
                else:
                    content = str(response)
                try:
                    return json.loads(content)
                except Exception:
                    return {"response": content}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @staticmethod
    def get_chatbot_style(chatbot_id: str, user_id: str, db: Session):
        style = db.query(ChatbotStyle).filter_by(chatbot_id=chatbot_id, user_id=user_id).first()
        if style:
            return style
        # Fallback to default: first style for chatbot, or None
        default_style = db.query(ChatbotStyle).filter_by(chatbot_id=chatbot_id).first()
        return default_style

    @staticmethod
    def set_chatbot_style(style_data: ChatbotStyleCreate, db: Session):
        style = db.query(ChatbotStyle).filter_by(chatbot_id=style_data.chatbot_id, user_id=style_data.user_id).first()
        if style:
            style.style_json = style_data.style_json
        else:
            style = ChatbotStyle(**style_data.dict())
            db.add(style)
        db.commit()
        db.refresh(style)
        return style

CHROMA_DIR = "chroma_db"
_chroma_client = None
_embedding_fn = None


def _get_chroma():
    """Lazy Chroma client — skips RAG when chromadb is not installed."""
    global _chroma_client, _embedding_fn
    if chromadb is None:
        return None, None
    if _chroma_client is None:
        _chroma_client = chromadb.Client(Settings(persist_directory=CHROMA_DIR))
        if config.DEVELOPER_MODEL:
            _embedding_fn = embedding_functions.DefaultEmbeddingFunction()
        else:
            _embedding_fn = embedding_functions.OpenAIEmbeddingFunction(
                api_key=os.getenv("OPENAI_API_KEY")
            )
    return _chroma_client, _embedding_fn


def chunk_text(text, max_tokens=500):
    # Use tiktoken to count tokens if available, else fallback to words
    try:
        if tiktoken is None:
            raise RuntimeError("tiktoken not installed")
        enc = tiktoken.encoding_for_model("gpt-3.5-turbo")
        tokens = enc.encode(text)
        chunks = []
        for i in range(0, len(tokens), max_tokens):
            chunk = enc.decode(tokens[i : i + max_tokens])
            chunks.append(chunk)
        return chunks
    except Exception:
        # Fallback: split by words
        words = text.split()
        return [
            " ".join(words[i : i + max_tokens])
            for i in range(0, len(words), max_tokens)
        ]


def process_and_store_document(doc, user_id):
    # doc: BusinessDocument instance
    client, embedding_fn = _get_chroma()
    if client is None:
        return
    extracted = doc.extracted_data or {}
    if extracted.get("text"):
        chunks = chunk_text(extracted["text"])
    elif extracted.get("rows"):
        rows = extracted["rows"]
        text = "\n".join([", ".join(row) for row in rows])
        chunks = chunk_text(text)
    else:
        return
    collection_name = f"user_{user_id}_docs"
    collection = client.get_or_create_collection(
        collection_name, embedding_function=embedding_fn
    )
    metadatas = [
        {"user_id": user_id, "doc_id": doc.id, "chunk_id": i}
        for i in range(len(chunks))
    ]
    ids = [f"doc{doc.id}_chunk{i}" for i in range(len(chunks))]
    collection.add(documents=chunks, metadatas=metadatas, ids=ids)


def retrieve_relevant_chunks(user_id, query, top_k=5):
    client, embedding_fn = _get_chroma()
    if client is None:
        return []
    try:
        collection_name = f"user_{user_id}_docs"
        collection = client.get_or_create_collection(
            collection_name, embedding_function=embedding_fn
        )
        results = collection.query(query_texts=[query], n_results=top_k)
        return [doc for doc in results["documents"][0]]
    except Exception:
        return [] 