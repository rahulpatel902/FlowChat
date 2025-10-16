<p align="center">
  <img src="frontend/public/favicon.svg" alt="FlowChat logo" width="110" />
</p>

<h1 align="center">FlowChat</h1>

<p align="center"><em>Fast, modern real‑time chat built with Django, React & Firebase</em></p>

<p align="center">
  
</p>

---

FlowChat is a modern real‑time chat application built with a Django backend and a React frontend, using Firebase for realtime messaging and storage.

Live deployments are designed for Vercel (frontend), Render (backend), and Neon (managed PostgreSQL). See `DEPLOYMENT_GUIDE.md` for step‑by‑step hosting on free tiers.

---

## 🔷 Architecture

- Frontend: React (Create React App), TailwindCSS, shadcn/ui, lucide‑react icons
- Backend: Django 4 + Django REST Framework
- WebSockets: Django Channels + channels‑redis
- Primary DB: PostgreSQL on Neon (users, rooms, membership, message metadata)
- Realtime Messaging: Firebase Firestore (per‑room collections)
- Presence (Online/Offline): Firebase Realtime Database (RTDB)
- File Storage: Firebase Storage (images and files)
- Auth: JWT (backend) + Firebase custom token for client SDK access

---

## ✨ Key Features

- Direct and group chats
- Message types: text, image, file attachments
- Read receipts (per‑message, per‑recipient)
- Typing indicators
- Online/Offline presence indicators
- Message replies and previews
- Group admin: rename group, update avatar, add/remove members, leave/delete
- Search users (by @username or email)
- Robust downloads and image previews

Product behavior:
- New DMs and groups are added to the list but are not auto‑opened; a chat opens only when selected from the sidebar.

---

## 📁 Repository Structure

```
ChatFlow/
├── backend/                 # Django API (REST + Channels)
│   ├── accounts/            # Auth, profile APIs
│   ├── chat/                # Rooms, messages metadata, WS consumers
│   ├── flowchat/            # Django settings, ASGI/WSGI
│   ├── requirements.txt
│   └── render.yaml, build.sh, Procfile
├── frontend/                # React app
│   ├── src/
│   │   ├── components/      # UI components (chat, profile, ui)
│   │   ├── contexts/        # AuthContext, ChatContext
│   │   ├── firebase/        # config, firestore, storage, rtdbPresence
│   │   ├── services/        # API client, websocket service
│   │   └── lib/utils.js     # helpers
│   ├── package.json
│   └── vercel.json          # Vercel config (CRA)
├── DEPLOYMENT_GUIDE.md      # Full hosting guide (Render + Vercel + Neon)
├── RUN.md, SETUP.md         # Local run/setup notes
└── .gitignore
```

---

## 🔑 Environment Variables

Both `backend/.env.example` and `frontend/.env.example` are provided. Copy to `.env` and fill values.

Backend (`backend/.env`):
- SECRET_KEY, DEBUG
- DATABASE_URL (Neon Postgres URL, include `sslmode=require`)
- REDIS_URL
- Firebase service account fields (use env vars; do not commit JSON)
  - Optional alternative: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT (only if not using `DATABASE_URL`)

Frontend (`frontend/.env`):
- REACT_APP_API_URL (e.g., https://your-backend.onrender.com/api)
- REACT_APP_WS_URL (e.g., wss://your-backend.onrender.com)
- REACT_APP_FIREBASE_API_KEY
- REACT_APP_FIREBASE_AUTH_DOMAIN
- REACT_APP_FIREBASE_PROJECT_ID
- REACT_APP_FIREBASE_STORAGE_BUCKET
- REACT_APP_FIREBASE_DATABASE_URL (RTDB URL; required for presence)
- REACT_APP_FIREBASE_MESSAGING_SENDER_ID
- REACT_APP_FIREBASE_APP_ID

Note: For Neon, prefer the Direct connection string for running `python manage.py migrate`. You can optionally switch `DATABASE_URL` to the Pooled (`-pooler`) URL for runtime.

---

## 🏃 Local Development

Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows (or: source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Frontend
```bash
cd frontend
npm install
npm start
```

Firebase
- Create a project, enable Firestore, Storage, and Realtime Database.
- Put your web config in `frontend/src/firebase/config.js` via env.
- Security Rules: set Firestore and Storage rules according to your needs (see `DEPLOYMENT_GUIDE.md`).

---

## 🧠 Realtime Model Details

- Messages are written to Firestore collections named `chat_rooms_{roomId}`.
- Read receipts are stored per message: `read_receipts_{roomId}_{messageId}`.
- Typing indicators use a `typing_{roomId}` collection.
- Presence is stored in RTDB under `status/{uid}` with fields `{ state: "online"|"offline", last_changed }`.
  - We register `onDisconnect()` to write offline on unexpected disconnects.
  - UI treats a user as online only if `state === 'online'` and `last_changed` is fresh.
  - Server time offset is used to avoid device clock skew.
  - Ensure `REACT_APP_FIREBASE_DATABASE_URL` is set so the client connects to the correct RTDB instance.

WebSockets
- Client connects to `${REACT_APP_WS_URL}/ws/chat/{roomId}/?token=<JWT>`.
- Backend authenticates that JWT in `JWTAuthMiddlewareStack` (`backend/flowchat/asgi.py`, `backend/chat/middleware.py`).

---

## 🚀 Deployments

- Frontend on Vercel (root: `frontend/`, build: `npm run build`, output: `build/`).
- Backend on Render (Gunicorn for HTTP; Channels + Redis for websockets). Database on Neon (PostgreSQL managed service).
- Detailed steps, env var lists, and rules are in `DEPLOYMENT_GUIDE.md`.

---

## 🔐 Security Notes

- Do not commit service account JSON. Use environment variables (Render/Vercel secrets).
- Keep `.env` files out of version control; use `.env.example` to document keys.
- CORS: set `CORS_ALLOWED_ORIGINS` to your Vercel domain(s) for production.

---

## 🧪 Troubleshooting

- Presence shows stale Online: ensure only one session is active for that user; RTDB will sync via `onDisconnect`. The app also deems entries offline if `last_changed` is old.
- Build fails on Vercel due to ESLint warnings: warnings are treated as errors in CI. Fix or suppress with targeted comments.
- Backend sleeping on Render free tier: expect cold starts; consider uptime pings.

---

## 📜 License

MIT
