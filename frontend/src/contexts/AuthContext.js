import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';
import { auth } from '../firebase/config';
import { signInWithCustomToken, signOut as firebaseSignOut } from 'firebase/auth';
import { startPresence, stopPresence } from '../firebase/rtdbPresence';

const AuthContext = createContext();

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null,
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const presenceStopRef = useRef(null);

  // We only want to run the auth bootstrap once on mount.
  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    try {
      const response = await authAPI.getProfile();
      dispatch({ type: 'SET_USER', payload: response.data });
      // Ensure Firebase is signed in with the same identity
      try {
        const { data } = await authAPI.getFirebaseCustomToken();
        if (data?.custom_token) {
          await signInWithCustomToken(auth, data.custom_token);
          // Start RTDB presence immediately after Firebase sign-in
          if (response?.data?.id) {
            try { if (typeof presenceStopRef.current === 'function') presenceStopRef.current(); } catch (_) {}
            presenceStopRef.current = startPresence(response.data.id);
            try { window.dispatchEvent(new CustomEvent('self-presence', { detail: { online: true } })); } catch (_) {}
          }
        }
      } catch (e) {
        console.error('Failed to sign in to Firebase with custom token (restore):', e);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      try {
        const prevUid = state?.user?.id;
        // Attempt to set offline in case a previous session left it online
        if (prevUid) {
          try { if (typeof presenceStopRef.current === 'function') presenceStopRef.current(); } catch (_) {}
          presenceStopRef.current = null;
          await stopPresence(prevUid);
        }
      } catch (_) {}
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      dispatch({ type: 'LOGOUT' });
    }
  };

  const login = async (credentials) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await authAPI.login(credentials);
      const { user, access, refresh } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      dispatch({ type: 'SET_USER', payload: user });
      // Sign into Firebase using backend-issued custom token
      try {
        const { data } = await authAPI.getFirebaseCustomToken();
        if (data?.custom_token) {
          await signInWithCustomToken(auth, data.custom_token);
          // Start RTDB presence immediately after Firebase sign-in
          if (user?.id) {
            try { if (typeof presenceStopRef.current === 'function') presenceStopRef.current(); } catch (_) {}
            presenceStopRef.current = startPresence(user.id);
            try { window.dispatchEvent(new CustomEvent('self-presence', { detail: { online: true } })); } catch (_) {}
          }
        }
      } catch (e) {
        console.error('Failed to sign in to Firebase with custom token (login):', e);
      }
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await authAPI.register(userData);
      const { user, access, refresh } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      
      dispatch({ type: 'SET_USER', payload: user });
      // Sign into Firebase using backend-issued custom token after registration
      try {
        const { data } = await authAPI.getFirebaseCustomToken();
        if (data?.custom_token) {
          await signInWithCustomToken(auth, data.custom_token);
          // Start RTDB presence immediately after Firebase sign-in
          if (user?.id) startPresence(user.id);
        }
      } catch (e) {
        console.error('Failed to sign in to Firebase with custom token (register):', e);
      }
      return { success: true };
    } catch (error) {
      let message = 'Registration failed';
      if (error.response?.data) {
        const errorData = error.response.data;
        const errorKey = Object.keys(errorData)[0];
        if (errorKey) {
          const errorMessage = Array.isArray(errorData[errorKey]) ? errorData[errorKey][0] : errorData[errorKey];
          message = `${errorKey.charAt(0).toUpperCase() + errorKey.slice(1)}: ${errorMessage}`;
        }
      }
      dispatch({ type: 'SET_ERROR', payload: message });
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        await authAPI.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Ensure RTDB presence is marked offline BEFORE signing out of Firebase (auth may be required by RTDB rules)
      try {
        const prevUid = state?.user?.id;
        // First dispose any live presence starter (detaches .info/connected listener and sets offline)
        try { if (typeof presenceStopRef.current === 'function') presenceStopRef.current(); } catch (_) {}
        presenceStopRef.current = null;
        if (prevUid) await stopPresence(prevUid);
      } catch (_) {}
      // Now clear local tokens
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      // Sign out from Firebase as well
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.warn('Firebase sign-out failed:', e);
      }
      try { window.dispatchEvent(new CustomEvent('self-presence', { detail: { online: false } })); } catch (_) {}
      dispatch({ type: 'LOGOUT' });
    }
  };

  const updateProfile = async (userData) => {
    try {
      const response = await authAPI.updateProfile(userData);
      const updated = response.data || {};
      // Merge with existing user so we don't lose fields when backend returns a partial payload
      const mergedUser = {
        ...state.user,
        ...updated,
      };
      // Ensure full_name remains consistent if backend didn't send it
      if (!('full_name' in updated) && (updated.first_name || updated.last_name)) {
        const fn = mergedUser.first_name || '';
        const ln = mergedUser.last_name || '';
        mergedUser.full_name = `${fn}${fn && ln ? ' ' : ''}${ln}`.trim();
      }
      dispatch({ type: 'SET_USER', payload: mergedUser });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.detail || 'Profile update failed';
      return { success: false, error: message };
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
