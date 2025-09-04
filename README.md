# 📱 FlowChat - Real-Time Chat & Social Application

A modern real-time chat application built with React, Django, and Firebase.

## 🚀 Tech Stack

- **Frontend**: React.js with Tailwind CSS + shadcn/ui
- **Backend**: Django + Django REST Framework
- **Database**: PostgreSQL (user data) + Firebase Firestore (messages)
- **Authentication**: JWT tokens
- **Real-time**: Firebase Firestore listeners
- **Storage**: Firebase Storage (media files)

## 📁 Project Structure

```
ChatFlow/
├── backend/          # Django API server
├── frontend/         # React application
└── docs/             # Documentation
```

## 🛠️ Setup Instructions

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

### Firebase Setup
1. Create a Firebase project
2. Enable Firestore and Storage
3. Add your Firebase config to `frontend/src/firebase/config.js`

## 🌟 Features

- ✅ User Authentication (Signup/Login/Logout)
- ✅ Real-time Chat (1-on-1 & Group)
- ✅ User Profiles & Status
- ✅ Media Sharing
- ✅ Push Notifications
- ✅ Search Functionality
- ✅ Read Receipts

## 🚀 Deployment

- **Backend**: Heroku
- **Frontend**: Vercel
- **Database**: Firebase + PostgreSQL

## 📝 License

MIT License
