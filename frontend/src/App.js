import React from 'react';
import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/toaster';
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import './App.css';

function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <ChatProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/chat" replace />} />
            </Routes>
            <Toaster />
          </ChatProvider>
        </AuthProvider>
      </Router>
      <Analytics />
    </div>
  );
}

export default App;
