import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Sun, Moon, MessageSquare, Users, Shield, Zap, FileText, Eye } from 'lucide-react';
import CreatorBadge from '../components/common/CreatorBadge';

const Landing = () => {
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
  const { isAuthenticated } = useAuth();

  // Persist theme preference
  useEffect(() => {
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  // If already authenticated, redirect to chat
  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  const features = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Real-time Messaging",
      description: "Messages delivered instantly with no delays"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Group Chats",
      description: "Create groups and collaborate with your team"
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "File Sharing",
      description: "Share images and documents seamlessly"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Privacy First",
      description: "No phone number required - just use your email"
    },
    {
      icon: <Eye className="h-6 w-6" />,
      title: "Typing & Read Receipts",
      description: "Know when others are typing and reading"
    },
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "Online Status",
      description: "See who's online in real-time"
    }
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0d0f12]' : 'bg-gray-50'}`}>

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center px-4 pt-20 pb-16">
        {/* Logo */}
        <div className={`h-16 w-16 rounded-xl flex items-center justify-center shadow-lg mb-6 ${isDark ? 'bg-violet-600 ring-1 ring-white/10' : 'bg-violet-600 ring-2 ring-violet-300'}`}>
          <MessageSquare className="h-8 w-8 text-white" />
        </div>

        {/* Title */}
        <h1 className={`text-4xl sm:text-5xl font-extrabold text-center mb-4 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          Welcome to <span className="text-violet-600">FlowChat</span>
        </h1>

        {/* Tagline */}
        <p className={`text-lg sm:text-xl text-center max-w-xl mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Fast, modern real-time chat. Connect instantly with anyone, anywhere.
        </p>

        {/* Theme Toggle */}
        <div className="flex justify-center mb-6">
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

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/login">
            <Button 
              size="lg" 
              className={`px-8 py-3 text-lg font-semibold ${isDark ? 'bg-violet-600 hover:bg-violet-700' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
            >
              Get Started
            </Button>
          </Link>
          <Link to="/register">
            <Button 
              variant="outline" 
              size="lg" 
              className={`px-8 py-3 text-lg font-semibold ${isDark ? 'border-violet-500 text-violet-400 hover:bg-violet-600 hover:text-white hover:border-violet-600' : 'border-violet-600 text-violet-600 hover:bg-violet-50'}`}
            >
              Create Account
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className={`py-16 px-4 ${isDark ? 'bg-[#0a0c0f]' : 'bg-white'}`}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-2xl sm:text-3xl font-bold text-center mb-12 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            Everything you need to stay connected
          </h2>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className={`p-6 rounded-xl border transition-all duration-200 ${
                  isDark 
                    ? 'bg-[#151821] border-white/10 hover:border-violet-500/50 hover:bg-[#1a1f2a]' 
                    : 'bg-gray-50 border-gray-200 hover:border-violet-300 hover:shadow-md'
                }`}
              >
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center mb-4 ${isDark ? 'bg-violet-600/20 text-violet-400' : 'bg-violet-100 text-violet-600'}`}>
                  {feature.icon}
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                  {feature.title}
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className={`py-16 px-4 text-center ${isDark ? 'bg-[#0d0f12]' : 'bg-gray-50'}`}>
        <h3 className={`text-2xl font-bold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          Ready to start chatting?
        </h3>
        <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Join FlowChat today - it's free and takes less than a minute.
        </p>
        <Link to="/register">
          <Button 
            size="lg" 
            className={`px-8 py-3 text-lg font-semibold ${isDark ? 'bg-violet-600 hover:bg-violet-700' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
          >
            Sign Up Now
          </Button>
        </Link>
      </div>

      {/* Footer */}
      <div className={`py-6 px-4 text-center border-t ${isDark ? 'border-white/10 text-gray-500' : 'border-gray-200 text-gray-500'}`}>
        <p className="text-sm">
          © 2025 FlowChat. Built with Django, React & Firebase.
        </p>
        <p className="text-sm mt-1">
          Made with <span className="text-violet-500">💜</span> by{' '}
          <a 
            href="https://github.com/rahulpatel902" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-violet-500 transition-colors inline-flex items-center gap-1.5"
          >
            Rahul
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </p>
      </div>

      <CreatorBadge isDark={isDark} position="top-right" />
    </div>
  );
};

export default Landing;
