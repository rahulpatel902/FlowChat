import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as RTooltip from '@radix-ui/react-tooltip';
import { authAPI, chatAPI } from '../../services/api';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/use-toast';
import { 
  Send, 
  Paperclip, 
  Image, 
  Smile,
  Search,
  MoreVertical,
  MessageSquare,
  X,
  Check,
  CheckCheck,
  LogOut,
  Trash,
  Info,
  Pencil,
  Users,
  Eraser,
} from 'lucide-react';
import { formatTime, getInitials, debounce } from '../../lib/utils';
import { uploadImage, uploadChatFile, uploadGroupAvatar, FILE_TYPES, validateFile } from '../../firebase/storage';
import { deleteMessage as deleteMessageFS, subscribeToReadReceipts, markMessageAsRead } from '../../firebase/firestore';
import { subscribeToPresence } from '../../firebase/rtdbPresence';
import websocketService from '../../services/websocket';
import Portal from '../ui/Portal';

const ChatWindow = ({ isDark: isDarkProp, mobileSearchTerm = '', mobileClearTick = 0 }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const pinnedToBottomRef = useRef(true);
  const loadingOlderRef = useRef(null); // { prevScrollHeight: number } while fetching older
  const inputRef = useRef(null);
  const { 
    activeRoom, 
    messages, 
    sendChatMessage, 
    startTyping, 
    stopTyping,
    typingUsers,
    increaseMessagesLimit,
    markMessagesAsRead,
    renameRoom,
    addMembers,
    removeMember,
    searchUsers,
    searchedUsers,
    rooms,
    selectRoom,
    clearActiveRoom,
    loadRooms,
    updateRoomData,
  } = useChat();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Pending attachment that will be sent on submit (Option A)
  const [pendingAttachment, setPendingAttachment] = useState(null); // { file: File, type: 'image'|'file', previewUrl?: string }
  // Image preview (lightbox)
  const [previewImg, setPreviewImg] = useState(null); // { url, name }
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [peerStatus, setPeerStatus] = useState(null);
  const peerStatusTimerRef = useRef(null);
  const [peerOnline, setPeerOnline] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState(null); // number (ms)
  const lastSeenIntervalRef = useRef(null);
  const [ctxMenu, setCtxMenu] = useState({ open: false, x: 0, y: 0, msg: null });
  const [readsPanel, setReadsPanel] = useState({ open: false, x: 0, y: 0, msg: null, readers: [], nonReaders: [] });
  const emojiAnchorRef = useRef(null);
  const emojiPanelRef = useRef(null);
  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });
  // Read receipt state: map of messageId -> set/list of reader userIds
  const [readMap, setReadMap] = useState({});
  const readUnsubsRef = useRef({});
  const markReadTimerRef = useRef(null);
  // Header extras
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [loadingPeerProfile, setLoadingPeerProfile] = useState(false);
  const [peerProfile, setPeerProfile] = useState(null);
  const [showHeaderSearch, setShowHeaderSearch] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showRenamePanel, setShowRenamePanel] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteSelected, setInviteSelected] = useState([]);
  // Confirm actions (leave / delete) moved from Sidebar into Chat area overlays
  const [confirmAction, setConfirmAction] = useState({ show: false, type: null, room: null });
  // Theme (white / black) - controlled by parent via prop; default false
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : false;
  // Group avatar editing state
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState('');
  const [groupAvatarUploading, setGroupAvatarUploading] = useState(false);
  const [groupAvatarProgress, setGroupAvatarProgress] = useState(0);
  const groupAvatarInputRef = useRef(null);
  // Helper: 03 Sep 2025, 01:19 PM
  const formatDateTime = (dateLike) => {
    const dt = new Date(dateLike);
    if (isNaN(dt.getTime())) return '';
    const day = String(dt.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = months[dt.getMonth()];
    const year = dt.getFullYear();
    let hours = dt.getHours();
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hh = String(hours).padStart(2, '0');
    return `${day} ${mon} ${year}, ${hh}:${minutes} ${ampm}`;
  };
  // Absolute tooltip content for last seen when offline
  const peerStatusTitle = React.useMemo(() => {
    if (peerOnline || !peerLastSeen) return '';
    return `Last seen on ${formatDateTime(peerLastSeen)}`;
  }, [peerOnline, peerLastSeen]);
 
  // Confirm overlay action handlers (leave/delete), used in JSX overlay
  const handleLeaveRoom = async () => {
    const room = confirmAction?.room || activeRoom;
    if (!room) return;
    try {
      await chatAPI.leaveRoom(room.id);
      setConfirmAction({ show: false, type: null, room: null });
      // Immediately switch to another room or clear
      try {
        const fallback = (rooms || []).find(r => r.id !== room.id);
        if (fallback) {
          selectRoom(fallback);
        } else {
          clearActiveRoom();
        }
      } catch (_) {}
      await loadRooms();
      toast({ title: 'Left chat', description: 'You have left the chat.' });
    } catch (e) {
      toast({ title: 'Failed to leave chat', variant: 'destructive' });
    }
  };

  // Enhanced "last seen" formatter per UX rules
  const formatLastSeen = (ts) => {
    if (!ts) return '';
    const ms = Number(ts);
    if (!Number.isFinite(ms)) return '';
    const now = new Date();
    const dt = new Date(ms);
    if (isNaN(dt.getTime())) return '';

    const pad = (n) => String(n).padStart(2, '0');
    const timeLabel = (d) => {
      let h = d.getHours();
      const m = pad(d.getMinutes());
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12; if (h === 0) h = 12;
      return `${h}:${m} ${ampm}`;
    };
    const dateLabel = (d, withYear = false) => {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dd = pad(d.getDate());
      const mon = months[d.getMonth()];
      return withYear ? `${dd} ${mon} ${d.getFullYear()}` : `${dd} ${mon}`;
    };

    const diffMs = Math.max(0, now.getTime() - dt.getTime());
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    // Same calendar day helper
    const sameYMD = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
    if (diffHour < 24) return `${diffHour} hr${diffHour === 1 ? '' : 's'} ago`;

    if (sameYMD(dt, yesterday)) {
      return `yesterday at ${timeLabel(dt)}`;
    }
    if (diffDay >= 2 && diffDay <= 6) {
      return `${diffDay} days ago at ${timeLabel(dt)}`;
    }

    const sameYear = now.getFullYear() === dt.getFullYear();
    if (sameYear) {
      return `on ${dateLabel(dt, false)} at ${timeLabel(dt)}`;
    }
    return `on ${dateLabel(dt, true)} at ${timeLabel(dt)}`;
  };

  // Derive a simple, human-friendly type label from filename or mime
  const getFileTypeLabel = (name, mime) => {
    const lower = (name || '').toLowerCase();
    const ext = lower.split('.').pop();
    if (!ext || ext === lower) {
      // try mime
      if (mime) {
        if (mime.includes('pdf')) return 'PDF Document';
        if (mime.includes('word') || mime.includes('msword') || mime.includes('officedocument.wordprocessingml')) return 'Word Document';
        if (mime.includes('excel') || mime.includes('spreadsheet')) return 'Excel Spreadsheet';
        if (mime.includes('powerpoint') || mime.includes('presentation')) return 'PowerPoint Presentation';
        if (mime.startsWith('image/')) return 'Image';
        if (mime.startsWith('video/')) return 'Video';
        if (mime.startsWith('audio/')) return 'Audio';
        if (mime.includes('zip') || mime.includes('compressed')) return 'Archive';
        if (mime.includes('text')) return 'Text Document';
      }
      return 'File';
    }

    const map = {
      pdf: 'PDF Document',
      doc: 'Word Document',
      docx: 'Word Document',
      xls: 'Excel Spreadsheet',
      xlsx: 'Excel Spreadsheet',
      ppt: 'PowerPoint Presentation',
      pptx: 'PowerPoint Presentation',
      txt: 'Text Document',
      md: 'Markdown Document',
      csv: 'CSV File',
      png: 'Image',
      jpg: 'Image',
      jpeg: 'Image',
      webp: 'Image',
      gif: 'Image',
      svg: 'Image',
      mp4: 'Video',
      mov: 'Video',
      avi: 'Video',
      mp3: 'Audio',
      wav: 'Audio',
      zip: 'Archive',
      rar: 'Archive',
      '7z': 'Archive',
      json: 'JSON File',
      xml: 'XML File',
      pdfx: 'PDF Document'
    };
    return map[ext] || (mime && mime.split('/')[0] === 'image' ? 'Image' : 'File');
  };
 
  const handleDeleteRoom = async () => {
    const room = confirmAction?.room || activeRoom;
    if (!room) return;
    try {
      await chatAPI.deleteRoom(room.id);
      setConfirmAction({ show: false, type: null, room: null });
      // Immediately switch to another room or clear
      try {
        const fallback = (rooms || []).find(r => r.id !== room.id);
        if (fallback) {
          selectRoom(fallback);
        } else {
          clearActiveRoom();
        }
      } catch (_) {}
      await loadRooms();
      toast({ title: 'Chat deleted', description: 'The chat has been deleted.' });
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to delete chat';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  // Mirror mobile search term from parent so filtering works on mobile
  useEffect(() => {
    // Only update if value actually changed to avoid cursor jump when typing in desktop header search
    setMessageSearchTerm((prev) => (prev !== mobileSearchTerm ? mobileSearchTerm : prev));
  }, [mobileSearchTerm]);

  // Listen for global events (from Sidebar/Mobile header) to open overlays in ChatWindow
  useEffect(() => {
    const handleOpenContact = () => {
      if (activeRoom?.room_type !== 'direct') return;
      setShowContactInfo(true);
    };
    const handleOpenGroupInfo = () => {
      if (activeRoom?.room_type !== 'group') return;
      setShowGroupInfo(true);
    };
    const handleOpenRename = () => {
      if (activeRoom?.room_type !== 'group') return;
      setRenameInput(activeRoom?.name || '');
      setShowRenamePanel(true);
    };

    const handleOpenMembers = () => {
      if (activeRoom?.room_type !== 'group') return;
      setShowMembersPanel(true);
    };

    const handleOpenLeave = () => {
      if (!activeRoom) return;
      setConfirmAction({ show: true, type: 'leave', room: activeRoom });
    };
    const handleOpenDelete = () => {
      if (!activeRoom) return;
      setConfirmAction({ show: true, type: 'delete', room: activeRoom });
    };
    window.addEventListener('open-contact-info', handleOpenContact);
    window.addEventListener('open-group-info', handleOpenGroupInfo);
    window.addEventListener('open-rename-group', handleOpenRename);
    window.addEventListener('open-group-members', handleOpenMembers);
    window.addEventListener('open-leave-chat', handleOpenLeave);
    window.addEventListener('open-delete-chat', handleOpenDelete);
    return () => {
      window.removeEventListener('open-contact-info', handleOpenContact);
      window.removeEventListener('open-group-info', handleOpenGroupInfo);
      window.removeEventListener('open-rename-group', handleOpenRename);
      window.removeEventListener('open-group-members', handleOpenMembers);
      window.removeEventListener('open-leave-chat', handleOpenLeave);
      window.removeEventListener('open-delete-chat', handleOpenDelete);
    };
  }, [activeRoom]);

  // Respond to mobile clear action triggered from parent menu
  useEffect(() => {
    if (!mobileClearTick) return;
    if (!activeRoom || !messages?.length) return;
    (async () => {
      try {
        await Promise.all(messages.map(m => deleteMessageFS(activeRoom.id, m.id).catch(() => {})));
        toast({ title: 'Chat cleared' });
      } catch (_) {
        toast({ title: 'Failed to clear chat', variant: 'destructive' });
      }
    })();
  }, [mobileClearTick, activeRoom, messages, toast]);

  // --- Date helpers for safe Firestore/ISO/number timestamps ---
  const toDateSafe = (ts) => {
    try {
      if (!ts) return null;
      if (ts instanceof Date) return ts;
      if (typeof ts === 'number') return new Date(ts);
      if (typeof ts === 'string') {
        const d = new Date(ts);
        return isNaN(d.getTime()) ? null : d;
      }
      // Firestore Timestamp support
      if (typeof ts === 'object') {
        if (typeof ts.toDate === 'function') return ts.toDate();
        if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
        if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
      }
    } catch (_) {}
    return null;
  };

  // Compute peer user and room name before any early returns
  const peerUser = activeRoom?.room_type === 'direct'
    ? activeRoom.members?.find(m => m.user.id !== user?.id)?.user
    : null;
  const roomName = activeRoom?.room_type === 'direct'
    ? (peerUser?.full_name || 'Direct Message')
    : (activeRoom?.name || 'Group Chat');
  const currentMember = activeRoom?.members?.find(m => m.user.id === user?.id) || null;
  const isAdmin = useMemo(() => {
    if (activeRoom?.room_type !== 'group') return false;
    const me = activeRoom.members?.find(m => m.user.id === user?.id);
    return me?.role === 'admin' || me?.role === 'owner';
  }, [activeRoom, user?.id]);

  // Load full peer profile (includes bio) when opening Contact Info
  useEffect(() => {
    if (!showContactInfo || !peerUser?.id) return;
    let cancelled = false;
    setLoadingPeerProfile(true);
    authAPI.getUserById(peerUser.id)
      .then(res => {
        if (!cancelled) setPeerProfile(res?.data || null);
      })
      .catch(() => {
        if (!cancelled) setPeerProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPeerProfile(false);
      });
    return () => { cancelled = true; };
  }, [showContactInfo, peerUser?.id]);

  const isSameDay = (a, b) => {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const formatDayLabel = (d) => {
    if (!d) return '';
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    if (isSameDay(d, today)) return 'Today';
    if (isSameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  

  // Queue attachment for manual send
  const queueAttachment = (file, typeHint = 'file') => {
    if (!file) return;
    const isImage = typeHint === 'image' || FILE_TYPES.IMAGES.includes(file.type);
    const allowed = isImage ? FILE_TYPES.IMAGES : [];
    const { isValid, errors } = validateFile(file, 20, allowed);
    if (!isValid) {
      toast({ title: 'Invalid file', description: errors.join(', '), variant: 'destructive' });
      return;
    }
    let previewUrl;
    try {
      if (isImage) previewUrl = URL.createObjectURL(file);
    } catch (_) {}
    setPendingAttachment({ file, type: isImage ? 'image' : 'file', previewUrl });
  };

  const clearAttachment = () => {
    try {
      if (pendingAttachment?.previewUrl) URL.revokeObjectURL(pendingAttachment.previewUrl);
    } catch (_) {}
    setPendingAttachment(null);
  };

  const handlePickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    queueAttachment(file, 'image');
    e.target.value = '';
  };

  const handlePickFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    queueAttachment(file, 'file');
    e.target.value = '';
  };

  // --- Group avatar handlers ---
  const handlePickGroupAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { isValid, errors } = validateFile(file, 5, FILE_TYPES.IMAGES);
    if (!isValid) {
      toast({ title: 'Invalid image', description: errors.join(', '), variant: 'destructive' });
      return;
    }
    setGroupAvatarFile(file);
    try {
      setGroupAvatarPreview(URL.createObjectURL(file));
    } catch (_) {
      setGroupAvatarPreview('');
    }
    // reset input value so selecting the same file again triggers change
    if (e.target) e.target.value = '';
  };

  const handleCancelGroupAvatar = () => {
    try { if (groupAvatarPreview) URL.revokeObjectURL(groupAvatarPreview); } catch (_) {}
    setGroupAvatarFile(null);
    setGroupAvatarPreview('');
    setGroupAvatarUploading(false);
    setGroupAvatarProgress(0);
  };

  const handleSaveGroupAvatar = async () => {
    if (!activeRoom || !groupAvatarFile) return;
    try {
      setGroupAvatarUploading(true);
      setGroupAvatarProgress(0);
      const uploaded = await uploadGroupAvatar(groupAvatarFile, activeRoom.id, (p) => setGroupAvatarProgress(p));
      const result = await updateRoomData(activeRoom.id, { avatar_url: uploaded.url });
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to update room');
      }
      toast({ title: 'Group avatar updated' });
      handleCancelGroupAvatar();
    } catch (e) {
      const body = e?.response?.data;
      const fieldMsg = body && typeof body === 'object' ? Object.values(body).flat().join(', ') : null;
      const msg = e?.message || fieldMsg || body?.detail || 'Failed to update avatar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      setGroupAvatarUploading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const typeHint = FILE_TYPES.IMAGES.includes(file.type) ? 'image' : 'file';
    queueAttachment(file, typeHint);
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // If we loaded older messages, preserve scroll position
    if (loadingOlderRef.current) {
      const { prevScrollHeight } = loadingOlderRef.current;
      const delta = container.scrollHeight - prevScrollHeight;
      container.scrollTop = Math.max(0, delta);
      loadingOlderRef.current = null;
      return; // don't auto-scroll to bottom in this case
    }

    const last = messages[messages.length - 1];
    const lastIsOwn = last && String(last.sender_id) === String(user?.id);
    if (pinnedToBottomRef.current || lastIsOwn) {
      scrollToBottom();
    }
  }, [messages, user]);

  // Mark visible incoming messages as read (batched) and emit read receipts via WebSocket
  useEffect(() => {
    if (!activeRoom || !messages?.length || !user?.id) return;
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(async () => {
      try {
        // Mark last 50 incoming messages as read
        const recent = messages.slice(-50).filter(m => String(m.sender_id) !== String(user.id));
        await Promise.all(recent.map(async (m) => {
          try { await markMessageAsRead(activeRoom.id, m.id, user.id); } catch (_) {}
          try { websocketService.sendReadReceipt(m.id); } catch (_) {}
        }));
        // Also tell backend to clear unread count for this room
        try { await markMessagesAsRead(activeRoom.id); } catch (_) {}
      } catch (_) {
        // noop
      }
    }, 400);
    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    };
  }, [activeRoom, messages, user, markMessagesAsRead]);

  // Also react to WebSocket read_receipt events for instant UI updates
  useEffect(() => {
    const handler = (evt) => {
      try {
        const { type, firebase_message_id, user_id } = evt || {};
        if (type !== 'read_receipt') return;
        if (!firebase_message_id || !user_id) return;
        // Only care about receipts from other participants
        const uid = String(user_id);
        if (String(uid) === String(user?.id)) return;
        setReadMap((prev) => {
          const existing = prev[firebase_message_id] || [];
          if (existing.includes(uid)) return prev;
          return { ...prev, [firebase_message_id]: [...existing, uid] };
        });
      } catch (_) {}
    };
    // Register
    websocketService.on('read_receipt', handler);
    return () => {
      try { websocketService.off('read_receipt', handler); } catch (_) {}
    };
  }, [user?.id]);

  // Subscribe to peer online status for direct chats (RTDB presence)
  useEffect(() => {
    if (!activeRoom || activeRoom.room_type !== 'direct') return;
    const peer = activeRoom.members?.find(m => m.user.id !== user?.id)?.user;
    if (!peer) return;
    // Default to offline until first snapshot to avoid stale 'Online'
    setPeerStatus('Offline');
    setPeerOnline(false);
    setPeerLastSeen(null);
    const unsub = subscribeToPresence([peer.id], (statuses) => {
      const st = statuses?.[String(peer.id)];
      const nextOnline = !!st?.isOnline;
      const last = typeof st?.lastSeen === 'number' ? st.lastSeen : null;
      setPeerOnline(nextOnline);
      setPeerLastSeen(last);
      // Stabilize: apply Online only after a short delay; Offline immediately
      if (nextOnline) {
        if (peerStatusTimerRef.current) clearTimeout(peerStatusTimerRef.current);
        peerStatusTimerRef.current = setTimeout(() => setPeerStatus('Online'), 700);
      } else {
        if (peerStatusTimerRef.current) {
          clearTimeout(peerStatusTimerRef.current);
          peerStatusTimerRef.current = null;
        }
        const label = last ? formatLastSeen(last) : null;
        setPeerStatus(label ? `Last seen ${label}` : 'Offline');
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
      if (peerStatusTimerRef.current) {
        clearTimeout(peerStatusTimerRef.current);
        peerStatusTimerRef.current = null;
      }
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
        lastSeenIntervalRef.current = null;
      }
    };
  }, [activeRoom, user]);

  // While offline, recompute the relative "Last seen" string every 60 seconds
  useEffect(() => {
    // Clear previous interval
    if (lastSeenIntervalRef.current) {
      clearInterval(lastSeenIntervalRef.current);
      lastSeenIntervalRef.current = null;
    }
    if (peerOnline || !peerLastSeen) return; // Nothing to update periodically
    // Immediate refresh
    setPeerStatus(`Last seen ${formatLastSeen(peerLastSeen)}`);
    lastSeenIntervalRef.current = setInterval(() => {
      setPeerStatus(`Last seen ${formatLastSeen(peerLastSeen)}`);
    }, 60000);
    return () => {
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
        lastSeenIntervalRef.current = null;
      }
    };
  }, [peerOnline, peerLastSeen]);

  // Subscribe to read receipts for own messages; avoid resetting when loading older
  const prevRoomIdRef = useRef(null);
  useEffect(() => {
    const roomId = activeRoom?.id || null;

    // If room changed, clear all and resubscribe fresh
    const roomChanged = prevRoomIdRef.current && prevRoomIdRef.current !== roomId;
    if (roomChanged) {
      Object.values(readUnsubsRef.current).forEach((fn) => { if (typeof fn === 'function') fn(); });
      readUnsubsRef.current = {};
      setReadMap({});
    }
    prevRoomIdRef.current = roomId;

    if (!activeRoom || !Array.isArray(messages) || !user?.id) return;

    // Build a set of current own message IDs
    const ownIds = new Set(messages.filter(m => String(m.sender_id) === String(user.id)).map(m => m.id));

    // Unsubscribe for messages that are no longer present
    Object.keys(readUnsubsRef.current).forEach((id) => {
      if (!ownIds.has(id)) {
        const fn = readUnsubsRef.current[id];
        if (typeof fn === 'function') fn();
        delete readUnsubsRef.current[id];
        // Do not delete readMap to avoid flicker; leave last known state
      }
    });

    // Subscribe for new own messages not yet tracked
    messages.forEach((m) => {
      if (String(m.sender_id) !== String(user.id)) return;
      if (readUnsubsRef.current[m.id]) return; // already subscribed
      const unsub = subscribeToReadReceipts(activeRoom.id, m.id, (receipts) => {
        setReadMap((prev) => ({
          ...prev,
          [m.id]: receipts?.map(r => r.userId) || [],
        }));
      });
      readUnsubsRef.current[m.id] = unsub;
    });

    // Cleanup on unmount or when room truly changes is handled above
    return () => {
      // no-op here; actual cleanup done when room changes/unmount
    };
  }, [activeRoom, activeRoom?.id, messages, user?.id]);

  const debouncedStopTyping = debounce(() => {
    stopTyping();
    setIsTyping(false);
  }, 1000);

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    
    if (!isTyping) {
      startTyping();
      setIsTyping(true);
    }
    
    debouncedStopTyping();
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const messageText = message.trim();
    if (!messageText && !pendingAttachment) return;

    stopTyping();
    setIsTyping(false);

    // Send attachment first (if any), then text
    if (pendingAttachment) {
      try {
        const { file, type } = pendingAttachment;
        setUploading(true);
        setUploadProgress(0);
        const onProgress = (p) => setUploadProgress(p);
        const uploaded = type === 'image'
          ? await uploadImage(file, activeRoom.id, onProgress)
          : await uploadChatFile(file, activeRoom.id, onProgress);
        const attachResult = await sendChatMessage('', type, uploaded, replyTo);
        if (!attachResult?.success) {
          toast({ title: 'Failed to send attachment', description: attachResult?.error || 'Unknown error', variant: 'destructive' });
          setUploading(false);
          setUploadProgress(0);
          return; // do not proceed to send text if attachment failed
        }
      } catch (err) {
        console.error('Attachment upload failed:', err);
        const desc = err?.message || err?.code || 'Unknown error';
        toast({ title: 'Upload failed', description: desc, variant: 'destructive' });
        setUploading(false);
        setUploadProgress(0);
        return;
      } finally {
        clearAttachment();
      }
    }

    if (messageText) {
      const result = await sendChatMessage(messageText, 'text', null, replyTo);
      if (!result.success) {
        toast({ title: 'Failed to send message', description: result.error, variant: 'destructive' });
        // If text fails, keep it in the input
        setMessage(messageText);
        return;
      }
    }

    // On success of all parts
    setMessage('');
    setReplyTo(null);
    setUploading(false);
    setUploadProgress(0);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const openContextMenu = (e, msg) => {
    e.preventDefault();
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    const MENU_W = 180; // approximate width
    const MENU_H = 220; // approximate height (varies)
    const PADDING = 8;
    let x = e.clientX;
    let y = e.clientY;
    if (x + MENU_W + PADDING > vw) x = Math.max(PADDING, vw - MENU_W - PADDING);
    if (y + MENU_H + PADDING > vh) y = Math.max(PADDING, vh - MENU_H - PADDING);
    setCtxMenu({ open: true, x, y, msg });
  };

  const closeContextMenu = () => setCtxMenu({ open: false, x: 0, y: 0, msg: null });

  useEffect(() => {
    const onClick = () => { closeContextMenu(); setReadsPanel({ open: false, x: 0, y: 0, msg: null, readers: [], nonReaders: [] }); };
    const onEsc = (e) => { if (e.key === 'Escape') closeContextMenu(); };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, []);

  // Close header menu on outside click
  useEffect(() => {
    if (!headerMenuOpen) return;
    const handler = (e) => {
      setHeaderMenuOpen(false);
    };
    window.addEventListener('click', handler);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setHeaderMenuOpen(false); });
    return () => {
      window.removeEventListener('click', handler);
    };
  }, [headerMenuOpen]);

  // Close emoji panel on outside click
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e) => {
      const anchor = emojiAnchorRef.current;
      const panel = emojiPanelRef.current;
      if (panel && !panel.contains(e.target) && anchor && !anchor.contains(e.target)) {
        setShowEmoji(false);
      }
    };
    window.addEventListener('click', handler);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setShowEmoji(false); });
    return () => {
      window.removeEventListener('click', handler);
    };
  }, [showEmoji]);

  // Close image preview with ESC
  useEffect(() => {
    if (!previewImg) return;
    const onEsc = (e) => { if (e.key === 'Escape') setPreviewImg(null); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [previewImg]);

  const renderMessage = (msg) => {
    const isOwn = msg.sender_id === user?.id;
    const participantIds = (activeRoom?.members || [])
      .map(m => m.user.id)
      .filter(id => id !== user?.id)
      .map(id => id != null ? String(id) : id);
    const readBy = readMap[msg.id] || [];
    const readCount = readBy.filter(id => participantIds.includes(id)).length;
    const isGroup = activeRoom?.room_type === 'group';
    const showSenderLabel = isGroup && !isOwn;
    const showAvatar = isGroup && !isOwn;
    const senderName = isOwn ? 'You' : (msg.sender_name || '');

    // Bubble styling
    const bubbleShadow = isDark ? 'shadow-sm' : 'shadow';
    const bubbleBase = `px-3 py-2 text-[14px] ${bubbleShadow} relative leading-snug transition-colors`;
    const isMedia = msg.message_type === 'image' || msg.message_type === 'file';
    // Use unified padding for media bubbles so sender/receiver look the same
    const bubblePadding = isMedia ? 'pr-3 pb-5' : (isOwn ? 'pr-14 pb-5' : 'pr-10 pb-5');
    const ownBubble = `${
      isDark
        ? 'bg-[#5b21b6] text-gray-100 hover:bg-[#6d28d9] active:bg-[#7c3aed]'
        : 'bg-[#ede9fe] text-gray-900 hover:bg-[#ddd6fe] active:bg-[#c4b5fd]'
    } rounded-2xl rounded-br-xl`;
    const otherBubble = `${
      isDark
        ? 'bg-[#151821] text-gray-100 border border-white/10 hover:bg-[#1b2028] active:bg-[#20262f]'
        : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 active:bg-gray-100'
    } rounded-2xl rounded-bl-xl`;

    return (
      <div
        key={msg.id}
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5`}
      >
        <div className={`flex max-w-[78%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* Avatar */}
          {showAvatar && (
            <div className="flex-shrink-0 mr-2">
              {(() => {
                const senderUser = (activeRoom?.members || []).find(m => String(m.user.id) === String(msg.sender_id))?.user;
                const avatarUrl = senderUser?.profile_picture;
                if (avatarUrl) {
                  return (
                    <img
                      src={avatarUrl}
                      alt={senderUser?.full_name || msg.sender_name || 'User'}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  );
                }
                return (
                  <div className="h-8 w-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-medium">
                    {getInitials(senderUser?.full_name || msg.sender_name || 'U')}
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Message bubble */}
          <div
            onContextMenu={(e) => openContextMenu(e, msg)}
            className={`${bubbleBase} ${bubblePadding} ${isOwn ? ownBubble : otherBubble}`}
          >
            {showSenderLabel && (
              <p className={`text-xs font-medium opacity-70 mb-1 ${isDark ? 'text-gray-200' : ''}`}>{senderName}</p>
            )}
            {/* Reply header */}
            {msg.reply_to && (
              <div className={`text-xs mb-2 p-2 rounded ${
                isDark
                  ? 'bg-white/10'
                  : (isOwn ? 'bg-white/60' : 'bg-gray-100')
              }`}>
                <div className="flex items-center gap-2 min-w-0">
                  {/* Media/file preview if available */}
                  {msg.reply_to.message_type === 'image' && msg.reply_to.file_url ? (
                    <img
                      src={msg.reply_to.file_url}
                      alt={msg.reply_to.file_name || 'image'}
                      className="h-8 w-8 rounded object-cover flex-shrink-0 border"
                    />
                  ) : msg.reply_to.message_type === 'file' ? (
                    <div className={`h-8 w-8 rounded flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                      <Paperclip className="h-3.5 w-3.5" />
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    <div>
                      Replying to: <span className="font-medium">{msg.reply_to.sender_name || 'Message'}</span>
                    </div>
                    {msg.reply_to.text ? (
                      <div className="opacity-70 truncate">{msg.reply_to.text}</div>
                    ) : (msg.reply_to.message_type === 'file' && msg.reply_to.file_name) ? (
                      <div className="opacity-70 flex items-center gap-1 min-w-0">
                        <Paperclip className="h-3 w-3" />
                        <span className="inline-block flex-1 w-0 overflow-hidden whitespace-nowrap text-ellipsis" title={msg.reply_to.file_name}>{msg.reply_to.file_name}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {msg.message_type === 'text' ? (
              <p className="whitespace-pre-wrap break-words leading-snug">{linkify(msg.text)}</p>
            ) : msg.message_type === 'image' ? (
              <div className="w-[260px] sm:w-[300px]">
                <img
                  src={msg.file_url}
                  alt={msg.file_name}
                  className="w-auto h-auto max-w-full max-h-[180px] sm:max-h-[220px] object-cover rounded mb-1 cursor-pointer"
                  onClick={() => setPreviewImg({ url: msg.file_url, name: msg.file_name })}
                />
                {/* No filename under images, keep UI clean like WhatsApp. Click image to preview. */}
              </div>
            ) : (
              <div className={`w-[260px] sm:w-[300px] rounded-xl ${isDark ? 'bg-white/10' : 'bg-gray-100'} overflow-hidden`}> 
                {/* Header: icon + filename */}
                <div className="flex items-center gap-2.5 p-2 min-w-0">
                  <div className={`h-8 w-8 rounded-md flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                    <Paperclip className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium overflow-hidden whitespace-nowrap text-ellipsis ${isDark ? 'text-gray-100' : 'text-gray-900'}`} title={msg.file_name}>
                      {shortenFilename(msg.file_name, 42)}
                    </p>
                    <p className={`text-[11px] opacity-70 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{formatBytes(msg.file_size)}{msg.file_name ? `, ${getFileTypeLabel(msg.file_name, msg.file_mime)}` : ''}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className={`grid grid-cols-2 gap-2 p-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                  <a
                    href={msg.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full whitespace-nowrap text-center py-1.5 rounded-md text-[13px] font-medium ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-100' : 'bg-white hover:bg-gray-50 text-gray-900'} transition-colors`}
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(msg.file_url, msg.file_name || 'file')}
                    className={`w-full whitespace-nowrap text-center py-1.5 rounded-md text-[13px] font-medium ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-100' : 'bg-white hover:bg-gray-50 text-gray-900'} transition-colors`}
                  >
                    Save as...
                  </button>
                </div>
              </div>
            )}
            {/* Timestamp bottom-right inside bubble */}
            <div className="absolute right-2 bottom-1.5 flex items-center space-x-1 whitespace-nowrap">
              <p className={`text-[10px] leading-none opacity-60 ${isDark ? 'text-gray-200/80' : ''}`}>{formatTime(msg.timestamp)}</p>
              {isOwn && (
                <span className="flex items-center ml-1">
                  {activeRoom?.room_type === 'direct' ? (
                    readCount > 0 ? (
                      <CheckCheck className={`h-3.5 w-3.5 ${isDark ? 'text-violet-200 drop-shadow' : 'text-violet-600'}`} />
                    ) : (
                      <Check className={`h-3.5 w-3.5 ${isDark ? 'text-white/70 drop-shadow' : 'text-gray-600/70'}`} />
                    )
                  ) : null}
                </span>
              )}
            </div>
          </div>

          {/* Removed inline actions dropdown; using right-click context menu */}
        </div>
      </div>
    );
  };

  const linkify = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noreferrer" className="underline break-words">{part}</a>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    const sizes = ['bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Shorten very long filenames with a middle ellipsis while preserving extension
  const shortenFilename = (name, max = 36) => {
    try {
      if (!name || typeof name !== 'string') return name || '';
      if (name.length <= max) return name;
      const lastDot = name.lastIndexOf('.');
      const ext = lastDot > 0 && lastDot < name.length - 1 ? name.slice(lastDot) : '';
      const base = ext ? name.slice(0, lastDot) : name;
      const keep = Math.max(6, max - ext.length - 3); // 3 for '...'
      const head = Math.ceil(keep * 0.6);
      const tail = keep - head;
      return `${base.slice(0, head)}...${base.slice(base.length - tail)}${ext}`;
    } catch (_) {
      return name;
    }
  };

  const handleDeleteMessage = async (msg) => {
    try {
      await deleteMessageFS(activeRoom.id, msg.id);
      closeContextMenu();
      toast({ title: 'Message deleted' });
    } catch (e) {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  // Robust download that works even when the server doesn't set Content-Disposition
  const handleDownloadFile = async (fileUrl, fileName = 'download') => {
    try {
      const res = await fetch(fileUrl, { credentials: 'omit' });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback: open in new tab; user can save from there
      window.open(fileUrl, '_blank', 'noopener');
    }
  };

  const handleForwardMessage = async (msg) => {
    // Simple forward to another room: choose the first other room for now (can be improved with modal)
    try {
      // Placeholder: forward to the most recent other room if exists
      // In a full UI, present a room picker.
      // For now, copy content to clipboard as minimal forward alternative
      await navigator.clipboard.writeText(msg.text || msg.file_url || '');
      toast({ title: 'Copied for forwarding. Paste into another chat.' });
      closeContextMenu();
    } catch (e) {
      closeContextMenu();
    }
  };

  if (!activeRoom) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No chat selected
          </h2>
          <p className="text-gray-600">
            Choose a conversation from the sidebar to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 min-h-0 flex flex-col relative ${isDark ? 'bg-[#0f1115] text-gray-100' : 'bg-white text-gray-900'}`}>
      {/* Chat Header (now visible on all viewports) */}
      <div className={`block p-4 relative ${isDark ? 'bg-[#13151a] border-b border-white/10' : 'bg-white border-b border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 lg:space-x-3">
            {/* Mobile-only hamburger to open sidebar */}
            <button
              type="button"
              className={`lg:hidden mr-1 h-8 w-8 lg:h-9 lg:w-9 inline-flex items-center justify-center rounded-md ${isDark ? 'bg-black/30 text-white ring-1 ring-white/10 hover:bg-violet-600 hover:text-white' : 'bg-white/70 text-gray-900 ring-1 ring-gray-200 hover:bg-violet-600 hover:text-white'}`}
              onClick={(e) => { e.stopPropagation(); try { window.dispatchEvent(new Event('open-sidebar')); } catch(_){} }}
              aria-label="Open chat list"
            >
              {/* Use a generic icon from lucide if Menu isn't imported elsewhere */}
              <span className="block h-3.5 w-3.5 relative">
                <span className={`absolute inset-x-0 top-0 h-0.5 ${isDark ? 'bg-current' : 'bg-current'}`}></span>
                <span className={`absolute inset-x-0 top-1.5 h-0.5 ${isDark ? 'bg-current' : 'bg-current'}`}></span>
                <span className={`absolute inset-x-0 top-3 h-0.5 ${isDark ? 'bg-current' : 'bg-current'}`}></span>
              </span>
            </button>
            <div
              className="h-9 w-9 lg:h-10 lg:w-10 rounded-full overflow-hidden flex items-center justify-center bg-primary text-white text-sm font-medium cursor-pointer self-center"
              onClick={() => { if (activeRoom.room_type === 'direct') setShowContactInfo(true); else if (activeRoom.room_type === 'group') setShowGroupInfo(true); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (activeRoom.room_type === 'direct') setShowContactInfo(true); else if (activeRoom.room_type === 'group') setShowGroupInfo(true); } }}
              title={activeRoom.room_type === 'direct' ? 'View contact info' : 'View group info'}
            >
              {activeRoom.room_type === 'direct' ? (
                peerUser?.profile_picture ? (
                  <img
                    src={peerUser.profile_picture}
                    alt={peerUser.full_name || 'User'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{getInitials(peerUser?.full_name || 'U')}</span>
                )
              ) : (
                activeRoom?.avatar_url ? (
                  <img
                    src={activeRoom.avatar_url}
                    alt={activeRoom.name || 'Group'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{getInitials(activeRoom.name || 'G')}</span>
                )
              )}
            </div>
            <div>
              <h2 className="text-[15px] lg:text-lg font-semibold text-gray-900">
                <span className={`${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{roomName}</span>
              </h2>
              <div className={`mt-0.5 lg:mt-1 flex items-center gap-1.5 text-[13px] lg:text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                {activeRoom.room_type === 'direct' ? (
                  <>
                    <span className={`inline-block align-middle mt-[1px] h-2 w-2 lg:h-2 lg:w-2 rounded-full ${peerStatus === 'Online' ? 'bg-violet-600' : 'bg-gray-400'}`}></span>
                    <RTooltip.Provider delayDuration={200} skipDelayDuration={0}>
                      <RTooltip.Root>
                        <RTooltip.Trigger asChild>
                          <span className="inline-block align-middle leading-[1.1] cursor-default">
                            {peerStatus || 'Direct Message'}
                          </span>
                        </RTooltip.Trigger>
                        {!peerOnline && peerLastSeen && (
                          <RTooltip.Portal>
                            <RTooltip.Content sideOffset={8} className={`rounded-md px-3 py-2 text-xs lg:text-sm shadow-lg border 
                              data-[state=open]:animate-in data-[state=closed]:animate-out 
                              data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 
                              data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 
                              data-[side=top]:slide-in-from-bottom-1 data-[side=bottom]:slide-in-from-top-1 
                              data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 
                              ${isDark ? 'bg-[#111827] text-gray-100 border-white/10' : 'bg-white text-gray-900 border-gray-200'}`}>
                              {peerStatusTitle}
                              <RTooltip.Arrow className={isDark ? 'fill-[#111827]' : 'fill-white'} />
                            </RTooltip.Content>
                          </RTooltip.Portal>
                        )}
                      </RTooltip.Root>
                    </RTooltip.Provider>
                    {typingUsers.length > 0 && <span className="italic text-gray-400">typing…</span>}
                  </>
                ) : (
                  <span>{`${(typeof activeRoom.member_count === 'number' && activeRoom.member_count > 0) ? activeRoom.member_count : (activeRoom.members?.length || 0)} members`}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" className={isDark ? 'hover:bg-violet-600 hover:text-white' : ''} onClick={(e) => { e.stopPropagation(); setShowHeaderSearch((s) => !s); setTimeout(() => { try { document.getElementById('chat-header-search')?.focus(); } catch(_){} }, 10); }}>
              <Search className="h-5 w-5" />
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setHeaderMenuOpen((s) => !s); }} className={isDark ? 'group hover:bg-violet-600 hover:text-white' : ''}>
                <MoreVertical className={`h-5 w-5 ${isDark ? 'text-gray-300 group-hover:text-white' : ''}`} />
              </Button>
              {headerMenuOpen && (
                <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-md py-1 z-20 ${isDark ? 'bg-[#13151a] border border-white/10 text-gray-100' : 'bg-white border border-gray-200'}`} onClick={(e) => e.stopPropagation()}>
                  {activeRoom.room_type === 'direct' && (
                    <button className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`} onClick={() => { setHeaderMenuOpen(false); setShowContactInfo(true); }}>
                      <Info className="h-4 w-4 mr-2" /> Contact info
                    </button>
                  )}
                  {activeRoom.room_type === 'group' && (
                    <>
                      <button className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`} onClick={() => { setHeaderMenuOpen(false); setShowGroupInfo(true); }}>
                        <Info className="h-4 w-4 mr-2" /> Group info
                      </button>
                      <button className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`} onClick={() => { setHeaderMenuOpen(false); setRenameInput(activeRoom?.name || ''); setShowRenamePanel(true); }}>
                        <Pencil className="h-4 w-4 mr-2" /> Rename group
                      </button>
                      <button className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`} onClick={() => { setHeaderMenuOpen(false); setShowMembersPanel(true); }}>
                        <Users className="h-4 w-4 mr-2" /> Manage members
                      </button>
                    </>
                  )}
                  <button className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`} onClick={async () => {
                    setHeaderMenuOpen(false);
                    if (!window.confirm('Clear all messages in this chat? This cannot be undone.')) return;
                    try {
                      // delete visible messages in Firestore
                      await Promise.all(messages.map(m => deleteMessageFS(activeRoom.id, m.id).catch(() => {})));
                      toast({ title: 'Chat cleared' });
                    } catch (_) {
                      toast({ title: 'Failed to clear chat', variant: 'destructive' });
                    }
                  }}><Eraser className="h-4 w-4 mr-2" /> Clear messages</button>
                  <div className={`${isDark ? 'border-t border-white/10 my-1' : 'border-t border-gray-200 my-1'}`} />
                  <button className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`} onClick={() => {
                    setHeaderMenuOpen(false);
                    setConfirmAction({ show: true, type: 'leave', room: activeRoom });
                  }}>
                    <LogOut className="h-4 w-4 mr-2" /> Leave chat
                  </button>
                  {((activeRoom?.room_type === 'group' ? isAdmin : (activeRoom?.created_by?.id === user?.id)) ) && (
                    <button className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5 text-red-400' : 'hover:bg-gray-50 text-red-600'}`} onClick={() => {
                      setHeaderMenuOpen(false);
                      setConfirmAction({ show: true, type: 'delete', room: activeRoom });
                    }}>
                      <Trash className="h-4 w-4 mr-2" /> Delete chat
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {showHeaderSearch && (
          <div className="mt-3">
            <Input
              id="chat-header-search"
              placeholder="Search messages…"
              value={messageSearchTerm}
              onChange={(e) => setMessageSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setShowHeaderSearch(false); setMessageSearchTerm(''); } }}
              className={`h-10 px-4 text-sm rounded-full text-center focus-visible:ring-0 focus-visible:ring-offset-0 ${isDark ? 'bg-[#151821] text-gray-100 placeholder:text-gray-400 border border-white/10' : 'bg-white border border-gray-200'}`}
            />
            {!!messageSearchTerm && (
              <div className="text-xs text-gray-500 mt-1">Filtering messages by “{messageSearchTerm}”. Press Esc to clear.</div>
            )}
          </div>
        )}
      </div>

      {/* Group Members Panel (overlay) */}
      {showMembersPanel && activeRoom?.room_type === 'group' && (
        <Portal>
          <div className="fixed inset-0 z-[1000] flex items-center justify-center" onClick={() => setShowMembersPanel(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className={`relative z-10 w-[420px] max-w-[95vw] rounded-md shadow-lg p-4 border ${
                isDark ? 'bg-[#13151a] text-gray-100 border-white/10' : 'bg-white text-gray-900 border-gray-200'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">Members ({(typeof activeRoom.member_count === 'number' && activeRoom.member_count > 0) ? activeRoom.member_count : (activeRoom.members?.length || 0)})</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMembersPanel(false)}
                  className={isDark ? 'hover:bg-violet-600 hover:text-white' : 'hover:bg-violet-600 hover:text-white'}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className={`max-h-60 overflow-y-auto custom-scrollbar divide-y ${isDark ? 'divide-white/10' : 'divide-gray-200'}`}>
                {(activeRoom.members || []).map(m => (
                  <div key={m.user.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      {m.user.profile_picture ? (
                        <img
                          src={m.user.profile_picture}
                          alt={m.user.full_name || 'User'}
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-medium bg-violet-600 text-white">
                          {getInitials(m.user.full_name || m.user.username || 'U')}
                        </div>
                      )}
                      <div className="text-sm">
                        <div className="font-medium">{m.user.full_name}</div>
                        <div className="text-xs opacity-70">{m.role}</div>
                      </div>
                    </div>
                    {isAdmin && m.user.id !== user?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={isDark ? 'hover:bg-violet-600 hover:text-white' : 'hover:bg-violet-600 hover:text-white'}
                        onClick={async () => {
                          try {
                            const res = await removeMember(activeRoom.id, m.user.id);
                            if (res.success) {
                              toast({ title: 'Member removed' });
                            } else {
                              toast({ title: 'Failed to remove', description: res.error, variant: 'destructive' });
                            }
                          } catch (_) {
                            toast({ title: 'Failed to remove', variant: 'destructive' });
                          }
                        }}
                      >Remove</Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <p className="text-sm mb-1">Invite members</p>
                <Input
                  placeholder="Search users…"
                  value={inviteSearch}
                  onChange={(e) => { setInviteSearch(e.target.value); if (e.target.value) searchUsers(e.target.value); }}
                  className={`${isDark ? 'mb-2 bg-[#151821] text-gray-100 placeholder:text-gray-400 border border-white/10' : 'mb-2'}`}
                />
                {inviteSelected.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {inviteSelected.map(u => (
                      <span key={u.id} className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100">{u.full_name}</span>
                    ))}
                  </div>
                )}
                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                  {!!inviteSearch.trim() && searchedUsers.length === 0 && (
                    <div className="text-xs opacity-70 px-1 py-2">No users found</div>
                  )}
                  {(searchedUsers || [])
                    .filter(u => !(activeRoom.members || []).some(m => m.user.id === u.id))
                    .filter(u => !inviteSelected.some(s => s.id === u.id))
                    .filter(u => u.id !== user?.id)
                    .map(u => (
                      <button
                        key={u.id}
                        className={`w-full text-left px-2 py-2 text-sm rounded ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                        onClick={() => setInviteSelected(prev => [...prev, u])}
                      >
                        <div className="flex items-center gap-2">
                          {u.profile_picture ? (
                            <img
                              src={u.profile_picture}
                              alt={u.full_name || u.username || 'User'}
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-medium bg-violet-600 text-white">
                              {getInitials(u.full_name || u.username || 'U')}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{u.full_name || u.username}</div>
                            {u.username && <div className="text-xs opacity-70">@{u.username}</div>}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <Button onClick={() => { setInviteSelected([]); setInviteSearch(''); setShowMembersPanel(false); }}>Close</Button>
                  <Button disabled={!isAdmin || inviteSelected.length === 0} onClick={async () => {
                    try {
                      const ids = inviteSelected.map(u => u.id);
                      const res = await addMembers(activeRoom.id, ids);
                      if (res.success) {
                        toast({ title: 'Invites sent' });
                        setInviteSelected([]);
                        setInviteSearch('');
                        setShowMembersPanel(false);
                      } else {
                        toast({ title: 'Failed to add', description: res.error, variant: 'destructive' });
                      }
                    } catch (_) {
                      toast({ title: 'Failed to add', variant: 'destructive' });
                    }
                  }}>Add</Button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Group Info Panel (group chats only) */}
      {activeRoom?.room_type === 'group' && showGroupInfo && (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center px-4" onClick={() => setShowGroupInfo(false)}>
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40" />
          {/* panel */}
          <div
            className={`${isDark ? 'bg-[#13151a] text-gray-100 border-white/10' : 'bg-white text-gray-900 border-gray-200'} relative w-full max-w-lg rounded-xl border shadow-xl p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12">
                  {groupAvatarPreview || activeRoom?.avatar_url ? (
                    <img
                      src={groupAvatarPreview || activeRoom?.avatar_url}
                      alt={activeRoom?.name || 'Group'}
                      className="h-12 w-12 rounded-full object-cover border"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-violet-600 flex items-center justify-center text-white text-sm font-medium">
                      <span>{getInitials(activeRoom?.name || 'G')}</span>
                    </div>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => groupAvatarInputRef.current?.click()}
                      className={`absolute -bottom-1 -right-1 h-7 w-7 flex items-center justify-center rounded-full border ${isDark ? 'bg-[#151821] text-gray-100 border-white/10 hover:bg-white/10' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-100'}`}
                      title="Edit avatar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {/* Hidden file input for group avatar */}
                  <input
                    ref={groupAvatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePickGroupAvatar}
                  />
                </div>
                <div>
                  <div className="text-base font-semibold">{activeRoom?.name || 'Group Chat'}</div>
                  <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span className="inline-block h-2 w-2 rounded-full bg-violet-600" />
                    <span>{activeRoom?.member_count || (activeRoom?.members?.length || 0)} members</span>
                  </div>
                </div>
              </div>
              <button className={`p-2 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`} onClick={() => setShowGroupInfo(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Save/cancel for avatar editing */}
            {isAdmin && groupAvatarFile && (
              <div className="mt-3 flex items-center gap-3">
                <div className="text-xs opacity-70 flex-1">
                  {groupAvatarUploading ? `Uploading... ${Math.round(groupAvatarProgress)}%` : 'New avatar selected (not saved)'}
                </div>
                <Button variant="ghost" onClick={handleCancelGroupAvatar} disabled={groupAvatarUploading}>Cancel</Button>
                <Button onClick={handleSaveGroupAvatar} disabled={groupAvatarUploading}>
                  {groupAvatarUploading ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}

            {/* summary */}
            <div className={`mt-4 grid grid-cols-2 gap-3 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <div>
                <div className="text-xs uppercase opacity-60">Owner</div>
                <div>{activeRoom?.created_by?.full_name || activeRoom?.created_by?.username || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-xs uppercase opacity-60">Your role</div>
                <div>{(currentMember?.role || 'member')}</div>
              </div>
              <div>
                <div className="text-xs uppercase opacity-60">Members</div>
                <div>{activeRoom?.member_count || (activeRoom?.members?.length || 0)}</div>
              </div>
              {activeRoom?.created_at && (
                <div>
                  <div className="text-xs uppercase opacity-60">Created on</div>
                  <div>{formatDateTime(activeRoom.created_at)}</div>
                </div>
              )}
            </div>

            {/* members list */}
            <div className={`mt-4 ${isDark ? 'divide-white/10' : 'divide-gray-200'} divide-y max-h-64 overflow-y-auto custom-scrollbar`}>
              {(activeRoom?.members || [])
                .slice()
                .sort((a, b) => {
                  const order = { admin: 0, owner: 1, member: 2 };
                  const ra = order[a.role] ?? 99;
                  const rb = order[b.role] ?? 99;
                  if (ra !== rb) return ra - rb;
                  const na = (a.user.full_name || a.user.username || '').toLowerCase();
                  const nb = (b.user.full_name || b.user.username || '').toLowerCase();
                  return na.localeCompare(nb);
                })
                .map(m => (
                <div key={`gi-${m.user.id}`} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {m.user.profile_picture ? (
                      <img src={m.user.profile_picture} alt={m.user.full_name || m.user.username || 'User'} className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center">
                        {getInitials(m.user.full_name || m.user.username || 'U')}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm truncate">{m.user.full_name || m.user.username}</div>
                      <div className="text-xs opacity-70 truncate">@{m.user.username || 'user'}{m.user.email ? ` · ${m.user.email}` : ''}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    m.role === 'owner'
                      ? 'bg-violet-600 text-white'
                      : isDark ? 'bg-white/10 text-gray-100' : 'bg-gray-100 text-gray-800'
                  }`}>{m.role}</span>
                </div>
              ))}
            </div>

            {/* actions removed per request; Group Info overlay is informational only */}
          </div>
        </div>
      )}

      {/* Rename Group Panel (overlay) */}
      {showRenamePanel && activeRoom?.room_type === 'group' && (
        <Portal>
          <div className="fixed inset-0 z-[1000] flex items-center justify-center" onClick={() => setShowRenamePanel(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className={`relative z-10 w-[420px] max-w-[95vw] rounded-md shadow-lg p-4 border ${
                isDark ? 'bg-[#13151a] text-gray-100 border-white/10' : 'bg-white text-gray-900 border-gray-200'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold">Rename group</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRenamePanel(false)}
                className={isDark ? 'hover:bg-violet-600 hover:text-white' : 'hover:bg-violet-600 hover:text-white'}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <Input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Enter new group name"
              className={`${isDark ? 'mb-3 bg-[#151821] text-gray-100 placeholder:text-gray-400 border border-white/10' : 'mb-3'}`}
            />
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowRenamePanel(false)}>Cancel</Button>
              <Button disabled={!isAdmin || !renameInput.trim()} onClick={async () => {
                try {
                  const res = await renameRoom(activeRoom.id, renameInput.trim());
                  if (res.success) {
                    toast({ title: 'Group renamed' });
                    setShowRenamePanel(false);
                  } else {
                    toast({ title: 'Failed to rename', description: res.error, variant: 'destructive' });
                  }
                } catch (_) {
                  toast({ title: 'Failed to rename', variant: 'destructive' });
                }
              }}>Save</Button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto p-4 custom-scrollbar ${isDark ? 'bg-[#0f1115]' : 'bg-[#f7f8fa]'}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
          pinnedToBottomRef.current = nearBottom;
          if (el.scrollTop === 0) {
            // record current scrollHeight to maintain position after older messages load
            loadingOlderRef.current = { prevScrollHeight: el.scrollHeight };
            increaseMessagesLimit(50);
          }
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-[#1b2028] border border-white/10' : 'bg-violet-50 border border-violet-200 shadow-sm'}`}>
                <MessageSquare className={`h-8 w-8 ${isDark ? 'text-violet-500' : 'text-violet-600'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                Start the conversation
              </h3>
              <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Send a message to get things started!
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Day dividers */}
            {(messageSearchTerm ? messages.filter(m => (m.text || '').toLowerCase().includes(messageSearchTerm.toLowerCase())) : messages).map((msg, idx, arr) => {
              const prev = arr[idx - 1];
              const prevDate = prev ? toDateSafe(prev.timestamp) : null;
              const curDate = toDateSafe(msg.timestamp);
              const showDate = !prev || !prevDate || !curDate || !isSameDay(prevDate, curDate) ;
              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className={`text-[11px] shadow-sm rounded-full px-3 py-1 ${isDark ? 'text-gray-300 bg-[#1b2028] border border-white/10' : 'text-gray-600 bg-white border border-gray-200'}`}>
                        {formatDayLabel(curDate)}
                      </span>
                    </div>
                  )}
                  {renderMessage(msg)}
                </React.Fragment>
              );
            })}
            
            {/* Typing indicator */}
            {typingUsers.length > 0 && (
              <div className="flex justify-start mb-4">
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-lg">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {typingUsers.map(u => u.user_name).join(', ')} typing...
                  </span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className={`p-4 ${isDark ? 'bg-[#13151a] border-t border-white/10' : 'bg-white border-t border-gray-200'}`} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        <form onSubmit={handleSendMessage}>
          {/* Reply preview */}
          {replyTo && (
            <div className={`mb-2 px-3 py-2 rounded flex items-start justify-between gap-3 ${isDark ? 'bg-[#151821] border border-white/10 text-gray-100' : 'bg-gray-50 border border-gray-200 text-gray-800'}`}>
              <div className="text-sm min-w-0">
                <div className="text-xs opacity-70">Replying to {replyTo.sender_name || 'message'}</div>
                {replyTo.text ? (
                  <div className="truncate">{replyTo.text}</div>
                ) : replyTo.file_name ? (
                  <div className="truncate flex items-center gap-2"><Paperclip className="h-3 w-3" /> {replyTo.file_name}</div>
                ) : (
                  <div className="truncate">Attachment</div>
                )}
              </div>
              <button
                type="button"
                className={`text-xs px-2 py-1 rounded self-center ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}
                onClick={() => setReplyTo(null)}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Pending attachment chip */}
          {pendingAttachment && (
            <div className={`mb-2 px-3 py-2 rounded flex items-center gap-3 ${isDark ? 'bg-[#151821] border border-white/10 text-gray-100' : 'bg-gray-50 border border-gray-200 text-gray-800'}`}>
              {pendingAttachment.type === 'image' && pendingAttachment.previewUrl ? (
                <img src={pendingAttachment.previewUrl} alt="preview" className="h-9 w-9 rounded object-cover border" />
              ) : (
                <div className={`h-9 w-9 rounded flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                  <Paperclip className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{pendingAttachment.file?.name || 'Attachment'}</div>
                {typeof pendingAttachment.file?.size === 'number' && (
                  <div className="text-xs opacity-70 truncate">{formatBytes(pendingAttachment.file.size)}</div>
                )}
              </div>
              <button
                type="button"
                className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}
                onClick={clearAttachment}
              >
                Remove
              </button>
            </div>
          )}
          {/* Hidden pickers */}
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
          <input ref={fileInputRef} type="file" className="hidden" onChange={handlePickFile} />

          {/* Unified pill input bar */}
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-1.5 transition focus-within:ring-2 focus-within:ring-violet-600/40 ${
              isDark
                ? 'bg-[#151821] border border-white/10'
                : 'bg-white border border-gray-200 shadow-sm'
            }`}
          >
            {/* Attach buttons */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-full ${isDark ? 'group text-gray-300 hover:bg-violet-600 hover:text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className={`h-5 w-5 ${isDark ? 'group-hover:text-white' : ''}`} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={`h-9 w-9 rounded-full ${isDark ? 'group text-gray-300 hover:bg-violet-600 hover:text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              onClick={() => imageInputRef.current?.click()}
            >
              <Image className={`h-5 w-5 ${isDark ? 'group-hover:text-white' : ''}`} />
            </Button>

            {/* Text input */}
            <Input
              ref={inputRef}
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className={`flex-1 h-10 rounded-full border-0 bg-transparent px-3 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                isDark ? 'text-gray-100 placeholder:text-gray-400' : 'text-gray-900 placeholder:text-gray-500'
              }`}
            />

            {/* Emoji picker trigger */}
            <div className="relative" ref={emojiAnchorRef}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`h-9 w-9 rounded-full ${isDark ? 'group text-gray-300 hover:bg-violet-600 hover:text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                onClick={() => {
                  const next = !showEmoji;
                  if (next) {
                    try {
                      const rect = emojiAnchorRef.current?.getBoundingClientRect();
                      if (rect) {
                        const pickerW = 340; // approximate width
                        const pickerH = 380; // approximate height
                        const gap = 8;
                        const left = Math.min(
                          Math.max(0, rect.right - pickerW),
                          window.innerWidth - pickerW - 8
                        );
                        const top = Math.max(0, rect.top - pickerH - gap);
                        setEmojiPos({ top, left });
                      }
                    } catch (_) {}
                  }
                  setShowEmoji(next);
                }}
              >
                <Smile className={`h-5 w-5 ${isDark ? 'group-hover:text-white' : ''}`} />
              </Button>
              {showEmoji && (
                <div
                  ref={emojiPanelRef}
                  className="fixed z-[1000]"
                  style={{ top: emojiPos.top, left: emojiPos.left }}
                >
                  <Picker
                    data={data}
                    theme={isDark ? 'dark' : 'light'}
                    searchPosition="top"
                    previewPosition="none"
                    navPosition="top"
                    emojiSize={22}
                    perLine={8}
                    className="flowchat-emoji"
                    onEmojiSelect={(e) => {
                      const toAdd = e.native || e.shortcodes || '';
                      setMessage((m) => `${m}${toAdd}`);
                      inputRef.current?.focus();
                    }}
                  />
                </div>
              )}
            </div>

            {/* Send */}
            <Button
              type="submit"
              disabled={!message.trim() && !pendingAttachment}
              className={`h-9 w-9 rounded-full p-0 transition-colors ${
                message.trim() || pendingAttachment
                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                  : isDark
                    ? 'bg-white/5 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Uploading progress */}
          {uploading && (
            <div className="mt-2 h-1 rounded-full overflow-hidden bg-black/10">
              <div
                className="h-full bg-violet-600 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, Math.round(uploadProgress)))}%` }}
              />
            </div>
          )}
        </form>
      </div>
      {/* Contact Info Panel (direct chats only, centered over entire chat area) */}
      {activeRoom?.room_type === 'direct' && showContactInfo && (
        <div className="absolute inset-0 z-[1200] flex items-center justify-center px-4"
             onClick={() => setShowContactInfo(false)}>
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/40 animate-in fade-in-0 duration-150" />
          {/* panel */}
          <div
            className={`${isDark ? 'bg-[#13151a] text-gray-100 border-white/10' : 'bg-white text-gray-900 border-gray-200'} relative w-full max-w-md rounded-xl border shadow-xl p-5 
            animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-primary flex items-center justify-center text-white text-sm font-medium">
                  {(() => {
                    const peer = peerUser; // computed above
                    if (peer?.profile_picture) {
                      return <img src={peer.profile_picture} alt={peer.full_name || 'User'} className="h-full w-full object-cover" />;
                    }
                    return <span>{getInitials(peer?.full_name || 'U')}</span>;
                  })()}
                </div>
                <div>
                  <div className="text-base font-semibold">{peerUser?.full_name || 'User'}</div>
                  <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span className={`inline-block h-2 w-2 rounded-full ${peerStatus === 'Online' ? 'bg-violet-600' : 'bg-gray-400'}`}></span>
                    <RTooltip.Provider delayDuration={200}>
                      <RTooltip.Root>
                        <RTooltip.Trigger asChild>
                          <span className="cursor-default">{peerStatus || 'Offline'}</span>
                        </RTooltip.Trigger>
                        {!peerOnline && peerLastSeen && (
                          <RTooltip.Portal>
                            <RTooltip.Content sideOffset={8} className={`rounded-md px-3 py-2 text-xs lg:text-sm shadow-lg border ${isDark ? 'bg-[#111827] text-gray-100 border-white/10' : 'bg-white text-gray-900 border-gray-200'}`}>
                              {peerStatusTitle}
                              <RTooltip.Arrow className={isDark ? 'fill-[#111827]' : 'fill-white'} />
                            </RTooltip.Content>
                          </RTooltip.Portal>
                        )}
                      </RTooltip.Root>
                    </RTooltip.Provider>
                  </div>
                </div>
              </div>
              <button className={`p-2 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`} onClick={() => setShowContactInfo(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* details */}
            <div className={`mt-4 space-y-3 ${isDark ? 'divide-white/10' : 'divide-gray-200'} divide-y`}>
              <div className="pt-2">
                <div className="text-xs uppercase tracking-wide opacity-60 mb-1">Username</div>
                <div className="text-sm">{peerUser?.username ? `@${peerUser.username}` : 'Not available'}</div>
              </div>
              <div className="pt-2">
                <div className="text-xs uppercase tracking-wide opacity-60 mb-1">About</div>
                <div className="text-sm">{loadingPeerProfile ? 'Loading…' : (peerProfile?.bio || 'No bio')}</div>
              </div>
              <div className="pt-2">
                <div className="text-xs uppercase tracking-wide opacity-60 mb-1">Contact</div>
                <div className="text-sm break-all">{peerUser?.email || peerUser?.username || 'Not available'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu.open && ctxMenu.msg && (
        <div
          className={`fixed z-50 rounded-md shadow-lg py-1 text-sm select-none ${isDark ? 'bg-[#0f1116]/98 backdrop-blur border border-white/10 text-gray-100' : 'bg-white/95 backdrop-blur border text-gray-800'}`}
          style={{
            left: Math.min(Math.max(0, ctxMenu.x), window.innerWidth - 184),
            top: Math.min(Math.max(0, ctxMenu.y), window.innerHeight - 100),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className={`block w-full text-left px-3 py-1.5 whitespace-nowrap ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`} onClick={() => { setReplyTo(ctxMenu.msg); closeContextMenu(); }}>Reply</button>
          <button className={`block w-full text-left px-3 py-1.5 whitespace-nowrap ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`} onClick={() => { navigator.clipboard.writeText(ctxMenu.msg.text || ctxMenu.msg.file_url || ''); closeContextMenu(); toast({ title: 'Copied' }); }}>Copy</button>
          {ctxMenu.msg.sender_id === user?.id && activeRoom?.room_type === 'group' && (
            <button
              className={`block w-full text-left px-3 py-1.5 whitespace-nowrap ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
              onClick={() => {
                try {
                  const participants = (activeRoom?.members || []).filter(m => String(m.user.id) !== String(user?.id));
                  const readersIds = (readMap[ctxMenu.msg.id] || []).map(String);
                  const readers = participants.filter(m => readersIds.includes(String(m.user.id))).map(m => m.user);
                  const nonReaders = participants.filter(m => !readersIds.includes(String(m.user.id))).map(m => m.user);
                  // clamp popover position too
                  const vw = window.innerWidth || 0;
                  const vh = window.innerHeight || 0;
                  const PANEL_W = 280;
                  const PANEL_H = 320;
                  const PADDING = 8;
                  let x = ctxMenu.x + 8;
                  let y = ctxMenu.y + 8;
                  if (x + PANEL_W + PADDING > vw) x = Math.max(PADDING, vw - PANEL_W - PADDING);
                  if (y + PANEL_H + PADDING > vh) y = Math.max(PADDING, vh - PANEL_H - PADDING);
                  setReadsPanel({ open: true, x, y, msg: ctxMenu.msg, readers, nonReaders });
                } catch (_) {}
                closeContextMenu();
              }}
            >
              Read receipts
            </button>
          )}
          {ctxMenu.msg.sender_id === user?.id && (
            <button className={`block w-full text-left px-3 py-1.5 whitespace-nowrap ${isDark ? 'hover:bg-white/5 text-red-400' : 'hover:bg-gray-100 text-red-600'}`} onClick={() => handleDeleteMessage(ctxMenu.msg)}>Delete</button>
          )}
          <button className={`block w-full text-left px-3 py-1.5 whitespace-nowrap ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`} onClick={() => handleForwardMessage(ctxMenu.msg)}>Forward</button>
        </div>
      )}

      {/* Read receipts popover */}
      {readsPanel.open && readsPanel.msg && (
        <div
          className={`fixed z-50 rounded-md shadow-lg p-3 text-sm ${isDark ? 'bg-[#0f1116]/98 backdrop-blur border border-white/10 text-gray-100' : 'bg-white/95 backdrop-blur border text-gray-800'}`}
          style={{ left: readsPanel.x, top: readsPanel.y, minWidth: 260 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 font-medium">Read receipts</div>
          {readsPanel.readers.length === 0 && readsPanel.nonReaders.length === 0 && (
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No recipients</div>
          )}
          {readsPanel.readers.length > 0 && (
            <div className="mb-2">
              <div className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Read</div>
              <div className="space-y-1">
                {readsPanel.readers.map(u => (
                  <div key={`r-${u.id}`} className="flex items-center gap-2">
                    {u.profile_picture ? (
                      <img src={u.profile_picture} alt={u.full_name || u.username || 'User'} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center">{getInitials(u.full_name || u.username || 'U')}</div>
                    )}
                    <div className="truncate">{u.full_name || u.username}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {readsPanel.nonReaders.length > 0 && (
            <div>
              <div className={`text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Delivered</div>
              <div className="space-y-1">
                {readsPanel.nonReaders.map(u => (
                  <div key={`nr-${u.id}`} className="flex items-center gap-2">
                    {u.profile_picture ? (
                      <img src={u.profile_picture} alt={u.full_name || u.username || 'User'} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-gray-400/40 text-white text-[10px] flex items-center justify-center">{getInitials(u.full_name || u.username || 'U')}</div>
                    )}
                    <div className="truncate">{u.full_name || u.username}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox */}
      {previewImg && (
        <div
          className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-4"
          onClick={() => setPreviewImg(null)}
        >
          <div
            className={`relative max-w-[95vw] max-h-[90vh] ${isDark ? 'bg-[#0f1115]' : 'bg-white'} rounded-lg shadow-xl border ${isDark ? 'border-white/10' : 'border-gray-200'} p-2`}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImg.url}
              alt={previewImg.name || 'image'}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className={`text-xs truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{previewImg.name || 'Image'}</p>
              <div className="flex items-center gap-2">
                <a
                  href={previewImg.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline"
                >
                  Open original
                </a>
                <a
                  href={previewImg.url}
                  download
                  className="text-xs underline"
                >
                  Download
                </a>
                <button
                  className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-white/10 hover:bg-white/20 text-gray-100' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                  onClick={() => setPreviewImg(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirm leave/delete overlay (scoped to chat area) */}
      {confirmAction.show && (
        <Portal>
          <div className="fixed inset-0 z-[1000] flex items-center justify-center" onClick={() => setConfirmAction({ show: false, type: null, room: null })}>
            <div className="absolute inset-0 bg-black/40" />
            <div
              className={`relative z-10 rounded-md shadow-lg p-5 w-80 border ${isDark ? 'bg-[#13151a] text-gray-100 border-white/10' : 'bg-white text-gray-900 border-gray-200'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">
                {confirmAction.type === 'delete' ? 'Delete chat?' : 'Leave chat?'}
              </h3>
              <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {confirmAction.type === 'delete'
                  ? 'This will permanently remove the chat for all members.'
                  : 'You will no longer see this chat in your list.'}
              </p>
              <div className="flex justify-end space-x-2">
                <Button onClick={() => setConfirmAction({ show: false, type: null, room: null })}>Cancel</Button>
                {confirmAction.type === 'delete' ? (
                  <Button variant="destructive" onClick={handleDeleteRoom}>Delete</Button>
                ) : (
                  <Button onClick={handleLeaveRoom}>Leave</Button>
                )}
              </div>
            </div>
          </div>
          </Portal>
      )}
    </div>
  );
};

export default ChatWindow;
