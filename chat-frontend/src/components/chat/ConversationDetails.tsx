import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, Volume2, VolumeX, ShieldAlert, File as FileIcon, 
  Download, Image as ImageIcon, Play, ChevronDown,
  AlertCircle
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../../services/api';
import { useChatStore } from '../../store/useChatStore';
import { MediaViewerModal } from './MediaViewerModal';
import type { Conversation } from '../../types/chat';

const SharedImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative w-full h-full bg-bg-surface-hover overflow-hidden">
      {!isLoaded && (
        <div className="absolute inset-0 bg-bg-surface-hover/80 animate-pulse flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-text-subtle/30" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-300 ${
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
      />
    </div>
  );
};

interface SharedAttachment {
  messageId: string;
  attachmentUrl: string;
  attachmentType: string;
  attachmentName: string;
  createdAt: string;
  sender: {
    id: string;
    displayName: string;
  } | null;
}

interface ProfileData {
  id: string;
  displayName: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  status: string;
  lastSeen: string | null;
  isBlockedByMe: boolean;
  isBlockedByThem: boolean;
}

interface ConversationDetailsProps {
  conversation: Conversation;
  currentUserId: string;
  onClose: () => void;
}

export const ConversationDetails: React.FC<ConversationDetailsProps> = ({
  conversation,
  currentUserId,
  onClose,
}) => {
  const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId) || conversation.participants[0];
  const targetUserId = otherParticipant?.user.id;

  const { muteConversation, updateConversationBlockStatus, userPresence } = useChatStore();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'media' | 'docs'>('media');
  const [media, setMedia] = useState<SharedAttachment[]>([]);
  const [docs, setDocs] = useState<SharedAttachment[]>([]);
  const [mediaCursor, setMediaCursor] = useState<string | null>(null);
  const [docsCursor, setDocsCursor] = useState<string | null>(null);
  const [hasMoreMedia, setHasMoreMedia] = useState(true);
  const [hasMoreDocs, setHasMoreDocs] = useState(true);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [isMuteMenuOpen, setIsMuteMenuOpen] = useState(false);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);

  // Get muted state from conversation participants
  const myParticipant = conversation.participants.find(p => p.userId === currentUserId);
  const isMuted = !!(myParticipant?.mutedUntil && new Date(myParticipant.mutedUntil) > new Date());

  // Real-time status update from the store
  const livePresence = userPresence[targetUserId];
  const displayStatus = profile 
    ? (profile.isBlockedByMe || profile.isBlockedByThem ? 'OFFLINE' : (livePresence?.status || profile.status))
    : 'OFFLINE';

  const displayLastSeen = profile
    ? (profile.isBlockedByMe || profile.isBlockedByThem ? null : (livePresence?.lastSeen || profile.lastSeen))
    : null;

  // Fetch target user profile
  const fetchProfile = useCallback(async () => {
    if (!targetUserId) return;
    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      const res = await api.get(`/users/${targetUserId}/profile`);
      setProfile(res.data.data);
    } catch (err: any) {
      console.error("Failed to fetch user profile", err);
      setProfileError("Could not load user profile details.");
    } finally {
      setIsLoadingProfile(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Fetch shared attachments
  const fetchAttachments = useCallback(async (tab: 'media' | 'docs', isLoadMore = false) => {
    if (isLoadingAttachments) return;
    if (conversation.id.startsWith('temp_')) {
      setHasMoreMedia(false);
      setHasMoreDocs(false);
      return;
    }
    
    setIsLoadingAttachments(true);
    try {
      const cursor = tab === 'media' ? (isLoadMore ? mediaCursor : null) : (isLoadMore ? docsCursor : null);
      const url = `/conversations/${conversation.id}/attachments?type=${tab === 'media' ? 'media' : 'document'}${cursor ? `&cursor=${cursor}` : ''}&limit=12`;
      
      const res = await api.get(url);
      const { attachments, nextCursor, hasMore } = res.data.data;

      if (tab === 'media') {
        setMedia(prev => {
          const combined = isLoadMore ? [...prev, ...attachments] : attachments;
          const seen = new Set<string>();
          return combined.filter(item => {
            if (seen.has(item.messageId)) return false;
            seen.add(item.messageId);
            return true;
          });
        });
        setMediaCursor(nextCursor);
        setHasMoreMedia(hasMore);
      } else {
        setDocs(prev => {
          const combined = isLoadMore ? [...prev, ...attachments] : attachments;
          const seen = new Set<string>();
          return combined.filter(item => {
            if (seen.has(item.messageId)) return false;
            seen.add(item.messageId);
            return true;
          });
        });
        setDocsCursor(nextCursor);
        setHasMoreDocs(hasMore);
      }
    } catch (err) {
      console.error("Failed to fetch shared attachments", err);
    } finally {
      setIsLoadingAttachments(false);
    }
  }, [conversation.id, mediaCursor, docsCursor, isLoadingAttachments]);

  // Reset all states when conversation ID changes
  useEffect(() => {
    setMedia([]);
    setDocs([]);
    setMediaCursor(null);
    setDocsCursor(null);
    setHasMoreMedia(true);
    setHasMoreDocs(true);
  }, [conversation.id]);

  // Fetch first page on mount, conversation change, or tab change
  useEffect(() => {
    if (conversation.id.startsWith('temp_')) return;
    
    const hasData = activeTab === 'media' ? media.length > 0 : docs.length > 0;
    const hasMore = activeTab === 'media' ? hasMoreMedia : hasMoreDocs;
    
    if (!hasData && hasMore && !isLoadingAttachments) {
      fetchAttachments(activeTab, false);
    }
  }, [conversation.id, activeTab, media.length, docs.length, hasMoreMedia, hasMoreDocs, isLoadingAttachments, fetchAttachments]);

  // Delayed displaying of loading indicator to prevent flashing on fast network responses
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoadingAttachments) {
      timer = setTimeout(() => {
        setShowLoader(true);
      }, 250);
    } else {
      setShowLoader(false);
    }
    return () => clearTimeout(timer);
  }, [isLoadingAttachments]);

  // IntersectionObserver for automated infinite scroll loading
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          const hasMore = activeTab === 'media' ? hasMoreMedia : hasMoreDocs;
          if (hasMore && !isLoadingAttachments && !conversation.id.startsWith('temp_')) {
            fetchAttachments(activeTab, true);
          }
        }
      },
      {
        root: null,
        rootMargin: '100px', // trigger fetch before reaching the bottom
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.unobserve(sentinel);
    };
  }, [activeTab, hasMoreMedia, hasMoreDocs, isLoadingAttachments, fetchAttachments, conversation.id]);

  // Handle Mute Action
  const handleMuteToggle = async (duration: string) => {
    setIsMuteMenuOpen(false);
    await muteConversation(conversation.id, duration);
  };

  // Handle Block Toggle
  const handleBlockToggle = async () => {
    if (!profile || isTogglingBlock) return;
    setIsTogglingBlock(true);
    try {
      if (profile.isBlockedByMe) {
        await api.delete(`/users/me/block/${targetUserId}`);
        setProfile(prev => prev ? { ...prev, isBlockedByMe: false } : null);
        updateConversationBlockStatus(conversation.id, false);
      } else {
        await api.post(`/users/me/block/${targetUserId}`);
        setProfile(prev => prev ? { ...prev, isBlockedByMe: true, bio: null, avatarUrl: null, status: 'OFFLINE', lastSeen: null } : null);
        updateConversationBlockStatus(conversation.id, true);
      }
    } catch (err) {
      console.error("Failed to toggle block status", err);
    } finally {
      setIsTogglingBlock(false);
    }
  };

  // Helper for formatting date
  const formatLastSeen = (isoStr: string | null) => {
    if (!isoStr) return 'Offline';
    const date = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Last seen just now';
    if (diffMins < 60) return `Last seen ${diffMins}m ago`;
    if (diffHrs < 24) return `Last seen ${diffHrs}h ago`;
    return `Last seen on ${date.toLocaleDateString()}`;
  };

  const handleDownloadClick = async (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    try {
      const response = await api.get(`/messages/${msgId}/download-url`);
      const { downloadUrl } = response.data.data;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to fetch download URL", err);
    }
  };

  // Media Modal items mapping
  const mediaViewerItems = media.map(m => ({
    id: m.messageId,
    attachmentUrl: m.attachmentUrl,
    attachmentType: m.attachmentType,
    attachmentName: m.attachmentName,
    createdAt: m.createdAt,
    senderName: m.sender?.displayName || 'User'
  }));
  const activeMediaIndex = media.findIndex(m => m.messageId === activeMediaId);

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0.9 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 md:relative z-30 md:z-auto w-full md:w-[380px] h-full border-l border-border-subtle bg-bg-surface flex flex-col shrink-0 overflow-hidden shadow-2xl md:shadow-none"
    >
      {/* Panel Header */}
      <div className="h-[73px] px-4 border-b border-border-subtle flex items-center justify-between bg-bg-surface/80 backdrop-blur-sm z-10 shrink-0">
        <h3 className="font-semibold text-text-base text-lg">Contact Info</h3>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-bg-surface-hover text-text-muted hover:text-white transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 scrollbar-thin scrollbar-thumb-bg-surface-hover scrollbar-track-transparent">
        {isLoadingProfile ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <span className="text-sm text-text-muted">Loading profile...</span>
          </div>
        ) : profileError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <AlertCircle className="w-10 h-10 text-danger/80 mb-3" />
            <p className="text-sm text-text-base font-medium">{profileError}</p>
            <button 
              onClick={fetchProfile} 
              className="mt-3 px-3 py-1.5 bg-bg-surface-hover text-xs font-semibold text-text-base rounded-lg border border-border-subtle hover:bg-bg-surface hover:text-white transition-all"
            >
              Retry
            </button>
          </div>
        ) : profile ? (
          <>
            {/* User Profile Card */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-border-subtle/50">
              <div className="relative group mb-4">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary/20 group-hover:border-primary-light transition-all duration-300 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-3xl font-bold border-2 border-primary/30 shadow-lg">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                {displayStatus === 'ONLINE' && (
                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-success border-4 border-bg-surface rounded-full"></div>
                )}
              </div>
              <h4 className="text-lg font-bold text-text-base truncate max-w-full px-2">{profile.displayName}</h4>
              <p className="text-sm text-text-muted">@{profile.username}</p>
              
              <p className="text-xs text-text-subtle mt-2 font-medium">
                {displayStatus === 'ONLINE' ? (
                  <span className="text-success font-semibold">Online</span>
                ) : (
                  formatLastSeen(displayLastSeen)
                )}
              </p>
            </div>

            {/* Quick Actions Row */}
            <div className="grid grid-cols-2 gap-3 pb-2">
              <div className="relative">
                <button
                  onClick={() => setIsMuteMenuOpen(!isMuteMenuOpen)}
                  className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 ${
                    isMuted 
                      ? 'bg-primary/10 border-primary/20 text-primary-light hover:bg-primary/20' 
                      : 'bg-bg-surface-hover border-border-subtle text-text-base hover:bg-bg-surface'
                  }`}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{isMuted ? 'Muted' : 'Mute'}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>

                <AnimatePresence>
                  {isMuteMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsMuteMenuOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute bottom-12 left-0 right-0 bg-bg-surface border border-border-subtle rounded-xl shadow-xl z-40 py-1 overflow-hidden"
                      >
                        {[
                          { val: '1h', label: '1 hour' },
                          { val: '8h', label: '8 hours' },
                          { val: '24h', label: '24 hours' },
                          { val: '7d', label: '7 days' },
                          { val: 'always', label: 'Mute always' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            onClick={() => handleMuteToggle(opt.val)}
                            className="w-full text-left px-4 py-2 text-xs text-text-base hover:bg-bg-surface-hover/80 transition-colors font-medium flex justify-between items-center"
                          >
                            <span>{opt.label}</span>
                          </button>
                        ))}
                        {isMuted && (
                          <button
                            onClick={() => handleMuteToggle('none')}
                            className="w-full text-left px-4 py-2 text-xs text-primary-light hover:bg-bg-surface-hover/80 border-t border-border-subtle/50 transition-colors font-semibold"
                          >
                            Unmute
                          </button>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={handleBlockToggle}
                disabled={isTogglingBlock}
                className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 ${
                  profile.isBlockedByMe 
                    ? 'bg-danger/10 border-danger/20 text-danger-light hover:bg-danger/20' 
                    : 'bg-bg-surface-hover border-border-subtle text-danger hover:bg-danger/5 hover:border-danger/20'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{profile.isBlockedByMe ? 'Unblock' : 'Block'}</span>
              </button>
            </div>

            {/* About / Bio Section */}
            {profile.bio && (
              <div className="bg-bg-surface-hover/50 border border-border-subtle/50 rounded-2xl p-4 space-y-1">
                <span className="text-xs text-text-muted font-semibold uppercase tracking-wider">About</span>
                <p className="text-sm text-text-base leading-relaxed break-words whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}

            {/* Shared Media & Files Section */}
            <div className="space-y-4">
              <div className="flex border-b border-border-subtle">
                <button
                  onClick={() => setActiveTab('media')}
                  className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
                    activeTab === 'media'
                      ? 'border-primary text-primary-light'
                      : 'border-transparent text-text-muted hover:text-text-base'
                  }`}
                >
                  Media
                </button>
                <button
                  onClick={() => setActiveTab('docs')}
                  className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
                    activeTab === 'docs'
                      ? 'border-primary text-primary-light'
                      : 'border-transparent text-text-muted hover:text-text-base'
                  }`}
                >
                  Docs
                </button>
              </div>

              {/* Media Grid */}
              {activeTab === 'media' && (
                <div className="space-y-4">
                  {media.length === 0 ? (
                    <div className="text-center py-8">
                      <ImageIcon className="w-8 h-8 text-text-subtle mx-auto mb-2 opacity-50" />
                      <span className="text-xs text-text-subtle">No shared media yet</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {media.map((item) => (
                        <div
                          key={item.messageId}
                          onClick={() => setActiveMediaId(item.messageId)}
                          className="aspect-square bg-bg-surface-hover rounded-xl overflow-hidden cursor-pointer relative border border-border-subtle/40 hover:scale-[1.03] transition-all duration-200 group shadow-sm"
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '110px' }}
                        >
                          {item.attachmentType.startsWith('image/') ? (
                            <SharedImage
                              src={item.attachmentUrl}
                              alt={item.attachmentName}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center relative bg-bg-surface-hover">
                              <video
                                src={item.attachmentUrl}
                                className="w-full h-full object-cover pointer-events-none"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                <div className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center border border-white/10 shadow shadow-black/50">
                                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Documents List */}
              {activeTab === 'docs' && (
                <div className="space-y-3">
                  {docs.length === 0 ? (
                    <div className="text-center py-8">
                      <FileIcon className="w-8 h-8 text-text-subtle mx-auto mb-2 opacity-50" />
                      <span className="text-xs text-text-subtle">No shared documents yet</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {docs.map((doc) => (
                        <div
                          key={doc.messageId}
                          onClick={(e) => handleDownloadClick(e, doc.messageId)}
                          className="p-3 bg-bg-surface-hover/40 border border-border-subtle/50 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-bg-surface hover:border-primary/20 transition-all duration-200 group"
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '66px' }}
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary-light flex items-center justify-center shrink-0 border border-primary/20">
                            <FileIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-sm font-medium text-text-base truncate group-hover:text-primary-light transition-colors" title={doc.attachmentName}>
                              {doc.attachmentName}
                            </h5>
                            <p className="text-xs text-text-subtle mt-0.5 uppercase">
                              {doc.attachmentType.split('/')[1] || 'FILE'}
                            </p>
                          </div>
                          <button className="p-2 text-text-muted hover:text-white rounded-lg hover:bg-bg-surface-hover transition-colors shrink-0">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Infinite Scroll Sentinel */}
              <div ref={sentinelRef} className="h-1 w-full" />

              {/* Smooth Animated Loading Spinner */}
              <AnimatePresence>
                {showLoader && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center py-2 w-full"
                  >
                    <div className="flex space-x-1.5 items-center justify-center">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : null}
      </div>

      {/* Shared Media Viewer Modal Integration */}
      <AnimatePresence>
        {activeMediaId !== null && activeMediaIndex !== -1 && (
          <MediaViewerModal
            items={mediaViewerItems}
            currentIndex={activeMediaIndex}
            onClose={() => setActiveMediaId(null)}
            onNavigate={(idx) => setActiveMediaId(media[idx].messageId)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
