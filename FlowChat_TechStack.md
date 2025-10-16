# 📱 FlowChat – Real-Time Chat & Social Application
**Stack:** React + Django + Firebase  

---

## 1️⃣ Tech Stack Overview  

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | **React.js** | Builds the chat UI, profile pages, and feeds; manages state with Firebase listeners for real-time sync. |
| **Styling** | **Tailwind CSS + shadcn/ui** | Modern, responsive, component-based styling for chat windows, sidebars, and user cards. |
| **Backend API** | **Django + Django REST Framework (DRF)** | Manages authentication, user profiles, chat room metadata, notifications. Exposes REST APIs for frontend. |
| **Database (Messages)** | **Firebase Firestore** | Real-time storage and syncing of chat messages across users. |
| **Database (User Metadata)** | **PostgreSQL (Neon)** | Stores user accounts, profile info, chat room lists, and additional business logic data. |
| **Authentication** | **DRF + JWT** (or Django Sessions) | Token-based authentication; integrates with React frontend. |
| **Version Control** | **Git + GitHub** | Code collaboration, tracking, and CI/CD pipelines. |
| **Deployment** | **Render (Django API + Redis)** + **Vercel (React frontend)** + **Neon (PostgreSQL)** | Cloud-hosted backend, database, and frontend for live access. |

---

## 2️⃣ Core Features  

✅ **User Authentication** – Signup, login, logout (via Django).  
✅ **User Profiles** – Profile picture, bio, last seen, online status.  
✅ **Real-Time Chat** – One-to-one & group chat powered by Firebase Firestore.  
✅ **Chat Rooms / Groups** – Created and managed in PostgreSQL, messages linked to Firestore.  
✅ **Media Sharing** – Send images/files (stored in Firebase Storage).  
✅ **Notifications** – Real-time push (via Firebase Cloud Messaging or WebSocket bridge).  
✅ **Search** – Search users, chat history, and groups.  
✅ **Read Receipts & Online Status** – Seen/unseen tracking.  

---

## 3️⃣ Project Flow  

1. **User Flow**  
   - User signs up / logs in → JWT token issued → React stores token.  
   - User profile data fetched from PostgreSQL.  

2. **Chat Flow**  
   - User enters chat room → React listens to Firestore collection updates.  
   - New message → instantly synced to all connected clients via Firestore.  
   - Django only handles metadata (rooms, user links).  

3. **Deployment Flow**  
   - **Backend (Django + Redis)** → Deployed to **Render**.  
   - **Database (PostgreSQL)** → Deployed to **Neon** (managed Postgres).  
   - **Frontend (React)** → Deployed to **Vercel**.  
   - **Firebase (Firestore + Storage)** → Real-time DB + media hosting.  

---

