  import React, { useState, useEffect, useMemo } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import CreatorBadge from '../components/common/CreatorBadge';

import { Button } from '../components/ui/button';
import { Menu, MessageSquare } from 'lucide-react';

const Chat = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Tracks if we opened the sidebar specifically to show the New Chat modal from the welcome screen
  const [openedForNewChatFromWelcome, setOpenedForNewChatFromWelcome] = useState(false);
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
  // Mobile-only UI state (trimmed to only what is used)
  const [showMobileSearch] = useState(false);
  const [mobileSearchTerm] = useState('');
  // Signal to ChatWindow to clear messages (static in this page for now)
  const mobileClearTick = 0;

  // Close the sidebar automatically after the New Chat modal is closed, but only
  // when we originally opened it from the welcome screen on small screens.
  useEffect(() => {
    const handleNewChatClosed = () => {
      if (openedForNewChatFromWelcome) {
        try {
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setSidebarOpen(false);
          }
        } finally {
          setOpenedForNewChatFromWelcome(false);
        }
      }
    };
    window.addEventListener('new-chat-closed', handleNewChatClosed);
    return () => window.removeEventListener('new-chat-closed', handleNewChatClosed);
  }, [openedForNewChatFromWelcome]);

  // Allow child components (e.g., ChatWindow mobile header) to request opening the sidebar
  useEffect(() => {
    const openSidebar = () => setSidebarOpen(true);
    window.addEventListener('open-sidebar', openSidebar);
    return () => window.removeEventListener('open-sidebar', openSidebar);
  }, []);

  const peerUser = useMemo(() => {
    if (!activeRoom || activeRoom.room_type !== 'direct') return null;
    return activeRoom.members?.find(m => m.user.id !== user?.id)?.user || null;
  }, [activeRoom, user]);

  // Compute current member + admin flag for active room
  // Removed unused currentMember/isAdmin to satisfy eslint

  // Removed unused presence listener to satisfy eslint

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
        {/* Floating hamburger only when no active room (welcome). ChatWindow header provides its own on mobile. */}
        {!activeRoom && (
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className={`${isDark ? 'bg-black/30 hover:bg-violet-600/80 text-white ring-1 ring-white/10' : 'bg-white/70 hover:bg-violet-600 text-gray-900 ring-1 ring-gray-200'} fixed top-4 left-4 z-40 backdrop-blur rounded-md hover:text-white`}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open chat list"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        )}

        {/* Chat window */}
        {activeRoom ? (
          <ChatWindow
            isDark={isDark}
            setIsDark={setIsDark}
            mobileSearchTerm={showMobileSearch ? mobileSearchTerm : ''}
            mobileClearTick={mobileClearTick}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center relative px-4">
            {/* GitHub overlay (bottom-right), toggles pill on click */}
            <CreatorBadge isDark={isDark} username="rahulpatel902" avatarPath="/rp.jpg" />

            {/* Subtle gradient blob background */}
            <div
              className={`absolute inset-0 -z-10 flex items-center justify-center pointer-events-none`}
              aria-hidden
            >
              <div
                className={`${isDark ? 'from-violet-600/15 via-fuchsia-500/8 to-transparent' : 'from-violet-400/15 via-fuchsia-300/8 to-transparent'}
                w-[380px] h-[380px] rounded-full bg-gradient-to-b blur-2xl opacity-60`}
              />
            </div>

            {/* Welcome content */}
            <div className="w-full max-w-sm text-center">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-[#1b2028] border border-white/10' : 'bg-violet-50 border border-violet-200 shadow-sm'}`}>
                <MessageSquare className={`h-8 w-8 ${isDark ? 'text-violet-500' : 'text-violet-600'}`} />
              </div>
              <h2 className={`text-2xl font-semibold mb-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                Welcome to FlowChat, {user?.first_name}!
              </h2>
              <p className={`${isDark ? 'text-gray-300' : 'text-gray-600'} mb-4`}>
                Select a chat from the sidebar to start messaging
              </p>

              {/* Quick actions (now visible on all viewports). Do NOT auto-open a room. */}
              <div className="grid grid-cols-1 gap-2">
                <Button
                  className={`${isDark ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'} w-full max-w-[240px] mx-auto justify-center lg:hidden`}
                  onClick={() => setSidebarOpen(true)}
                >
                  Let’s chat
                </Button>
                <Button
                  variant="outline"
                  className={`${isDark
                    ? 'bg-transparent text-gray-200 border-white/10 hover:bg-violet-500/10 hover:border-violet-500/40 hover:text-white focus-visible:ring-2 focus-visible:ring-violet-600/50'
                    : 'border-gray-300 text-gray-800 hover:bg-gray-50'} w-full max-w-[240px] mx-auto justify-center transition-colors lg:hidden`}
                  onClick={() => {
                    // Ensure sidebar is visible on mobile so the modal is in view
                    setSidebarOpen(true);
                    // Remember that we opened it from the welcome screen
                    setOpenedForNewChatFromWelcome(true);
                    // Ask the sidebar to open the New Chat modal
                    try { window.dispatchEvent(new Event('open-new-chat')); } catch {}
                  }}
                >
                  Start a new chat
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
