# ChatAI: SaaS Chatbot-as-a-Service Platform

## Overview
ChatAI is a SaaS platform that enables businesses to create, customize, and embed AI-powered chatbots on their websites with minimal setup. Each business can manage its own chatbots, settings, and prompts, upload business documents, and easily integrate the chatbot widget using a simple JavaScript API.

## Features
- **Multi-Tenant Support:** Each business (tenant) has isolated chatbot configurations and data.
- **User Authentication:** Secure signup and login for business users.
- **Admin Panel:** Admin users can view and manage all users, chatbots, and business profiles from a modern web UI.
- **User Dashboard:** Regular users can manage their business settings, chatbots, and business documents from a dedicated dashboard.
- **User Roles:** Users can be marked as admins (`is_admin` field). Admins have access to the admin panel and can manage all data.
- **Chatbot Management:** Create, update, and manage multiple chatbots per business, including custom prompts and suggested questions.
- **Business Document Management:** Upload, preview, and manage business documents (FAQ, product lists, policies, etc.) per business profile.
- **Custom Prompts & Settings:** Businesses can define chatbot behavior and appearance.
- **Embeddable Widget:** Simple JS API to embed the chatbot on any website.
- **RESTful API:** FastAPI-powered backend for all operations.
- **Automated Migrations:** Easy commands to generate and apply database migrations.
- **Modern UI:** Responsive dashboard and admin panel built with Tailwind CSS.

## Project Structure
```
ChatAI/
  api/
    index.py
  app/
    main.py
    api/
      v1/
        endpoints/
          auth.py
          chatbot.py
          tenant.py
    core/
      config.py
      security.py
    models/
      user.py
      tenant.py
      chatbot.py
      chats.py
    schemas/
      user.py
      tenant.py
      chatbot.py
      chats.py
    services/
      chatbot_service.py
    static/
      js/
        embed.js
        ...
    templates/
      admin_panel.html
      chatbot_view.html
      dashboard.html
      login.html
      signup.html
      ...
  migrations/
  README.md
  requirements.txt
  test.html
  uploads/
  vercel.json
```

## Local Loom demo (recommended)

See **[LOCAL_SETUP.md](./LOCAL_SETUP.md)** for SQLite seed data, demo logins, and run commands.

Quick path (no MySQL required):

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements-loom.txt
cp .env.example .env
python scripts/seed_demo.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8059
```

- App: http://127.0.0.1:8059  
- Admin: `admin@chatai.example` / `DemoPass1!`  
- User: `ana@acme.example` / `DemoPass1!`

## Getting Started (full stack)
1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd ChatAI
   ```
2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   # On Unix/Mac:
   source venv/bin/activate
   # On Windows:
   venv\Scripts\activate
   ```
3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   # or lean Loom deps: pip install -r requirements-loom.txt
   ```
4. **Configure your environment:**
   Copy `.env.example` to `.env`. Default Loom path uses SQLite. For MySQL:
   ```env
   OPENAI_API_KEY=your_openai_key
   LLM_MODEL=gpt-4o
   DEVELOPER_MODEL=False
   DB_ENGINE=mysql+pymysql
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=chatai_db
   SECRET_KEY=your_secret_key
   ```

## Database Migrations

### Initialize and Apply Migrations
1. **Create migration scripts (autogenerate):**
   ```bash
   python app/main.py makemigrations --message "init"
   ```
   - This will initialize Alembic if needed, set up the correct config, and generate migration scripts based on your models.

2. **Apply migrations to the database:**
   ```bash
   python app/main.py migrate
   ```
   - This will apply all migrations to your MySQL database.

### Resetting Migrations (Development Only)
If you want to start fresh:
- Delete the `migrations/` folder and `alembic.ini`.
- Drop the `alembic_version` table in your database:
  ```sql
  DROP TABLE IF EXISTS alembic_version;
  ```
- Run the `makemigrations` and `migrate` commands again.

## User & Admin Login Flow
- **Login:** `/login` (email & password)
- **Sign Up:** `/signup` (email, password, full name)
- **Login Redirects:**
  - If the user is an admin, they are redirected to `/admin?user_id=<id>`
  - If the user is not an admin, they are redirected to `/dashboard?user_id=<id>`

## User Dashboard
- **Access:** `/dashboard?user_id=<user_id>`
- **Features:**
  - View and edit business settings (name, settings JSON)
  - View, create, and edit chatbots for their business
  - Manage chatbot prompts and suggested questions
  - Upload, preview, and manage business documents (FAQ, product lists, policies, etc.)
  - Modern, responsive UI built with Tailwind CSS
  - Analytics and statistics for chatbot and document usage

## Business Document Management
- **Upload documents** (PDF, CSV, etc.) and assign types (FAQ, product list, policy, etc.)
- **Preview** document content (text or table preview)
- **Download** or **delete** documents
- **API endpoints** for document management:
  - Upload: `/api/v1/tenant/business-document/` (POST, multipart/form-data)
  - List: `/api/v1/tenant/business-document/?business_profile_id=...` (GET)
  - Preview: `/api/v1/tenant/business-document/{id}/preview` (GET)
  - Download: `/api/v1/tenant/business-document/{id}/download` (GET)
  - Delete: `/api/v1/tenant/business-document/{id}` (DELETE)

## Admin Panel
- **Access:** `/admin?user_id=<admin_user_id>`
- **Features:**
  - View all users, chatbots, and business profiles
  - See which users are admins
  - (UI only) Toggle admin status for users
  - Modern, responsive UI built with Tailwind CSS
- **How to use:**
  - Make sure you have at least one user with `is_admin=True` in your database
  - Visit `/admin?user_id=<admin_user_id>` in your browser

## API Endpoints
- **User Authentication:**
  - Register: `/api/v1/auth/register` (POST)
  - Login: `/api/v1/auth/login` (POST, returns JWT)
  - Get Current User: `/api/v1/auth/me?token=...` (GET)
  - Get User by ID: `/api/v1/auth/user/{user_id}` (GET)
- **Business Profile (Tenant) Management:**
  - Create: `/api/v1/tenant/` (POST)
  - List: `/api/v1/tenant/` (GET)
  - Get: `/api/v1/tenant/{profile_id}` (GET)
  - Update: `/api/v1/tenant/{profile_id}` (PUT)
- **Chatbot Management:**
  - Create: `/api/v1/chatbot/` (POST)
  - List: `/api/v1/chatbot/` (GET)
  - Get: `/api/v1/chatbot/{chatbot_id}` (GET)
  - Update: `/api/v1/chatbot/{chatbot_id}` (PUT)
  - Get Embed Link: `/api/v1/chatbot/embed/{user_id}` (GET)
  - Chat: `/api/v1/chatbot/chat` (POST)
  - Chatbot View (UI): `/api/v1/chatbot/view?user_id=<id>` (GET)

## Embeddable Chatbot Widget
- Add this to your website:
  ```html
  <script src="https://yourdomain.com/static/js/embed.js" data-user-id="2"></script>
  ```
- The widget will show a floating chat button. Clicking it opens the chat window, which loads the chatbot view for the specified user.

## Roadmap
- [x] Project structure & initialization
- [x] User authentication (JWT)
- [x] Multi-tenant support
- [x] Chatbot CRUD endpoints
- [x] Embeddable JS widget
- [x] Admin panel & user roles
- [x] User dashboard & login/signup pages
- [x] Automated Alembic migrations
- [x] Dashboard UI & document management
- [ ] Deployment & docs

## Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## Support
For questions, issues, or feature requests, please open an issue in this repository.

## License
MIT 