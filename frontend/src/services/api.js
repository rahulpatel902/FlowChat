import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register/', userData),
  login: (credentials) => api.post('/auth/login/', credentials),
  logout: (refreshToken) => api.post('/auth/logout/', { refresh: refreshToken }),
  getProfile: () => api.get('/auth/profile/'),
  updateProfile: (userData) => api.patch('/auth/profile/', userData),
  getUserById: (userId) => api.get(`/auth/users/lookup/`, { params: { user_id: userId } }),
  lookupUserByUsername: (username) => api.get(`/auth/users/lookup/`, { params: { username } }),
  lookupUserByEmail: (email) => api.get(`/auth/users/lookup/`, { params: { email } }),
  getFirebaseCustomToken: () => api.post('/auth/firebase/custom-token/'),
};

// Chat API
export const chatAPI = {
  getRooms: () => api.get('/chat/rooms/'),
  createRoom: (roomData) => api.post('/chat/rooms/create/', roomData),
  getRoomDetails: (roomId) => api.get(`/chat/rooms/${roomId}/`),
  updateRoom: (roomId, roomData) => api.patch(`/chat/rooms/${roomId}/`, roomData),
  deleteRoom: (roomId) => api.delete(`/chat/rooms/${roomId}/`),
  leaveRoom: (roomId) => api.post(`/chat/rooms/${roomId}/leave/`),
  createDirectMessage: (recipientId) => api.post('/chat/direct/', { recipient_id: recipientId }),
  markMessagesRead: (roomId) => api.post(`/chat/rooms/${roomId}/read/`),
  createMessageMetadata: (roomId, messageData) => api.post(`/chat/rooms/${roomId}/messages/create/`, messageData),
};


export default api;
