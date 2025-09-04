import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/use-toast';
import { Sun, Moon, MessageSquare } from 'lucide-react';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
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
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Persist theme preference
  useEffect(() => {
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(formData);
    
    if (result.success) {
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
    } else {
      toast({
        title: "Login failed",
        description: result.error,
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 ${isDark ? 'bg-[#0d0f12]' : 'bg-gray-50'}`}>
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex items-center justify-center mb-6">
            <div className={`h-12 w-12 rounded-md flex items-center justify-center shadow-sm ${isDark ? 'bg-violet-600 ring-1 ring-white/10' : 'bg-violet-600 ring-2 ring-violet-300 shadow'}`}>
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
          </div>
          <h2 className={`mt-6 text-center text-3xl font-extrabold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            Welcome to FlowChat
          </h2>
          <p className={`mt-2 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Sign in to your account
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
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className={`mt-1 ${isDark ? 'bg-[#151821] text-gray-100 placeholder:text-gray-400 border border-white/10 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-0 focus-visible:border-violet-500' : ''}`}
              />
            </div>
            <div>
              <label htmlFor="password" className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={`mt-1 ${isDark ? 'bg-[#151821] text-gray-100 placeholder:text-gray-400 border border-white/10 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-0 focus-visible:border-violet-500' : ''}`}
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              disabled={isLoading}
              className={`w-full transition-all ${isDark ? 'bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50' : ''}`}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>

          <div className="text-center">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Don't have an account?{' '}
              <Link
                to="/register"
                className={`font-medium ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-primary hover:text-primary/80'}`}
              >
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
