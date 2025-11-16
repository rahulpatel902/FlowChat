import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Sun, Moon, MessageSquare } from 'lucide-react';
import CreatorBadge from '../components/common/CreatorBadge';

const VerifyEmail = () => {
  const location = useLocation();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email...');
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const uid = params.get('uid');
    const token = params.get('token');

    if (!uid || !token) {
      setStatus('error');
      setMessage('Invalid verification link. Missing required parameters.');
      return;
    }

    const verify = async () => {
      try {
        const response = await authAPI.verifyEmail(uid, token);
        const detail = response.data?.detail || 'Email verified successfully. You can now log in.';
        setStatus('success');
        setMessage(detail);
      } catch (error) {
        const detail = error.response?.data?.detail || 'Invalid or expired verification link.';
        setStatus('error');
        setMessage(detail);
      }
    };

    verify();
  }, [location.search]);

  return (
    <div className={`min-h-screen flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8 ${isDark ? 'bg-[#0d0f12]' : 'bg-gray-50'}`}>
      <div className="max-w-md w-full space-y-2">
        <div>
          <div className="flex items-center justify-center mb-6">
            <div className={`h-12 w-12 rounded-md flex items-center justify-center shadow-sm ${isDark ? 'bg-violet-600 ring-1 ring-white/10' : 'bg-violet-600 ring-2 ring-violet-300 shadow'}`}>
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
          </div>
          <h2 className={`mt-2 text-center text-3xl font-extrabold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            Email Verification
          </h2>
          <p className={`mt-2 text-center text-sm ${status === 'error' ? 'text-red-500' : isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {message}
          </p>
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className={`transition-colors ${isDark ? 'hover:bg-violet-600 hover:text-white text-gray-300' : 'hover:bg-gray-100'}`}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-center">
              <Link to="/login">
                <Button className={`px-6 ${isDark ? 'bg-violet-600 hover:bg-violet-700' : ''}`}>
                  Go to Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <CreatorBadge isDark={isDark} position="top-right" />
      </div>
    </div>
  );
};

export default VerifyEmail;
