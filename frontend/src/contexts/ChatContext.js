import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { authAPI, chatAPI } from '../services/api';
import { subscribeToMessages, sendMessage, getLastMessage, updateOnlineStatus } from '../firebase/firestore';
import websocketService from '../services/websocket';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

const initialState = {
  rooms: [],
  activeRoom: null,
  messages: [],
  typingUsers: [],
  searchedUsers: [],
  messagesLimit: 50,
  isLoading: false,
  error: null,
};

function chatReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload, isLoading: false };
    case 'ADD_ROOM':
      return { ...state, rooms: [action.payload, ...state.rooms] };
    case 'UPDATE_ROOM':
      return {
        ...state,
        rooms: state.rooms.map(room =>
          room.id === action.payload.id ? action.payload : room
        ),
        activeRoom:
          state.activeRoom && state.activeRoom.id === action.payload.id
            ? { ...state.activeRoom, ...action.payload }
            : state.activeRoom,
      };
    case 'SET_ACTIVE_ROOM':
      return { ...state, activeRoom: action.payload, messages: [] };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'SET_MESSAGES_LIMIT':
      return { ...state, messagesLimit: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id ? action.payload : msg
        ),
      };
    case 'SET_TYPING_USERS':
      return { ...state, typingUsers: action.payload };
    case 'SET_SEARCHED_USERS':
      return { ...state, searchedUsers: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user, isAuthenticated } = useAuth();
  const messageUnsubscribeRef = useRef(null);

  // Load rooms with Firestore last message preview
  const loadRooms = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await chatAPI.getRooms();
      const rooms = response.data.results || [];

      const withPreviews = await Promise.all(
        rooms.map(async (room) => {
          try {
            const last = await getLastMessage(room.id);
            if (!last) return { ...room, last_message_preview: null };

            const preview = {
              text: last.text || (last.file_name ? last.file_name : ''),
              message_type: last.message_type || (last.file_url ? 'file' : 'text'),
              sender_id: last.sender_id,
              sender_name: last.sender_name,
              timestamp: last.timestamp,
            };
            return { ...room, last_message_preview: preview };
          } catch (e) {
            return room;
          }
        })
      );

      dispatch({ type: 'SET_ROOMS', payload: withPreviews });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load chat rooms' });
    }
  }, [dispatch]);

  // WebSocket connection for active room
  const connectToRoom = useCallback((roomId) => {
    const token = localStorage.getItem('access_token');
    websocketService.connect(roomId, token);

    websocketService.on('chat_message', (data) => {
      dispatch({ type: 'ADD_MESSAGE', payload: data });
      // If the message belongs to the currently open room and is incoming,
      // mark as read immediately to keep unread badge accurate.
      try {
        if (data?.room_id && state.activeRoom?.id === data.room_id && data?.sender_id !== user?.id) {
          markMessagesAsRead(data.room_id);
        }
      } catch (_) {}
      loadRooms();
    });

    websocketService.on('typing_indicator', (data) => {
      dispatch({ type: 'SET_TYPING_USERS', payload: data });
    });
  }, [dispatch, loadRooms, state.activeRoom?.id, user?.id]);

  // Firestore subscription for messages in active room
  const subscribeToRoomMessages = useCallback((roomId, limitCount) => {
    messageUnsubscribeRef.current = subscribeToMessages(roomId, (messages) => {
      dispatch({ type: 'SET_MESSAGES', payload: messages });
    }, limitCount);
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      loadRooms();
    }
  }, [isAuthenticated, loadRooms]);

  // Presence: mark current user online while app is open; offline on unload
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const goOnline = () => updateOnlineStatus(user.id, true).catch(() => {});
    const goOffline = () => updateOnlineStatus(user.id, false).catch(() => {});

    // Immediately mark online
    goOnline();

    // Keep-alive every 25s to refresh lastSeen/isOnline
    const keepAlive = setInterval(goOnline, 25000);

    // Mark offline on tab close/refresh
    window.addEventListener('beforeunload', goOffline);

    return () => {
      clearInterval(keepAlive);
      // Ensure offline when unmounting provider
      goOffline();
      window.removeEventListener('beforeunload', goOffline);
    };
  }, [isAuthenticated, user?.id]);

  // Periodically refresh rooms and on window focus to reflect new activity
  useEffect(() => {
    if (!isAuthenticated) return;

    const onFocus = () => loadRooms();
    window.addEventListener('focus', onFocus);

    const intervalId = setInterval(() => {
      loadRooms();
    }, 10000);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(intervalId);
    };
  }, [isAuthenticated, loadRooms]);

  useEffect(() => {
    if (state.activeRoom) {
      connectToRoom(state.activeRoom.id);
      subscribeToRoomMessages(state.activeRoom.id, state.messagesLimit);
    }

    return () => {
      if (messageUnsubscribeRef.current) {
        messageUnsubscribeRef.current();
        messageUnsubscribeRef.current = null;
      }
      websocketService.disconnect();
    };
  }, [state.activeRoom, state.messagesLimit, connectToRoom, subscribeToRoomMessages]);

  const increaseMessagesLimit = useCallback((increment = 50) => {
    dispatch({ type: 'SET_MESSAGES_LIMIT', payload: state.messagesLimit + increment });
  }, [dispatch, state.messagesLimit]);

  // (moved earlier)

  const createRoom = async (roomData) => {
    try {
      const response = await chatAPI.createRoom(roomData);
      dispatch({ type: 'ADD_ROOM', payload: response.data });
      return { success: true, room: response.data };
    } catch (error) {
      return { success: false, error: 'Failed to create room' };
    }
  };

  const createDirectMessage = async (recipientId) => {
    try {
      const response = await chatAPI.createDirectMessage(recipientId);
      dispatch({ type: 'ADD_ROOM', payload: response.data });
      return { success: true, room: response.data };
    } catch (error) {
      const serverMsg =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        (typeof error?.response?.data === 'string' ? error.response.data : null);
      return { success: false, error: serverMsg || 'Failed to create direct message' };
    }
  };

  // Group management helpers (provider scope)
  const renameRoom = async (roomId, name, description = undefined) => {
    try {
      const payload = { name };
      if (typeof description !== 'undefined') payload.description = description;
      const resp = await chatAPI.updateRoom(roomId, payload);
      dispatch({ type: 'UPDATE_ROOM', payload: resp.data });
      return { success: true, room: resp.data };
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to rename room';
      return { success: false, error: msg };
    }
  };

  const addMembers = async (roomId, userIds) => {
    try {
      const resp = await chatAPI.updateRoom(roomId, { add_member_ids: userIds });
      dispatch({ type: 'UPDATE_ROOM', payload: resp.data });
      return { success: true, room: resp.data };
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to add members';
      return { success: false, error: msg };
    }
  };

  const removeMember = async (roomId, userId) => {
    try {
      const resp = await chatAPI.updateRoom(roomId, { remove_member_ids: [userId] });
      dispatch({ type: 'UPDATE_ROOM', payload: resp.data });
      return { success: true, room: resp.data };
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to remove member';
      return { success: false, error: msg };
    }
  };

  // Generic room update helper so callers can update arbitrary fields
  const updateRoomData = async (roomId, data) => {
    try {
      const resp = await chatAPI.updateRoom(roomId, data);
      dispatch({ type: 'UPDATE_ROOM', payload: resp.data });
      return { success: true, room: resp.data };
    } catch (e) {
      // Pull best possible error message
      const body = e?.response?.data;
      const fieldMsg = body && typeof body === 'object'
        ? Object.values(body).flat().join(', ')
        : null;
      const msg = fieldMsg || body?.detail || e?.message || 'Failed to update room';
      return { success: false, error: msg };
    }
  };

  const selectRoom = (room) => {
    // Set active room immediately
    dispatch({ type: 'SET_ACTIVE_ROOM', payload: room });

    // Optimistically clear unread badge locally
    if (room?.unread_count > 0) {
      dispatch({ type: 'UPDATE_ROOM', payload: { ...room, unread_count: 0 } });
    }

    // Inform backend to mark messages as read
    markMessagesAsRead(room.id);
  };

  const clearActiveRoom = () => {
    dispatch({ type: 'SET_ACTIVE_ROOM', payload: null });
  };

  // (moved earlier)

  // (moved earlier)

  const sendChatMessage = async (messageText, messageType = 'text', fileData = null, replyTo = null) => {
    if (!state.activeRoom || !user) return;

    try {
      const messageData = {
        text: messageText,
        sender_id: user.id,
        sender_name: user.full_name,
        message_type: messageType,
        timestamp: new Date().toISOString(),
      };

      if (fileData) {
        messageData.file_url = fileData.url;
        messageData.file_name = fileData.name;
        messageData.file_size = fileData.size;
        messageData.file_type = fileData.type;
      }

      // Include compact reply payload if present
      if (replyTo) {
        try {
          const compact = {
            id: replyTo.id,
            sender_id: replyTo.sender_id,
            sender_name: replyTo.sender_name,
            message_type: replyTo.message_type || (replyTo.file_url ? 'file' : 'text'),
            ...(replyTo.text ? { text: replyTo.text } : {}),
            ...(replyTo.file_name ? { file_name: replyTo.file_name } : {}),
            ...(replyTo.file_url ? { file_url: replyTo.file_url } : {}),
          };
          messageData.reply_to = compact;
        } catch (_) {
          // ignore formatting errors
        }
      }

      // Send to Firebase
      const firebaseMessageId = await sendMessage(state.activeRoom.id, messageData);

      // Create metadata in Django
      await chatAPI.createMessageMetadata(state.activeRoom.id, {
        firebase_message_id: firebaseMessageId,
        message_type: messageType,
      });

      // Send via WebSocket for real-time updates
      websocketService.sendMessage(messageText, firebaseMessageId);

      // Update sidebar immediately
      loadRooms();
      return { success: true };
    } catch (error) {
      console.error('Failed to send message:', error);
      return { success: false, error: 'Failed to send message' };
    }
  };

  const markMessagesAsRead = async (roomId) => {
    try {
      await chatAPI.markMessagesRead(roomId);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const startTyping = () => {
    websocketService.sendTyping(true);
  };

  const stopTyping = () => {
    websocketService.sendTyping(false);
  };

  const searchUsers = async (searchTerm) => {
    const raw = (searchTerm || '').trim();
    if (!raw) {
      dispatch({ type: 'SET_SEARCHED_USERS', payload: [] });
      return;
    }

    const term = raw.toLowerCase();
    const isEmail = /.+@.+\..+/.test(term);
    const uname = term.startsWith('@') ? term.slice(1) : term;

    try {
      let userResp = null;
      if (isEmail) {
        userResp = await authAPI.lookupUserByEmail(term);
      } else {
        userResp = await authAPI.lookupUserByUsername(uname);
      }

      const user = userResp?.data;
      dispatch({ type: 'SET_SEARCHED_USERS', payload: user ? [user] : [] });
    } catch (error) {
      // 404 means not found — treat as empty result; log other errors
      if (error?.response?.status !== 404) {
        console.error('Failed to lookup user:', error);
      }
      dispatch({ type: 'SET_SEARCHED_USERS', payload: [] });
    }
  };

  const value = {
    ...state,
    loadRooms,
    createRoom,
    createDirectMessage,
    renameRoom,
    addMembers,
    removeMember,
    updateRoomData,
    selectRoom,
    clearActiveRoom,
    sendChatMessage,
    markMessagesAsRead,
    startTyping,
    stopTyping,
    searchUsers,
    increaseMessagesLimit,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
