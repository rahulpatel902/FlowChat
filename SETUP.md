# FlowChat Setup Guide

## Prerequisites

- Node.js (v16 or higher)
- Python (3.11 or higher)
- PostgreSQL database
- Redis server
- Firebase project

## Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Database setup:**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   python manage.py createsuperuser
   ```

6. **Run development server:**
   ```bash
   python manage.py runserver
   ```

## Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase and API configuration
   ```

4. **Run development server:**
   ```bash
   npm start
   ```

## Firebase Setup

1. **Create Firebase project** at https://console.firebase.google.com
2. **Enable Firestore Database**
3. **Enable Firebase Storage**
4. **Generate service account key** for backend
5. **Get web app config** for frontend
6. **Update environment variables** in both `.env` files

## Database Configuration

### PostgreSQL
```sql
CREATE DATABASE flowchat;
CREATE USER flowchat_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE flowchat TO flowchat_user;
```

### Redis
Install and start Redis server for WebSocket channels.

## Production Deployment

### Backend (Heroku)
```bash
cd backend
heroku create your-app-name
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create heroku-redis:hobby-dev
heroku config:set SECRET_KEY=your-secret-key
heroku config:set DEBUG=False
git push heroku main
heroku run python manage.py migrate
```

### Frontend (Vercel)
```bash
cd frontend
npm run build
# Deploy to Vercel via GitHub integration or CLI
```

## Environment Variables

### Backend (.env)
- `SECRET_KEY`: Django secret key
- `DEBUG`: Set to False in production
- `DB_*`: PostgreSQL connection details
- `FIREBASE_*`: Firebase service account details
- `REDIS_URL`: Redis connection URL

### Frontend (.env)
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_WS_URL`: WebSocket URL
- `REACT_APP_FIREBASE_*`: Firebase web app config

## Features Included

✅ **User Authentication** - JWT-based signup/login/logout  
✅ **Real-time Chat** - WebSocket + Firebase Firestore  
✅ **User Profiles** - Profile management with avatars  
✅ **Direct Messages** - 1-on-1 conversations  
✅ **Group Chats** - Multi-user chat rooms  
✅ **Media Sharing** - File and image uploads  
✅ **Push Notifications** - Real-time notifications  
✅ **Online Status** - User presence indicators  
✅ **Read Receipts** - Message read tracking  
✅ **Search** - User and chat search functionality  
✅ **Responsive Design** - Mobile-friendly UI  

## Troubleshooting

### Common Issues
1. **CORS errors**: Check `CORS_ALLOWED_ORIGINS` in Django settings
2. **WebSocket connection fails**: Verify Redis is running
3. **Firebase errors**: Check Firebase configuration and permissions
4. **Database connection**: Ensure PostgreSQL is running and accessible

### Development Tips
- Use Django admin panel for user management
- Monitor Firebase console for real-time data
- Check browser developer tools for WebSocket connections
- Use Django debug toolbar for API debugging
