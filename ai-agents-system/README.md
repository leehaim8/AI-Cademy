# AI Cademy

React + TypeScript frontend (Vite) with a Python backend (FastAPI + MongoDB) for user auth.

## Features added

- Sign In page
- Sign Up page
- Users table page (loaded from backend DB)
- MongoDB `users` collection in Python backend

## Project structure

- `src/` frontend code
- `backend/main.py` FastAPI server
- MongoDB database/collection is created automatically on first write

## Run locally

### 1) Start backend

```bash
cd ai-agents-system
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Optional: override defaults
export MONGODB_URI="mongodb://127.0.0.1:27017"
export MONGODB_DB_NAME="ai_cademy"

uvicorn backend.main:app --reload --port 8000
```

Backend URL: `http://127.0.0.1:8000`

MongoDB defaults:
- URI: `mongodb://127.0.0.1:27017`
- DB: `ai_cademy`
- Collection: `users`

### 2) Start frontend (new terminal)

```bash
cd ai-agents-system
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## API endpoints

- `POST /auth/signup`
- `POST /auth/signin`
- `GET /users`
- `GET /health`

## Optional env var

If you want a different backend URL, create `.env` in project root:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```
