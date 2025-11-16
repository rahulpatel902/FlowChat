# 🚀 FlowChat Deployment Guide - Free Hosting

## **Architecture Overview**
- **Frontend**: Vercel (React app)
- **Backend**: Render (Django API + Redis)
- **Database**: Neon PostgreSQL (free tier)
- **Storage**: Firebase (Firestore + Storage)

---

## **STEP 1: Prepare Your Codebase** ✅

### Backend Preparation (Already Done)
- ✅ Added `dj-database-url` to requirements.txt
- ✅ Updated settings.py for Render compatibility
- ✅ Created build.sh script
- ✅ Added .onrender.com to ALLOWED_HOSTS

### Frontend Preparation Needed
```bash
cd frontend
# Remove proxy from package.json for production
```

---

## **STEP 2: Deploy Backend to Render**

### 2.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub account
3. Connect your GitHub repository

### 2.2 Create PostgreSQL Database (Neon)
1. Go to [neon.tech](https://neon.tech) and create a project.
2. Choose the region closest to your Render backend (e.g., ap-southeast-1).
3. Create the default database (e.g., `neondb`).
4. Open "Connect" and copy a Postgres connection string.
   - Prefer the **Direct** connection string for migrations.
   - Ensure it includes `sslmode=require` (Neon requires SSL).
5. You can later switch to the **Pooled** (PgBouncer) URL for runtime traffic.

### 2.3 Create Redis Instance
1. In Render dashboard → "New" → "Redis"
2. Name: `flowchat-redis`
3. Plan: **Free** (25MB)
4. Click "Create Redis"

### 2.4 Deploy Django Backend
1. In Render dashboard → "New" → "Web Service"
2. Connect your GitHub repository
3. Select your repository
4. Configure:
   - **Name**: `flowchat-backend`
   - **Environment**: `Python 3`
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn flowchat.wsgi:application`
   - **Plan**: **Free**

### 2.5 Set Environment Variables
In your web service settings, add these environment variables:

```
SECRET_KEY=your-generated-secret-key-here
DEBUG=False
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?sslmode=require
REDIS_URL=redis://hostname:port
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
CORS_ALLOWED_ORIGINS=https://your-frontend-url.vercel.app
```

**Important**: Get `DATABASE_URL` from Neon (Direct for migrations; you can later switch to Pooled). Get `REDIS_URL` from your Render Redis instance.

---

## **STEP 3: Deploy Frontend to Vercel**

### 3.1 Prepare Frontend
1. Remove proxy from package.json:
```json
// Remove this line from package.json
"proxy": "http://localhost:8000"
```

2. Update API base URL in your frontend code to point to Render backend:
```javascript
// In your API configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-url.onrender.com'
  : 'http://localhost:8000';
```

### 3.2 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub account
3. Import your project

### 3.3 Deploy to Vercel
1. In Vercel dashboard → "New Project"
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

### 3.4 Set Environment Variables in Vercel
```
REACT_APP_API_URL=https://your-backend-url.onrender.com
REACT_APP_FIREBASE_API_KEY=your-firebase-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

---

## **STEP 4: Configure Firebase for Production**

### 4.1 Firebase Console Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Generate new private key (download JSON)
5. Extract the values for your Render environment variables

### 4.2 Update Firebase Security Rules
```javascript
// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /chat_rooms_{roomId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

// Storage Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile_pictures/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /chat_files/{roomId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## **STEP 5: Update CORS Settings**

### 5.1 Update Django CORS Settings
After deploying frontend, update your Render backend environment variables:
```
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

### 5.2 Update Firebase Authorized Domains
1. Firebase Console → Authentication → Settings
2. Add your Vercel domain to authorized domains
3. Add your Render domain for backend authentication

---

## **STEP 6: Test Your Deployment**

### 6.1 Backend Health Check
Visit: `https://your-backend.onrender.com/admin/`
- Should show Django admin login
- Database should be connected

### 6.2 Frontend Check
Visit: `https://your-app.vercel.app`
- Should load login page
- Should be able to register/login
- Chat functionality should work

### 6.3 Integration Test
1. Register a new user
2. Create a chat room
3. Send messages
4. Upload an image
5. Check real-time updates

---

## **STEP 7: Post-Deployment Setup**

### 7.1 Create Superuser
```bash
# In Render web service console
python manage.py createsuperuser
```

### 7.2 Monitor Logs
- **Render**: Check logs in service dashboard
- **Vercel**: Check function logs in dashboard
- **Firebase**: Monitor usage in console

---

## **🎯 Free Tier Limitations**

### Render Free Tier
- **Web Service**: 750 hours/month, sleeps after 15min inactivity
- **Redis**: 25MB storage

### Neon Free Tier
- **Compute hours** and **storage** allocations vary; see Neon pricing.
- Requires SSL (`sslmode=require`). Use Direct for migrations and optionally Pooled for runtime.

### Vercel Free Tier
- **Bandwidth**: 100GB/month
- **Builds**: 6000 minutes/month
- **Serverless Functions**: 100GB-Hrs/month

### Firebase Free Tier
- **Firestore**: 1GB storage, 50K reads/day, 20K writes/day
- **Storage**: 5GB storage, 1GB/day downloads
- **Authentication**: Unlimited

---

## **🔧 Troubleshooting**

### Common Issues
1. **Backend sleeping**: Render free tier sleeps after 15min
2. **CORS errors**: Check CORS_ALLOWED_ORIGINS
3. **Database connection**: Verify DATABASE_URL
4. **Firebase auth**: Check service account credentials
5. **Build failures**: Check build logs in Render/Vercel

### Performance Tips
1. **Keep backend warm**: Use uptime monitoring service
2. **Optimize images**: Compress before upload
3. **Cache static files**: Leverage Vercel CDN
4. **Monitor usage**: Stay within free tier limits

---

## **🚀 Going Live Checklist**

- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel
- [ ] Database connected and migrated
- [ ] Redis connected for WebSocket
- [ ] Firebase configured for production
- [ ] Environment variables set
- [ ] CORS configured
- [ ] SSL certificates active (automatic)
- [ ] Custom domain (optional)
- [ ] Monitoring setup

**Your FlowChat app is now live and accessible worldwide! 🎉**
