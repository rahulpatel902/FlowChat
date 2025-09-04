import React, { useState, useEffect } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/use-toast';
import { 
  Search, 
  Plus, 
  MessageCircle, 
  Users, 
  Pencil,
  Settings,
  User,
  X,
  MoreVertical,
  Trash,
  LogOut,
  Sun,
  Moon,
  MessageSquare,
} from 'lucide-react';
import { formatTime, getInitials } from '../../lib/utils';
import ProfilePanel from '../profile/ProfilePanel';

const ChatSidebar = ({ onClose, isDark = false, setIsDark }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatMode, setNewChatMode] = useState('direct'); // 'direct' | 'group'
  const [filter, setFilter] = useState('all'); // all | unread | favourites | groups
  const [newUserSearch, setNewUserSearch] = useState('');
  const { rooms, activeRoom, selectRoom, createDirectMessage, createRoom, searchUsers, searchedUsers, loadRooms, renameRoom, addMembers, removeMember } = useChat();
  const { user } = useAuth();
  const { toast } = useToast();
  const [openMenuRoomId, setOpenMenuRoomId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]); // array of user objects
  // Group management state
  const [renameState, setRenameState] = useState({ show: false, room: null, name: '' });
  const [manageState, setManageState] = useState({ show: false, room: null });
  const [manageSearch, setManageSearch] = useState('');
  const [manageSelected, setManageSelected] = useState([]); // users to add

  const filteredRooms = rooms
    // filter by tab
    .filter((room) => {
      if (filter === 'all') return true;
      if (filter === 'unread') {
        const lastSenderId = room.last_message_preview?.sender_id ?? room.last_message?.sender?.id;
        return (room.unread_count || 0) > 0 && !!lastSenderId && lastSenderId !== user.id;
      }
      if (filter === 'groups') return room.room_type === 'group';
      return true;
    })
    // filter by search term
    .filter(room => {
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      const inName = room.name?.toLowerCase().includes(term);
      const inMember = room.members?.some(m => m.user.full_name.toLowerCase().includes(term));
      const inPreview = room.last_message_preview?.text?.toLowerCase().includes(term);
      return inName || inMember || inPreview;
    })
    // hide empty DMs for non-creators until the first message is sent
    .filter(room => {
      const isEmptyDM = room.room_type === 'direct' && !room.last_message_preview;
      const isCreator = room?.created_by?.id === user.id;
      return !(isEmptyDM && !isCreator);
    });

  const handleRoomSelect = (room) => {
    selectRoom(room);
    if (onClose) onClose();
  };

    useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (showNewChat && newUserSearch) {
        searchUsers(newUserSearch);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [newUserSearch, showNewChat, searchUsers]);

  // Close the per-room context menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!openMenuRoomId) return;
    const handleMouseDown = () => setOpenMenuRoomId(null);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenMenuRoomId(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuRoomId]);

  const handleNewDirectMessage = async (recipientId) => {
    const result = await createDirectMessage(recipientId);
    if (result.success) {
      selectRoom(result.room);
      setShowNewChat(false);
      setNewChatMode('direct');
      setNewUserSearch('');
      setSelectedMembers([]);
      setGroupName('');
      if (onClose) onClose();
    } else {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  const toggleSelectMember = (u) => {
    setSelectedMembers((prev) => {
      const exists = prev.some((x) => x.id === u.id);
      if (exists) return prev.filter((x) => x.id !== u.id);
      return [...prev, u];
    });
  };

  const handleCreateGroup = async () => {
    const name = (groupName || '').trim();
    if (!name) {
      toast({ title: 'Group name required', variant: 'destructive' });
      return;
    }
    // At least 1 other member besides me
    if (selectedMembers.length < 1) {
      toast({ title: 'Select at least one member', variant: 'destructive' });
      return;
    }
    try {
      const payload = {
        name,
        room_type: 'group',
        member_ids: selectedMembers.map((m) => m.id),
      };
      const result = await createRoom(payload);
      if (result.success) {
        selectRoom(result.room);
        setShowNewChat(false);
        setNewChatMode('direct');
        setNewUserSearch('');
        setSelectedMembers([]);
        setGroupName('');
        if (onClose) onClose();
        toast({ title: 'Group created' });
      } else {
        toast({ title: 'Failed to create group', description: result.error || '', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Failed to create group', variant: 'destructive' });
    }
  };

  // Leave/Delete confirmations are now handled in ChatWindow via overlays opened by events

  return (
    <div className={`relative h-full flex flex-col ${isDark ? 'bg-[#0f1115] border-r border-white/10 text-gray-100' : 'bg-white border-r border-gray-200'}`}>
      {/* Header */}
      <div className={`p-4 ${isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-md flex items-center justify-center shadow-sm ${isDark ? 'bg-violet-600 ring-1 ring-white/10' : 'bg-violet-600 ring-2 ring-violet-300 shadow'}`}>
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <h1 className={`text-xl font-semibold tracking-tight ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>FlowChat</h1>
          </div>
          <div className="flex items-center space-x-2">
            {typeof setIsDark === 'function' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDark((d) => !d)}
                title={isDark ? 'Switch to Light' : 'Switch to Dark'}
                className={isDark ? 'hover:bg-violet-600 hover:text-white' : ''}
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNewChat(true)}
              className={isDark ? 'hover:bg-violet-600 hover:text-white' : ''}
            >
              <Plus className="h-5 w-5" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="lg:hidden group hover:bg-violet-600 hover:text-white"
              >
                <X className="h-5 w-5 group-hover:text-white" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isDark ? 'text-gray-300' : 'text-gray-400'}`} />
          <Input
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-10 ${isDark ? 'bg-[#151821] text-gray-100 placeholder:text-gray-400 border border-transparent focus-visible:ring-0 focus-visible:ring-offset-0' : ''}`}
          />
        </div>

        {/* Filters */}
        <div className="mt-3 flex items-center gap-2 text-sm">
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'groups', label: 'Groups' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1 rounded-full border transition-colors ${
                isDark
                  ? (filter === tab.key
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-transparent text-gray-300 border-white/20 hover:bg-white/5')
                  : (filter === tab.key
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredRooms.length === 0 ? (
          <div className={`h-full flex flex-col items-center justify-center px-4 text-center transform -translate-y-6 md:-translate-y-10 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <MessageSquare className={`h-12 w-12 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <p className={`${isDark ? 'text-gray-300' : ''}`}>No chats found</p>
            <Button
              className="mt-2"
              onClick={() => setShowNewChat(true)}
            >
              Start a new chat
            </Button>
          </div>
        ) : (
          <div className={`${isDark ? 'divide-white/5' : 'divide-gray-100'}`}>
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => handleRoomSelect(room)}
                className={`p-4 cursor-pointer transition-colors relative border-b ${
                  isDark 
                    ? `border-white/5 ${String(activeRoom?.id) === String(room.id) ? 'bg-[#151821]' : 'hover:bg-white/5'}`
                    : `border-gray-100 ${String(activeRoom?.id) === String(room.id) ? 'bg-violet-50' : 'hover:bg-gray-50'}`
                }`}
              >
                {/* Active chat indicator */}
                {String(activeRoom?.id) === String(room.id) && (
                  <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-violet-600"></div>
                )}
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {room.room_type === 'direct' ? (() => {
                      const other = room.members?.find(m => m.user.id !== user.id)?.user;
                      const avatarUrl = other?.profile_picture;
                      return avatarUrl ? (
                        <img src={avatarUrl} alt={other?.full_name || 'User'} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
                          {getInitials(other?.full_name || 'U')}
                        </div>
                      );
                    })() : (
                      room.avatar_url ? (
                        <img
                          src={room.avatar_url}
                          alt={room.name || 'Group'}
                          className="h-10 w-10 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-medium">
                          {getInitials(room.name || 'G')}
                        </div>
                      )
                    )}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        {room.room_type === 'direct' 
                          ? room.members?.find(m => m.user.id !== user.id)?.user.full_name || 'Unknown'
                          : room.name || 'Group Chat'
                        }
                      </p>
                      <p className={`text-sm truncate ${room.unread_count ? (isDark ? 'text-gray-100 font-medium' : 'text-gray-900 font-medium') : (isDark ? 'text-gray-400' : 'text-gray-500')}`}>
                        {room.last_message_preview ? (
                          <>
                            {room.last_message_preview.sender_id === user.id ? 'You: ' : ''}
                            {room.last_message_preview.message_type === 'text'
                              ? (room.last_message_preview.text || 'Message')
                              : room.last_message_preview.message_type === 'image'
                                ? 'Photo'
                                : 'File'}
                          </>
                        ) : (
                          'No messages yet'
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end justify-center ml-2">
                      {room.last_message_preview && room.last_message_preview.timestamp && (
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {formatTime(room.last_message_preview.timestamp)}
                        </p>
                      )}
                      {room.unread_count > 0 && !!room.last_message_preview?.sender_id && room.last_message_preview?.sender_id !== user.id && activeRoom?.id !== room.id && (
                        <span className="mt-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-white text-[10px]">
                          {room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item actions */}
                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setOpenMenuRoomId(openMenuRoomId === room.id ? null : room.id)}
                      className={
                        isDark
                          ? 'group text-gray-300 hover:bg-violet-600 hover:text-white'
                          : ''
                      }
                    >
                      <MoreVertical className={`h-4 w-4 ${isDark ? 'text-gray-300 group-hover:text-white' : 'text-gray-500'}`} />
                    </Button>
                    {openMenuRoomId === room.id && (
                      <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg z-20 ${isDark ? 'bg-[#13151a] border border-white/10' : 'bg-white border border-gray-200'}`}>
                        {room.room_type === 'group' && (
                          <>
                            <button
                              className={`w-full text-left px-3 py-2 text-sm flex items-center whitespace-nowrap ${isDark ? 'hover:bg-white/5 text-gray-100' : 'hover:bg-gray-50'}`}
                              onClick={() => {
                                setOpenMenuRoomId(null);
                                // ensure the clicked room is active so ChatWindow context matches
                                const needsSwitch = activeRoom?.id !== room.id;
                                if (needsSwitch) {
                                  selectRoom(room);
                                }
                                // Give ChatWindow time to mount and attach listeners
                                setTimeout(() => window.dispatchEvent(new Event('open-rename-group')), needsSwitch ? 250 : 50);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" /> Rename group
                            </button>
                            <button
                              className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5 text-gray-100' : 'hover:bg-gray-50'}`}
                              onClick={() => {
                                setOpenMenuRoomId(null);
                                const needsSwitch = activeRoom?.id !== room.id;
                                if (needsSwitch) {
                                  selectRoom(room);
                                }
                                // Give ChatWindow time to mount and attach listeners
                                setTimeout(() => window.dispatchEvent(new Event('open-group-members')), needsSwitch ? 250 : 50);
                              }}
                            >
                              <Users className="h-4 w-4 mr-2" /> Manage members
                            </button>
                            <div className={isDark ? 'border-t border-white/10' : 'border-t border-gray-100'} />
                          </>
                        )}
                        <button
                          className={`w-full text-left px-3 py-2 text-sm flex items-center whitespace-nowrap ${isDark ? 'hover:bg-white/5 text-gray-100' : 'hover:bg-gray-50'}`}
                          onClick={() => {
                            setOpenMenuRoomId(null);
                            const needsSwitch = activeRoom?.id !== room.id;
                            if (needsSwitch) selectRoom(room);
                            setTimeout(() => window.dispatchEvent(new Event('open-leave-chat')), needsSwitch ? 250 : 50);
                          }}
                        >
                          <LogOut className="h-4 w-4 mr-2" /> Leave chat
                        </button>
                        {(((room.room_type === 'group')
                            ? (['admin','owner'].includes((room.members || []).find(m => m.user.id === user.id)?.role))
                            : (room.created_by?.id === user.id)
                          )) && (
                          <button
                            className={`w-full text-left px-3 py-2 text-sm flex items-center whitespace-nowrap ${isDark ? 'hover:bg-white/5 text-red-400' : 'hover:bg-gray-50 text-red-600'}`}
                            onClick={() => {
                              setOpenMenuRoomId(null);
                              const needsSwitch = activeRoom?.id !== room.id;
                              if (needsSwitch) selectRoom(room);
                              setTimeout(() => window.dispatchEvent(new Event('open-delete-chat')), needsSwitch ? 250 : 50);
                            }}
                          >
                            <Trash className="h-4 w-4 mr-2" /> Delete chat
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className={`p-4 ${isDark ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
        <div className="flex items-center space-x-3">
          {user?.profile_picture ? (
            <img src={user.profile_picture} alt={user?.full_name || 'Me'} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium">
              {getInitials(user?.full_name || 'U')}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              {user?.full_name}
            </p>
            <div className="flex items-center space-x-1">
              <div className={`h-2 w-2 rounded-full ${user?.is_online ? 'bg-violet-500' : 'bg-gray-400'}`} />
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {user?.is_online ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowProfile(true)}
            title="Profile"
            className={isDark ? 'hover:bg-violet-600 hover:text-white' : ''}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className={`absolute inset-0 z-10 ${isDark ? 'bg-[#0f1115]' : 'bg-white'}`}>
          <div className={`p-4 ${isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Chat</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setShowNewChat(false); setNewChatMode('direct'); setSelectedMembers([]); setGroupName(''); setNewUserSearch(''); }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            {/* Mode toggle */}
            <div className="flex items-center gap-2 mb-3 text-sm">
              {['direct','group'].map(mode => (
                <button
                  key={mode}
                  onClick={() => { setNewChatMode(mode); setSelectedMembers([]); setGroupName(''); }}
                  className={`px-3 py-1 rounded-full border transition-colors ${
                    isDark
                      ? (newChatMode === mode
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-transparent text-gray-300 border-white/20 hover:bg-white/5')
                      : (newChatMode === mode
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50')
                  }`}
                >
                  {mode === 'direct' ? 'Direct' : 'Group'}
                </button>
              ))}
            </div>

            {newChatMode === 'group' && (
              <div className="mb-4">
                <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Group name</label>
                <Input
                  placeholder="e.g. Project Alpha"
                  className={`${isDark ? 'bg-[#151821] text-gray-100 placeholder:text-gray-400 border border-transparent focus-visible:ring-0 focus-visible:ring-offset-0' : ''}`}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
            )}

            <p className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              {newChatMode === 'direct' ? 'Search for a user to start a conversation' : 'Search and select users to add to the group'}
            </p>
            <Input
              placeholder="Search users..."
              className={`mb-2 ${isDark ? 'bg-[#151821] text-gray-100 placeholder:text-gray-400 border border-transparent focus-visible:ring-0 focus-visible:ring-offset-0' : ''}`}
              value={newUserSearch}
              onChange={(e) => setNewUserSearch(e.target.value)}
            />
            <p className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Type exact @username or email
            </p>

            {newChatMode === 'group' && selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedMembers.map(m => (
                  <span key={m.id} className={`px-2 py-1 text-xs rounded-full ${isDark ? 'bg-white/10 text-gray-100' : 'bg-gray-100 text-gray-800'}`}>
                    {m.full_name}
                  </span>
                ))}
              </div>
            )}
            <div className="overflow-y-auto h-64 custom-scrollbar">
              {newUserSearch.trim() === '' ? (
                <div className={`text-center mt-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <User className={`h-12 w-12 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p>Search for users to start chatting</p>
                </div>
              ) : searchedUsers.length === 0 ? (
                <div className={`text-center mt-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <User className={`h-12 w-12 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                  <p>No exact match found</p>
                </div>
              ) : (
                searchedUsers.map(foundUser => {
                  const isSelf = foundUser.id === user.id;
                  const isSelected = selectedMembers.some((m) => m.id === foundUser.id);
                  return (
                    <div
                      key={foundUser.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${isSelf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
                      onClick={() => {
                        if (isSelf) {
                          toast({ title: 'Cannot select yourself', variant: 'destructive' });
                          return;
                        }
                        if (newChatMode === 'direct') {
                          handleNewDirectMessage(foundUser.id);
                        } else {
                          toggleSelectMember(foundUser);
                        }
                      }}
                    >
                      <div className="flex items-center">
                        {foundUser.profile_picture ? (
                          <img
                            src={foundUser.profile_picture}
                            alt={foundUser.full_name || foundUser.username || 'User'}
                            className="h-8 w-8 rounded-full object-cover mr-3"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-medium mr-3">
                            {getInitials(foundUser.full_name || foundUser.username || 'U')}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className={isDark ? 'text-gray-100' : 'text-gray-900'}>{foundUser.full_name}</span>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>@{foundUser.username}{foundUser.email ? ` · ${foundUser.email}` : ''}</span>
                        </div>
                      </div>
                      {newChatMode === 'group' && (
                        <input type="checkbox" onChange={() => {}} checked={isSelected} readOnly className="h-4 w-4" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {newChatMode === 'group' && (
              <div className="mt-4 flex justify-end">
                <Button onClick={handleCreateGroup} disabled={!groupName.trim() || selectedMembers.length < 1}>
                  Create Group
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Rename/Manage members modals moved to ChatWindow overlays */}

      {/* Confirm dialog moved to ChatWindow */}
      {showProfile && (
        <ProfilePanel isDark={isDark} onClose={() => setShowProfile(false)} />
      )}

      {/* Subtle overlay to close open per-room context menu */}
      {openMenuRoomId && (
        <div
          className={`absolute inset-0 z-10 ${isDark ? 'bg-black/20' : 'bg-black/10'}`}
          onMouseDown={() => setOpenMenuRoomId(null)}
        />
      )}
    </div>
  );
};

export default ChatSidebar;
