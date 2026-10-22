# ChatAI — local Loom setup

Portugal/SaaS chatbot demo that runs fully locally with **SQLite sample data** (not static HTML). Anyone can clone → install → seed → record a Loom.

App: http://127.0.0.1:8059  

## Prerequisites

- Python 3.10+ (tested with 3.13)
- No MySQL required for the default Loom path (SQLite file `chatai_local.db`)

## Quick start

```bash
cd chatai   # or: cd /path/to/local-projects/chatai

python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

pip install -r requirements-loom.txt
cp .env.example .env       # already SQLite-ready

python scripts/seed_demo.py

uvicorn app.main:app --reload --host 127.0.0.1 --port 8059
```

Open http://127.0.0.1:8059

## Demo logins

Password for all accounts: **`DemoPass1!`**

| Role | Email | After login |
|------|-------|-------------|
| Admin | `admin@chatai.example` | `/admin` — users, tenants, chatbots |
| Business user | `ana@acme.example` | `/dashboard` — Acme profile, chatbot, FAQ doc |

Seed also creates:

- Business profile **Acme Portugal Realty**
- Chatbot **Acme Website Assistant** + suggested questions + style
- Sample FAQ file under `uploads/demo/acme-faq.txt`

Re-run seed anytime (idempotent upserts):

```bash
python scripts/seed_demo.py
```

## Loom walkthrough (suggested)

1. Home → Login as Ana → Dashboard (business + chatbot list)  
2. Open chatbot settings / suggestions  
3. Logout → Login as Admin → Admin panel (users & tenants)  
4. (Optional) Show embed script from README if recording widget flow  

Live AI replies need `OPENAI_API_KEY` or Ollama (`DEVELOPER_MODEL=True`). UI, auth, admin, and CRUD work without an LLM.

## Environment

See `.env.example`. Important keys:

| Key | Default (Loom) | Notes |
|-----|----------------|-------|
| `DB_ENGINE` | `sqlite` | Use `mysql+pymysql` / Postgres via `DATABASE_URL` if preferred |
| `DB_PATH` | `chatai_local.db` | SQLite file in project root |
| `SECRET_KEY` | set in `.env` | JWT signing |
| `OPENAI_API_KEY` | empty | Optional for chat |
| `DEVELOPER_MODEL` | `False` | `True` = Ollama |

## MySQL / Postgres (optional)

```env
DB_ENGINE=mysql+pymysql
DB_USER=root
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chatai_db
```

Or:

```env
DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/chatai_db
```

Then create the DB, run migrations if you use Alembic (`python app/main.py makemigrations` / `migrate`), and seed.

## Full dependency set

`requirements.txt` includes ChromaDB / RAG stack. Prefer `requirements-loom.txt` for demos unless you need document embeddings + live RAG chat.

## Notes

- Do **not** commit `.env` or `chatai_local.db` (gitignored).
- Port **8059** avoids clashing with Private Market (2059 / 3059).
