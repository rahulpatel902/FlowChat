import React, { useState, useEffect, useMemo } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import { Button } from '../components/ui/button';
import { Menu, Search, MoreVertical, MessageSquare, Info, Pencil, Users, Eraser, LogOut, Trash } from 'lucide-react';
import { Input } from '../components/ui/input';
import { getInitials } from '../lib/utils';
import { subscribeToOnlineStatus } from '../firebase/firestore';

const Chat = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // App-level theme state with persistence across refresh
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      // Default for new users without a saved preference: light mode
      return false;
    } catch {
      return false;
    }
  });
  const { activeRoom, loadRooms } = useChat();
  const { user } = useAuth();
  const [peerOnline, setPeerOnline] = useState(null); // true | false | null
  // Mobile-only UI state
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [mobileSearchTerm, setMobileSearchTerm] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Signal to ChatWindow to clear messages (increment to trigger)
  const [mobileClearTick, setMobileClearTick] = useState(0);

  const peerUser = useMemo(() => {
    if (!activeRoom || activeRoom.room_type !== 'direct') return null;
    return activeRoom.members?.find(m => m.user.id !== user?.id)?.user || null;
  }, [activeRoom, user]);

  // Compute current member + admin flag for active room
  const currentMember = useMemo(() => {
    if (!activeRoom || activeRoom.room_type !== 'group') return null;
    return (activeRoom.members || []).find(m => m.user.id === user?.id) || null;
  }, [activeRoom, user]);
  const isAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  useEffect(() => {
    let unsub = null;
    if (peerUser?.id) {
      // subscribeToOnlineStatus expects an array of userIds and returns a map of id -> { isOnline, lastSeen }
      unsub = subscribeToOnlineStatus([peerUser.id], (statuses) => {
        const s = statuses?.[peerUser.id];
        setPeerOnline(s?.isOnline === true);
      });
    } else {
      setPeerOnline(null);
    }
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [peerUser]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  // Persist theme preference
  useEffect(() => {
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {}
    // Broadcast theme change so listeners can update live
    try {
      window.dispatchEvent(new CustomEvent('theme-change', { detail: { isDark } }));
    } catch {}
  }, [isDark]);

  return (
    <div className={`flex h-screen ${isDark ? 'bg-[#0d0f12] text-gray-100' : 'bg-white text-gray-900'}`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[360px] transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:z-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isDark ? 'bg-[#0f1115] border-r border-white/10' : 'bg-white border-r border-gray-200'}`}
      >
        <ChatSidebar onClose={() => setSidebarOpen(false)} isDark={isDark} setIsDark={setIsDark} />
      </div>

      {/* Main content */}
      <div className={`z-0 flex-1 min-h-0 flex flex-col overflow-y-hidden overflow-x-visible ${isDark ? 'bg-[#0f1115] text-gray-100' : 'bg-[#f7f8fa] text-gray-900'}`}>
        {/* Mobile header */}
        <div className={`lg:hidden p-4 border-b ${isDark ? 'bg-[#13151a] border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="group hover:bg-violet-600 hover:text-white"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6 group-hover:text-white" />
            </Button>
            <div className="flex-1 min-w-0 px-2">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                {activeRoom ? (
                  <div
                    className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center bg-violet-600 text-white text-xs font-medium flex-shrink-0 cursor-pointer"
                    onClick={() => {
                      try {
                        if (activeRoom.room_type === 'direct') {
                          window.dispatchEvent(new Event('open-contact-info'));
                        } else if (activeRoom.room_type === 'group') {
                          window.dispatchEvent(new Event('open-group-info'));
                        }
                      } catch {}
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        try {
                          if (activeRoom.room_type === 'direct') {
                            window.dispatchEvent(new Event('open-contact-info'));
                          } else if (activeRoom.room_type === 'group') {
                            window.dispatchEvent(new Event('open-group-info'));
                          }
                        } catch {}
                      }
                    }}
                    title={activeRoom.room_type === 'direct' ? 'View contact info' : 'View group info'}
                  >
                    {activeRoom.room_type === 'direct' ? (
                      peerUser?.profile_picture ? (
                        <img src={peerUser.profile_picture} alt={peerUser?.full_name || 'User'} className="h-full w-full object-cover" />
                      ) : (
                        <span>{getInitials(peerUser?.full_name || 'U')}</span>
                      )
                    ) : (
                      activeRoom?.avatar_url ? (
                        <img src={activeRoom.avatar_url} alt={activeRoom?.name || 'Group'} className="h-full w-full object-cover" />
                      ) : (
                        <span>{getInitials(activeRoom.name || 'G')}</span>
                      )
                    )}
                  </div>
                ) : null}
                {/* Name + status */}
                <div className="min-w-0">
                  <div className={`text-base font-semibold truncate ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    {activeRoom
                      ? (activeRoom.room_type === 'direct'
                          ? (peerUser?.full_name || 'Direct Message')
                          : (activeRoom.name || 'Group'))
                      : 'FlowChat'}
                  </div>
                  {activeRoom && (
                    activeRoom.room_type === 'direct' ? (
                      <div className={`text-xs truncate flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                        <span className={`inline-block h-2 w-2 rounded-full ${peerOnline === true ? 'bg-violet-600' : 'bg-gray-400'}`} />
                        {peerOnline === true ? 'Online' : 'Offline'}
                      </div>
                    ) : (
                      <div className={`text-xs truncate ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                        {`${activeRoom.member_count || activeRoom.members?.length || 0} members`}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeRoom && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={`group ${isDark ? 'hover:bg-violet-600 hover:text-white' : ''}`}
                  onClick={() => { setShowMobileSearch(s => !s); setMobileMenuOpen(false); }}
                >
                  <Search className={`h-5 w-5 ${isDark ? 'text-gray-200 group-hover:text-white' : 'group-hover:text-black'}`} />
                </Button>
              )}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`group ${isDark ? 'hover:bg-violet-600 hover:text-white' : ''}`}
                  onClick={() => { setMobileMenuOpen(o => !o); setShowMobileSearch(false); }}
                >
                  <MoreVertical className={`h-5 w-5 ${isDark ? 'text-gray-200 group-hover:text-white' : 'group-hover:text-black'}`} />
                </Button>
                {mobileMenuOpen && (
                  <div className={`absolute right-0 mt-2 w-56 rounded-md shadow-md py-1 z-20 ${isDark ? 'bg-[#13151a] border border-white/10 text-gray-100' : 'bg-white border border-gray-200'}`}>
                    {/* Direct chat options */}
                    {activeRoom?.room_type === 'direct' && (
                      <button
                        className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          try { window.dispatchEvent(new Event('open-contact-info')); } catch {}
                        }}
                      >
                        <Info className="h-4 w-4 mr-2" /> Contact info
                      </button>
                    )}

                    {/* Group chat options */}
                    {activeRoom?.room_type === 'group' && (
                      <>
                        <button
                          className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                          onClick={() => { setMobileMenuOpen(false); try { window.dispatchEvent(new Event('open-group-info')); } catch {} }}
                        >
                          <Info className="h-4 w-4 mr-2" /> Group info
                        </button>
                        <button
                          className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                          onClick={() => { setMobileMenuOpen(false); try { window.dispatchEvent(new Event('open-rename-group')); } catch {} }}
                        >
                          <Pencil className="h-4 w-4 mr-2" /> Rename group
                        </button>
                        <button
                          className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                          onClick={() => { setMobileMenuOpen(false); try { window.dispatchEvent(new Event('open-group-members')); } catch {} }}
                        >
                          <Users className="h-4 w-4 mr-2" /> Manage members
                        </button>
                      </>
                    )}

                    {/* Common options */}
                    <button
                      className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (!window.confirm('Clear all messages in this chat? This cannot be undone.')) return;
                        setMobileClearTick((t) => t + 1);
                      }}
                    >
                      <Eraser className="h-4 w-4 mr-2" /> Clear messages
                    </button>
                    <div className={`${isDark ? 'border-t border-white/10 my-1' : 'border-t border-gray-200 my-1'}`} />
                    <button
                      className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                      onClick={() => { setMobileMenuOpen(false); try { window.dispatchEvent(new Event('open-leave-chat')); } catch {} }}
                    >
                      <LogOut className="h-4 w-4 mr-2" /> Leave chat
                    </button>
                    {(activeRoom?.room_type === 'group' ? isAdmin : (activeRoom?.created_by?.id === user?.id)) && (
                      <button
                        className={`w-full text-left px-3 py-2 text-sm flex items-center ${isDark ? 'hover:bg-white/5 text-red-400' : 'hover:bg-gray-50 text-red-600'}`}
                        onClick={() => { setMobileMenuOpen(false); try { window.dispatchEvent(new Event('open-delete-chat')); } catch {} }}
                      >
                        <Trash className="h-4 w-4 mr-2" /> Delete chat
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {showMobileSearch && (
            <div className="mt-3">
              <Input
                placeholder="Search messages…"
                value={mobileSearchTerm}
                onChange={(e) => setMobileSearchTerm(e.target.value)}
                className={`h-10 px-4 text-sm rounded-full text-center focus-visible:ring-0 focus-visible:ring-offset-0 ${isDark ? 'bg-[#151821] text-gray-100 placeholder:text-gray-400 border border-white/10' : 'bg-white border border-gray-200'}`}
              />
            </div>
          )}
        </div>

        {/* Chat window */}
        {activeRoom ? (
          <ChatWindow
            isDark={isDark}
            setIsDark={setIsDark}
            mobileSearchTerm={showMobileSearch ? mobileSearchTerm : ''}
            mobileClearTick={mobileClearTick}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-[#1b2028] border border-white/10' : 'bg-violet-50 border border-violet-200 shadow-sm'}`}>
                <MessageSquare className={`h-8 w-8 ${isDark ? 'text-violet-500' : 'text-violet-600'}`} />
              </div>
              <h2 className={`text-2xl font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                Welcome to FlowChat, {user?.first_name}!
              </h2>
              <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Select a chat from the sidebar to start messaging
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
