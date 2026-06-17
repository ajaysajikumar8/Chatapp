import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Search, Globe, LogOut, CheckCheck, 
  Image as ImageIcon, Video as VideoIcon, FileText as FileIcon, 
  Music as MusicIcon, Paperclip as AttachmentIcon, 
  Settings, ArrowLeft, Camera, Loader2, Shield, VolumeX
} from 'lucide-react';
import type { Conversation, User, Message, UserSettings } from '../../types/chat';
import { useChatStore } from '../../store/useChatStore';
import { useAuthStore } from '../../store/useAuthStore';
import api from '../../services/api';
import { formatRelativeDate } from '../../utils/dateUtils';

const getMessagePreview = (message?: Message, otherUserUsername?: string): React.ReactNode => {
  if (!message) {
    return <span>{otherUserUsername ? `@${otherUserUsername}` : 'No messages yet'}</span>;
  }

  if (message.content) {
    return <span>{message.content}</span>;
  }

  if (message.attachmentUrl) {
    const type = message.attachmentType?.toLowerCase() || '';
    
    let Icon = AttachmentIcon;
    let label = 'Attachment';

    if (type.startsWith('image/')) {
      Icon = ImageIcon;
      label = 'Photo';
    } else if (type.startsWith('video/')) {
      Icon = VideoIcon;
      label = 'Video';
    } else if (type.startsWith('audio/')) {
      Icon = MusicIcon;
      label = 'Audio';
    } else if (type === 'application/pdf' || message.attachmentName?.toLowerCase().endsWith('.pdf')) {
      Icon = FileIcon;
      label = 'PDF';
    } else if (type.startsWith('text/') || message.attachmentName?.toLowerCase().endsWith('.txt')) {
      Icon = FileIcon;
      label = 'Document';
    }

    return (
      <span className="inline-flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" />
        <span>{label}</span>
      </span>
    );
  }

  return <span>No messages yet</span>;
};

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const currentUser = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [isFetchingBlocked, setIsFetchingBlocked] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<'success' | 'error' | ''>( '');
  const [profileErrorMessage, setProfileErrorMessage] = useState('');
  
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLogoutModalOpen) {
      const focusTimeout = setTimeout(() => {
        cancelRef.current?.focus();
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsLogoutModalOpen(false);
          return;
        }
        if (e.key === 'Tab') {
          const focusableElements = [cancelRef.current, confirmRef.current];
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) {
              last?.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === last) {
              first?.focus();
              e.preventDefault();
            }
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(focusTimeout);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isLogoutModalOpen]);

  const { userPresence, startConversation, updateConversationBlockStatus } = useChatStore();
  const logout = useAuthStore((state) => state.logout);
  const currentUserId = useAuthStore((state) => state.user?.id);

  // Sync profile details when currentUser changes in store
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setUsername(currentUser.username || '');
      setBio(currentUser.bio || '');
    }
  }, [currentUser]);

  // Load settings on mount
  useEffect(() => {
    if (!currentUserId) return;

    const loadSettings = async () => {
      try {
        const profileRes = await api.get('/users/me');
        if (profileRes.data?.data) {
          const { profile, settings: userSettings } = profileRes.data.data;
          setSettings(userSettings);
          if (profile) {
            updateUser({
              displayName: profile.displayName,
              username: profile.username,
              bio: profile.bio || '',
              profilePhotoUrl: profile.profilePhotoUrl,
              avatarUrl: profile.avatarUrl
            });
          }
        }
      } catch (err) {
        console.error("Failed to load profile settings", err);
      }
    };

    loadSettings();
  }, [currentUserId, updateUser]);

  // Load blocked users when settings panel opens
  useEffect(() => {
    if (isSettingsOpen) {
      const fetchBlocked = async () => {
        setIsFetchingBlocked(true);
        try {
          const res = await api.get('/users/me/blocked');
          if (res.data?.data) {
            setBlockedUsers(res.data.data);
          }
        } catch (err) {
          console.error("Failed to fetch blocked users", err);
        } finally {
          setIsFetchingBlocked(false);
        }
      };
      fetchBlocked();
    }
  }, [isSettingsOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !username.trim()) return;
    setIsSavingProfile(true);
    setProfileStatus('');
    try {
      const res = await api.put('/users/me/profile', {
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
      });
      if (res.data?.data) {
        updateUser({
          displayName: res.data.data.displayName,
          username: res.data.data.username,
          bio: res.data.data.bio
        });
        setProfileStatus('success');
        setTimeout(() => setProfileStatus(''), 2000);
      }
    } catch (err: any) {
      console.error("Failed to update profile", err);
      setProfileStatus('error');
      setProfileErrorMessage(err.response?.data?.message || "Failed to update profile");
      setTimeout(() => setProfileStatus(''), 4000);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleToggleSetting = async (key: keyof UserSettings, value: any) => {
    if (!settings) return;
    const updatedSettings = { ...settings, [key]: value };
    setSettings(updatedSettings);
    try {
      await api.put('/users/me/settings', { [key]: value });
    } catch (err) {
      console.error("Failed to update setting", err);
      setSettings(settings);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileStatus('error');
      setProfileErrorMessage("Profile photo must be under 5MB");
      setTimeout(() => setProfileStatus(''), 4000);
      return;
    }

    const extension = file.name.split('.').pop() || '';
    const mimeType = file.type;

    setAvatarUploading(true);
    setProfileStatus('');
    try {
      const presignedRes = await api.post('/users/me/avatar-upload', { extension, mimeType });
      const { uploadUrl, fileKey } = presignedRes.data.data;

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': mimeType
        }
      });

      const completeRes = await api.put('/users/me/avatar-complete', { fileKey });
      const { avatarUrl } = completeRes.data.data;

      updateUser({
        profilePhotoUrl: fileKey,
        avatarUrl
      });
      
      setProfileStatus('success');
      setTimeout(() => setProfileStatus(''), 2000);
    } catch (err: any) {
      console.error("Avatar upload failed", err);
      setProfileStatus('error');
      setProfileErrorMessage("Failed to upload avatar");
      setTimeout(() => setProfileStatus(''), 4000);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleUnblockUser = async (userIdToUnblock: string) => {
    try {
      await api.delete(`/users/me/block/${userIdToUnblock}`);
      setBlockedUsers(prev => prev.filter(u => u.id !== userIdToUnblock));
      const conv = conversations.find(c => 
        c.participants.some(p => p.userId === userIdToUnblock)
      );
      if (conv) {
        updateConversationBlockStatus(conv.id, false);
      }
    } catch (err) {
      console.error("Failed to unblock user", err);
    }
  };

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

  const handleStartGlobalChat = async (user: User) => {
    await startConversation(user);
    setSearchQuery('');
  };

  return (
    <div
      className={`${
        isVisible ? 'flex' : 'hidden'
      } md:flex flex-col w-full md:w-80 lg:w-96 border-r border-border-subtle bg-bg-base/50 h-full relative overflow-hidden`}
    >
      <AnimatePresence initial={false}>
        {!isSettingsOpen ? (
          <motion.div
            key="chats-list"
            initial={{ x: 0 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="flex flex-col h-full w-full absolute inset-0"
          >
            {/* Header */}
            <div className="p-4 border-b border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="relative shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary-light flex items-center justify-center font-semibold text-sm border border-primary/30 hover:scale-105 transition-transform overflow-hidden"
                  title="View Profile & Settings"
                >
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="Me" className="w-full h-full object-cover" />
                  ) : currentUser?.profilePhotoUrl ? (
                    <img src={currentUser.profilePhotoUrl} alt="Me" className="w-full h-full object-cover" />
                  ) : (
                    currentUser?.displayName?.charAt(0).toUpperCase() || "U"
                  )}
                </button>
                <h2 className="text-xl font-semibold text-text-base">
                  Messages
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2 text-text-muted hover:text-white hover:bg-bg-surface-hover/50 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="p-2 text-text-muted hover:text-danger-light hover:bg-bg-surface-hover/50 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4.5 h-4.5" />
                </button>
              </div>
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
                  {[...filteredConversations]
                    .sort((a, b) => {
                      const aTime = a.messages?.[0]?.createdAt ? new Date(a.messages[0].createdAt).getTime() : new Date(a.createdAt).getTime();
                      const bTime = b.messages?.[0]?.createdAt ? new Date(b.messages[0].createdAt).getTime() : new Date(b.createdAt).getTime();
                      return bTime - aTime;
                    })
                    .map((conv) => {
                    const isSelected = selectedConversationId === conv.id;
                    const otherParticipant = conv.participants.find(p => p.userId !== currentUserId) || conv.participants[0];
                    const otherUser = otherParticipant.user;
                    const status = userPresence[otherUser.id]?.status || otherUser.status;
                    const lastMessage = conv.messages?.[0];
                    const myParticipant = conv.participants.find(p => p.userId === currentUserId);
                    const isMuted = !!(myParticipant?.mutedUntil && new Date(myParticipant.mutedUntil) > new Date());

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
                          {otherUser.avatarUrl ? (
                            <img src={otherUser.avatarUrl} alt={otherUser.displayName} className="w-12 h-12 rounded-full object-cover border border-primary/10" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary-light flex items-center justify-center font-semibold text-lg border border-primary/30">
                              {otherUser.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {status === 'ONLINE' && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-bg-surface rounded-full"></div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <h3 className="font-medium text-text-base truncate pr-2">
                              {otherUser.displayName}
                            </h3>
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              {isMuted && (
                                <VolumeX className="w-3.5 h-3.5 text-text-subtle opacity-70 shrink-0" />
                              )}
                              <span className="text-xs text-text-subtle">
                                {formatRelativeDate(lastMessage?.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-1 min-w-0">
                              {lastMessage?.senderId === currentUserId && (
                                <CheckCheck className={`w-[14px] h-[14px] shrink-0 ${
                                  otherParticipant.lastReadAt && new Date(lastMessage.createdAt) <= new Date(otherParticipant.lastReadAt)
                                    ? 'text-sky-400 drop-shadow-sm'
                                    : 'text-text-subtle'
                                  }`} />
                              )}
                              <p className="text-sm text-text-muted truncate">
                                {getMessagePreview(lastMessage, otherUser.username)}
                              </p>
                            </div>
                            {(conv.unreadCount ?? 0) > 0 && (
                              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isMuted 
                                  ? 'bg-slate-800 text-slate-400 border border-slate-700/50' 
                                  : 'bg-primary text-white'
                              }`}>
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
                       <Loader2 className="w-4 h-4 text-text-subtle animate-spin" />
                       Searching...
                    </div>
                  ) : globalResults.length > 0 ? (
                    globalResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleStartGlobalChat(user)}
                        className="w-full text-left p-4 flex items-center gap-3 hover:bg-bg-surface-hover/50 transition-colors border-b border-border-subtle/50 group"
                      >
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.displayName} className="w-10 h-10 rounded-full object-cover border border-border-subtle" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-bg-surface-hover text-text-base flex items-center justify-center font-semibold text-base border border-border-subtle">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-text-base truncate pr-2">
                            {user.displayName}
                          </h3>
                          <p className="text-sm text-primary-light truncate">
                            @{user.username}
                          </p>
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
          </motion.div>
        ) : (
          <motion.div
            key="settings-panel"
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            exit={{ x: 300 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="absolute inset-0 bg-bg-surface flex flex-col h-full w-full z-10"
          >
            {/* Settings Header */}
            <div className="p-4 border-b border-border-subtle flex items-center gap-3 bg-bg-base/30">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 text-text-muted hover:text-white hover:bg-bg-surface-hover/50 rounded-lg transition-colors"
                title="Back to chats"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-text-base">Profile & Settings</h2>
            </div>

            {/* Scrollable Settings Contents */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              
              {/* Profile Photo Upload Section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30 bg-primary/10 flex items-center justify-center font-bold text-3xl text-primary-light">
                    {avatarUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary-light" />
                    ) : currentUser?.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : currentUser?.profilePhotoUrl ? (
                      <img src={currentUser.profilePhotoUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      currentUser?.displayName?.charAt(0).toUpperCase() || "U"
                    )}
                  </div>
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white mb-1" />
                    <span className="text-[10px] text-white font-medium">CHANGE</span>
                  </div>
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleAvatarChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                
                <p className="text-xs text-text-muted">Click image to upload photo (max 5MB)</p>
              </div>

              {/* Edit Details Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-bg-base border border-border-subtle rounded-lg py-2 px-3 text-sm text-text-base focus:outline-none focus:border-primary-hover focus:ring-1 focus:ring-primary-hover transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                    Username / Handle
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-subtle font-medium">@</span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-bg-base border border-border-subtle rounded-lg py-2 pl-7 pr-3 text-sm text-text-base focus:outline-none focus:border-primary-hover focus:ring-1 focus:ring-primary-hover transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex justify-between">
                    <span>Bio</span>
                    <span className="text-[10px] text-text-subtle">{bio.length}/160</span>
                  </label>
                  <textarea
                    maxLength={160}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Tell others about yourself..."
                    className="w-full bg-bg-base border border-border-subtle rounded-lg py-2 px-3 text-sm text-text-base focus:outline-none focus:border-primary-hover focus:ring-1 focus:ring-primary-hover transition-all resize-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  {profileStatus === 'success' && (
                    <span className="text-xs text-success font-medium">Changes saved!</span>
                  )}
                  {profileStatus === 'error' && (
                    <span className="text-xs text-danger font-medium truncate max-w-[180px]">{profileErrorMessage}</span>
                  )}
                  <span></span>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-primary/50 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-primary/20 flex items-center gap-1.5"
                  >
                    {isSavingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Profile
                  </button>
                </div>
              </form>

              {/* Privacy Toggles */}
              <div className="border-t border-border-subtle/50 pt-4 space-y-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Privacy Settings</h3>
                
                {settings ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-base">Discoverable</p>
                        <p className="text-xs text-text-muted">Allow others to find you via Username search</p>
                      </div>
                      <button
                        onClick={() => handleToggleSetting('isDiscoverable', !settings.isDiscoverable)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                          settings.isDiscoverable ? 'bg-success' : 'bg-bg-surface-hover border border-border-subtle'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                          settings.isDiscoverable ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-base">Read Receipts</p>
                        <p className="text-xs text-text-muted">Send read notifications when viewing messages</p>
                      </div>
                      <button
                        onClick={() => handleToggleSetting('readReceiptsEnabled', !settings.readReceiptsEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                          settings.readReceiptsEnabled ? 'bg-success' : 'bg-bg-surface-hover border border-border-subtle'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                          settings.readReceiptsEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-base">Sounds</p>
                        <p className="text-xs text-text-muted">Play sound effects for incoming messages</p>
                      </div>
                      <button
                        onClick={() => handleToggleSetting('notificationSoundEnabled', !settings.notificationSoundEnabled)}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors focus:outline-none ${
                          settings.notificationSoundEnabled ? 'bg-success' : 'bg-bg-surface-hover border border-border-subtle'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                          settings.notificationSoundEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-text-subtle" />
                  </div>
                )}
              </div>

              {/* Blocked Users Section */}
              <div className="border-t border-border-subtle/50 pt-4">
                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-danger-light" /> Blocked Users
                </h3>
                
                {isFetchingBlocked ? (
                  <Loader2 className="w-4 h-4 animate-spin text-text-subtle mx-auto" />
                ) : blockedUsers.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {blockedUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-bg-base border border-border-subtle/40">
                        <div className="flex items-center gap-2 min-w-0">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary-light flex items-center justify-center font-bold text-xs">
                              {user.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-text-base truncate">{user.displayName}</p>
                            <p className="text-[10px] text-text-muted truncate">@{user.username}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnblockUser(user.id)}
                          className="px-2.5 py-1 text-[10px] font-bold text-danger border border-danger/30 hover:bg-danger/10 rounded-md transition-colors"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">No blocked users</p>
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  ref={cancelRef}
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-text-base hover:text-white hover:bg-bg-surface-hover transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button 
                  ref={confirmRef}
                  onClick={() => {
                    setIsLogoutModalOpen(false);
                    logout();
                  }}
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
