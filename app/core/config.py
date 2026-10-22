import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load .env file (project root)
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(_ROOT, ".env"))
load_dotenv()

# OpenAI / LLM settings (optional for UI Loom — chat needs a real backend)
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o")
DEVELOPER_MODEL = os.environ.get("DEVELOPER_MODEL", "False").lower() in ("true", "1", "yes")
IS_TESTING_MODE = os.environ.get("IS_TESTING_MODE", "False").lower() in ("true", "1", "yes")

# Database — default SQLite for zero-setup local Loom demos
# Override with MySQL/Postgres via DB_ENGINE + DB_* or DATABASE_URL
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
DB_ENGINE = os.environ.get("DB_ENGINE", "sqlite").strip()
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "password")
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "3306")
DB_NAME = os.environ.get("DB_NAME") or os.environ.get("DB_Name", "chatai_db")
DB_PATH = os.environ.get("DB_PATH", os.path.join(_ROOT, "chatai_local.db"))

if DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = DATABASE_URL
elif DB_ENGINE.startswith("sqlite"):
    # Absolute path so uvicorn cwd does not matter
    abs_path = DB_PATH if os.path.isabs(DB_PATH) else os.path.join(_ROOT, DB_PATH)
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{abs_path}"
else:
    SQLALCHEMY_DATABASE_URL = (
        f"{DB_ENGINE}://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

_connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=os.environ.get("SQL_ECHO", "False").lower() in ("true", "1", "yes"),
    future=True,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


PIPE = None


def _init_llm_pipe():
    """Lazy LLM init so the web UI boots without Ollama/OpenAI installed."""
    global PIPE, LLM_MODEL
    if PIPE is not None:
        return PIPE
    if IS_TESTING_MODE:
        import requests

        def fastapi_llm_pipe(model, messages, max_new_tokens=5000, use_pipeline=False):
            url = os.environ.get(
                "TEST_LLM_URL",
                "https://land-auckland-them-each.trycloudflare.com/chat",
            )
            payload = {
                "messages": messages,
                "max_new_tokens": max_new_tokens,
                "use_pipeline": use_pipeline,
            }
            response = requests.post(url, json=payload)
            response.raise_for_status()
            return response.json()

        PIPE = fastapi_llm_pipe
    elif DEVELOPER_MODEL:
        try:
            from ollama import chat

            PIPE = chat
            LLM_MODEL = os.environ.get("LLM_MODEL", "llama3.2:1B")
        except Exception as exc:
            print(f"[ChatAI] Ollama unavailable ({exc}); chat will fail until configured.")
            PIPE = None
    elif OPENAI_API_KEY:
        try:
            from openai import OpenAI

            CLIENT = OpenAI(api_key=OPENAI_API_KEY)
            PIPE = CLIENT.chat.completions.create
        except Exception as exc:
            print(f"[ChatAI] OpenAI unavailable ({exc}); chat will fail until configured.")
            PIPE = None
    else:
        print(
            "[ChatAI] No LLM configured (set OPENAI_API_KEY or DEVELOPER_MODEL=True). "
            "UI / admin / dashboard still work."
        )
        PIPE = None
    return PIPE


# Keep attribute access compatible with chatbot_service (`config.PIPE`)
class _PipeProxy:
    def __call__(self, *args, **kwargs):
        pipe = _init_llm_pipe()
        if pipe is None:
            raise RuntimeError(
                "No LLM configured. Set OPENAI_API_KEY or DEVELOPER_MODEL=True with Ollama."
            )
        return pipe(*args, **kwargs)


PIPE = _PipeProxy()

FRONTEND_HOST = os.environ.get("FRONTEND_HOST", None)
