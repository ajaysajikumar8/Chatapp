import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, MessageSquare, Globe, UserPlus, LogOut } from 'lucide-react';
import type { Conversation, User } from '../../types/chat';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';

interface ChatSidebarProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  isVisible: boolean;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  isVisible,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<User[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const { userPresence, startConversation } = useChatStore();
  const logout = useAuthStore((state) => state.logout);

  const filteredConversations = conversations.filter((c) =>
    c.participants.some((p) =>
      p.user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.user.username?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  useEffect(() => {
    const fetchGlobalUsers = async () => {
      if (!searchQuery.trim()) {
        setGlobalResults([]);
        return;
      }
      
      setIsSearchingGlobal(true);
      try {
        const response = await api.get(`/users?q=${encodeURIComponent(searchQuery)}`);
        // Filter out users we already have a conversation with
        const existingParticipantIds = new Set(
          conversations.flatMap(c => c.participants.map(p => p.userId))
        );
        
        const newUsers = response.data.data.filter((u: User) => !existingParticipantIds.has(u.id));
        setGlobalResults(newUsers);
      } catch (error) {
        console.error("Failed to search global users", error);
        setGlobalResults([]);
      } finally {
        setIsSearchingGlobal(false);
      }
    };

    const debounceTimer = setTimeout(fetchGlobalUsers, 400);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, conversations]);

  const handleStartGlobalChat = async (userId: string) => {
    await startConversation(userId);
    setSearchQuery('');
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`${
        isVisible ? 'flex' : 'hidden'
      } md:flex flex-col w-full md:w-80 lg:w-96 border-r border-border-subtle bg-bg-base/50 h-full`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text-base flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-light" />
          Messages
        </h2>
        <button
          onClick={() => setIsLogoutModalOpen(true)}
          className="p-2 text-text-muted hover:text-danger-light hover:bg-bg-surface-hover/50 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            type="text"
            placeholder="Search or start new chat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-surface border border-border-subtle rounded-lg py-2 pl-9 pr-4 text-sm text-text-base placeholder:text-text-subtle focus:outline-none focus:border-primary-hover focus:ring-1 focus:ring-primary-hover transition-all"
          />
        </div>
      </div>

      {/* Conversation & Search List */}
      <div className="flex-1 overflow-y-auto">
        {/* Local Conversations */}
        {filteredConversations.length > 0 && (
          <div className="mb-4">
            {searchQuery && <div className="px-4 py-2 text-xs font-semibold text-text-subtle uppercase tracking-wider">Your Chats</div>}
            {filteredConversations.map((conv) => {
              const isSelected = selectedConversationId === conv.id;
              const participant = conv.participants.find(p => p.userId !== useAuthStore.getState().user?.id)?.user || conv.participants[0].user;
              const status = userPresence[participant.id]?.status || participant.status;
              const lastMessage = conv.messages?.[0];

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`w-full text-left p-4 flex items-start gap-3 hover:bg-bg-surface-hover/50 transition-colors border-b border-border-subtle/50 ${
                    isSelected ? 'bg-bg-surface-hover/80' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary/20 text-primary-light flex items-center justify-center font-semibold text-lg border border-primary/30">
                      {participant.displayName.charAt(0).toUpperCase()}
                    </div>
                    {status === 'ONLINE' && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-bg-surface rounded-full"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className="font-medium text-text-base truncate pr-2">
                        {participant.displayName}
                      </h3>
                      <span className="text-xs text-text-subtle whitespace-nowrap">
                        {formatTime(lastMessage?.createdAt)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-sm text-text-muted truncate">
                        {lastMessage?.content || (participant.username ? `@${participant.username}` : 'No messages yet')}
                      </p>
                      {(conv.unreadCount ?? 0) > 0 && (
                        <span className="shrink-0 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Global Search Results */}
        {searchQuery && (
          <div>
            <div className="px-4 py-2 text-xs font-semibold text-text-subtle uppercase tracking-wider flex items-center gap-1">
              <Globe className="w-3 h-3" /> Global Search
            </div>
            
            {isSearchingGlobal ? (
              <div className="p-4 text-center text-text-subtle text-sm flex items-center justify-center gap-2">
                 <div className="w-4 h-4 border-2 border-text-subtle border-t-transparent rounded-full animate-spin"></div>
                 Searching...
              </div>
            ) : globalResults.length > 0 ? (
              globalResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleStartGlobalChat(user.id)}
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-bg-surface-hover/50 transition-colors border-b border-border-subtle/50 group"
                >
                  <div className="w-10 h-10 rounded-full bg-bg-surface-hover text-text-base flex items-center justify-center font-semibold text-base border border-border-subtle">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-base truncate pr-2">
                      {user.displayName}
                    </h3>
                    <p className="text-sm text-primary-light truncate">
                      @{user.username}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-primary/20 text-primary-light p-2 rounded-full">
                      <UserPlus className="w-4 h-4" />
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-text-subtle text-sm">
                No new users found matching "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!searchQuery && filteredConversations.length === 0 && (
           <div className="p-8 text-center flex flex-col items-center">
             <div className="w-16 h-16 bg-bg-surface rounded-full flex items-center justify-center mb-4 border border-border-subtle">
               <Search className="w-8 h-8 text-text-subtle" />
             </div>
             <p className="text-text-muted text-sm">
               Search for a username to start a new conversation.
             </p>
           </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-bg-surface border border-border-subtle rounded-2xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-danger to-orange-500"></div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-danger/10 text-danger rounded-xl">
                  <LogOut className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-text-base">Sign Out</h3>
              </div>
              <p className="text-text-muted mb-6 text-sm">
                Are you sure you want to sign out? You will need to enter your credentials to log back in.
              </p>
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-text-base hover:text-white hover:bg-bg-surface-hover transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={logout}
                  className="px-4 py-2 rounded-xl bg-danger text-white shadow-lg shadow-danger/20 hover:bg-danger-hover transition-colors font-medium text-sm"
                >
                  Yes, Sign out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
