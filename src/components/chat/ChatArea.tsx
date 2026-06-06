import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Send, MoreVertical, Image as ImageIcon, CheckCheck, ChevronDown, Paperclip, X, File as FileIcon, Download, Play, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { Conversation, Message } from '../../types/chat';
import { useChatStore } from '../../store/useChatStore';
import { formatMessageGroupDate } from '../../utils/dateUtils';
import { emitTypingStatus } from '../../services/socket';
import api from '../../services/api';

const EMPTY_ARRAY: string[] = [];

interface MediaWithRetryProps {
  src: string;
  msgId: string;
  alt?: string;
  className?: string;
  controls?: boolean;
}

const ImageWithRetry: React.FC<MediaWithRetryProps> = ({ src, msgId, alt, className }) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasRetried, setHasRetried] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setHasRetried(false);
  }, [src]);

  const handleError = async () => {
    if (hasRetried) return;
    try {
      const res = await api.get(`/messages/${msgId}/download-url`);
      setCurrentSrc(res.data.data.downloadUrl);
      setHasRetried(true);
    } catch (err) {
      console.error("Failed to fetch fresh image URL on error:", err);
    }
  };

  return <img src={currentSrc} alt={alt} onError={handleError} className={className} loading="lazy" />;
};

const VideoWithRetry: React.FC<MediaWithRetryProps> = ({ src, msgId, className, controls }) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasRetried, setHasRetried] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setHasRetried(false);
  }, [src]);

  const handleError = async () => {
    if (hasRetried) return;
    try {
      const res = await api.get(`/messages/${msgId}/download-url`);
      setCurrentSrc(res.data.data.downloadUrl);
      setHasRetried(true);
    } catch (err) {
      console.error("Failed to fetch fresh video URL on error:", err);
    }
  };

  return <video src={currentSrc} controls={controls} onError={handleError} className={className} />;
};

interface MediaViewerModalProps {
  mediaMessages: Message[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ mediaMessages, currentIndex, onClose, onNavigate }) => {
  const activeMedia = mediaMessages[currentIndex];
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setZoom(1);
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < mediaMessages.length - 1) {
        onNavigate(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, mediaMessages.length, onClose, onNavigate]);

  if (!activeMedia) return null;

  const isImage = activeMedia.attachmentType?.startsWith('image/');
  const isVideo = activeMedia.attachmentType?.startsWith('video/');

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 backdrop-blur-md select-none outline-none"
      onClick={onClose}
    >
      {/* Top Header Controls */}
      <div 
        className="h-16 px-6 flex items-center justify-between text-white bg-gradient-to-b from-black/60 to-transparent z-50"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate pr-4">{activeMedia.attachmentName || 'Media File'}</span>
          <span className="text-xs opacity-75">
            Sent by {activeMedia.sender?.displayName || 'User'} • {new Date(activeMedia.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          {isImage && (
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/5">
              <button 
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button 
                onClick={handleZoomReset}
                className="px-2 text-xs font-medium hover:bg-white/10 rounded-md h-7 transition-colors"
                title="Reset Zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button 
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <button 
            onClick={onClose}
            className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center relative p-4 overflow-hidden">
        {/* Previous Navigation Arrow */}
        {currentIndex > 0 && (
          <button 
            onClick={e => {
              e.stopPropagation();
              onNavigate(currentIndex - 1);
            }}
            className="absolute left-6 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border border-white/5 shadow-lg shadow-black/30 animate-fade-in"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Media Wrapper */}
        <div 
          className="max-w-full max-h-full flex items-center justify-center relative"
          onClick={e => e.stopPropagation()}
        >
          {isImage && (
            <img 
              src={activeMedia.attachmentUrl} 
              alt={activeMedia.attachmentName || 'Preview'} 
              style={{ transform: `scale(${zoom})` }}
              className="max-w-[90vw] max-h-[80vh] object-contain rounded transition-transform duration-200 ease-out"
            />
          )}

          {isVideo && (
            <div className="relative max-w-[90vw] max-h-[80vh] flex items-center justify-center">
              <video 
                ref={videoRef}
                src={activeMedia.attachmentUrl} 
                className="max-w-[90vw] max-h-[80vh] object-contain rounded"
                autoPlay
                controls
              />
            </div>
          )}
        </div>

        {/* Next Navigation Arrow */}
        {currentIndex < mediaMessages.length - 1 && (
          <button 
            onClick={e => {
              e.stopPropagation();
              onNavigate(currentIndex + 1);
            }}
            className="absolute right-6 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border border-white/5 shadow-lg shadow-black/30 animate-fade-in"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Footer Meta Indicator */}
      <div 
        className="h-16 flex items-center justify-center text-white/60 text-xs bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-50"
      >
        Media {currentIndex + 1} of {mediaMessages.length}
      </div>
    </div>
  );
};

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  onBack: () => void;
  isVisible: boolean;
  currentUserId: string;
  onNewMessage: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  messages,
  onBack,
  isVisible,
  currentUserId,
  onNewMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const isSendingRef = useRef(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);
  
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);

  const [prevConversationId, setPrevConversationId] = useState<string | undefined>(conversation?.id);

  if (conversation?.id !== prevConversationId) {
    setPrevConversationId(conversation?.id);
    setInputText('');
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsAtBottom(true);
    setUnreadWhileScrolled(0);
  }

  const { 
    userPresence, 
    sendMessage, 
    hasMoreMessages, 
    cursors, 
    isFetchingMore, 
    fetchMessages,
    addMessage,
    hasFetchedHistory,
    firstItemIndex: storeFirstItemIndex
  } = useChatStore();
  
  const firstItemIndex = conversation ? (storeFirstItemIndex[conversation.id] ?? (1000000 - (messages.length || 0))) : 0;
  
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const stableInitialTopMostItemIndex = useMemo(() => {
    return messages.length > 0 ? { index: firstItemIndex + messages.length - 1, align: 'end' as const } : 0;
  }, [messages.length, firstItemIndex]);

  const lastMessageIdRef = useRef(messages[messages.length - 1]?.id);

  useEffect(() => {
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.id !== lastMessageIdRef.current) {
      // If a NEW message was appended at the very bottom and it's from the current user,
      // force scroll down to show it. This avoids the followOutput bug on historical fetch.
      if (lastMsg.senderId === currentUserId) {
        virtuosoRef.current?.scrollToIndex({
          index: firstItemIndex + messages.length - 1,
          align: 'end',
          behavior: 'smooth'
        });
      }
      lastMessageIdRef.current = lastMsg.id;
    }
  }, [messages, firstItemIndex, currentUserId]);

  // Clean up typing timeouts on conversation switch
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversation?.id]);
  
  // Use a targeted selector to prevent unnecessary re-renders when other conversations update typing status
  const typingUsers = useChatStore(state => 
    conversation ? state.typingStatus[conversation.id] || EMPTY_ARRAY : EMPTY_ARRAY
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSend = async () => {
    const text = inputText.trim();
    if ((!text && !selectedFile) || isSendingRef.current || !conversation) return;
    
    isSendingRef.current = true;

    const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId) || conversation.participants[0];
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      emitTypingStatus(conversation.id, otherParticipant.userId, false);
      isTypingRef.current = false;
    }

    const optimisticId = `temp_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tempFile = selectedFile;
    
    const optimisticMessage: Message = {
      id: optimisticId,
      conversationId: conversation.id,
      senderId: currentUserId,
      content: text || undefined,
      attachmentUrl: tempFile ? URL.createObjectURL(tempFile) : undefined,
      attachmentType: tempFile?.type,
      attachmentName: tempFile?.name,
      createdAt: new Date().toISOString(),
      optimisticId,
      status: 'sending'
    };

    addMessage(optimisticMessage);
    
    setInputText('');
    removeSelectedFile(); // This will clear the previewUrl and revoke it
    isSendingRef.current = false;

    // Run actual upload and send in background
    (async () => {
      try {
        let attachmentData: { url: string, type: string, name: string } | undefined;

        if (tempFile) {
          const presignedRes = await api.post('/messages/presigned-url', {
            conversationId: conversation.id,
            fileName: tempFile.name,
            mimeType: tempFile.type
          });
          const { uploadUrl, fileKey } = presignedRes.data.data;

          await fetch(uploadUrl, {
            method: 'PUT',
            body: tempFile,
            headers: {
              'Content-Type': tempFile.type
            }
          });

          attachmentData = {
            url: fileKey,
            type: tempFile.type,
            name: tempFile.name
          };
        }

        await sendMessage(conversation.id, text, attachmentData, optimisticId);
      } catch (err) {
        console.error("Failed to send message with attachment:", err);
      }
    })();
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
      console.error("Failed to fetch fresh download URL:", err);
    }
  };

  const mediaMessages = messages.filter(m => m.attachmentUrl && (m.attachmentType?.startsWith('image/') || m.attachmentType?.startsWith('video/')));
  const activeMediaIndex = mediaMessages.findIndex(m => m.id === activeMediaId);

  const handleNavigateMedia = (index: number) => {
    if (index >= 0 && index < mediaMessages.length) {
      setActiveMediaId(mediaMessages[index].id);
    }
  };

  const handleCloseMediaViewer = () => {
    setActiveMediaId(null);
  };

  // Remove the simple scroll to bottom since Virtuoso handles it via initialTopMostItemIndex
  // But we still might want to scroll on new messages if the user is already near the bottom

  // Call onNewMessage when new messages arrive so ChatPage can mark as read
  const prevMessagesLengthRef = React.useRef(messages.length);
  const prevLastMessageIdRefForUnread = React.useRef(messages[messages.length - 1]?.id);

  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const currentLastMessage = messages[messages.length - 1];
      const isAppend = currentLastMessage?.id !== prevLastMessageIdRefForUnread.current;

      if (isAppend) {
        onNewMessage();
        
        if (!isAtBottom) {
          let appendedCount = 0;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].id === prevLastMessageIdRefForUnread.current) break;
            if (messages[i].senderId !== currentUserId) {
              appendedCount++;
            }
          }
          if (appendedCount > 0) {
            setUnreadWhileScrolled(prev => prev + appendedCount);
          }
        }
      }
    }
    prevMessagesLengthRef.current = messages.length;
    prevLastMessageIdRefForUnread.current = messages[messages.length - 1]?.id;
  }, [messages, onNewMessage, isAtBottom, currentUserId]);

  const loadMoreMessages = useCallback(() => {
    if (conversation && !isFetchingMore && hasMoreMessages[conversation.id] !== false) {
      const cursor = cursors[conversation.id];
      if (cursor) {
        fetchMessages(conversation.id, cursor);
      }
    }
  }, [conversation, isFetchingMore, hasMoreMessages, cursors, fetchMessages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (isTypingRef.current && conversation) {
        const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId) || conversation.participants[0];
        emitTypingStatus(conversation.id, otherParticipant.userId, false);
      }
      isTypingRef.current = false;
    };
  }, [conversation, currentUserId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);
    if (!conversation) return;
    
    const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId) || conversation.participants[0];
    
    if (newText.length === 0) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (isTypingRef.current) {
        emitTypingStatus(conversation.id, otherParticipant.userId, false);
        isTypingRef.current = false;
      }
      return;
    }

    const now = Date.now();
    // Keep-alive: emit typing_start at most once every 3 seconds to reset the receiver's TTL
    if (!isTypingRef.current || now - lastEmitTimeRef.current > 3000) {
      emitTypingStatus(conversation.id, otherParticipant.userId, true);
      isTypingRef.current = true;
      lastEmitTimeRef.current = now;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStatus(conversation.id, otherParticipant.userId, false);
      isTypingRef.current = false;
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const messageIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < messages.length; i++) {
      map.set(messages[i].id, i);
    }
    return map;
  }, [messages]);

  const virtuosoComponents = useMemo(() => {
    if (!conversation) {
      return {
        Header: () => <div className="h-4" />,
        Footer: () => <div className="h-4" />,
      };
    }
    
    const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId) || conversation.participants[0];
    const otherUserId = otherParticipant.user.id;
    const otherUserDisplayName = otherParticipant.user.displayName;
    
    return {
      Header: () => <div className="h-4" />,
      Footer: () => (
        typingUsers.includes(otherUserId) ? (
          <div className="flex gap-3 max-w-[85%] pt-2 pb-4 px-4">
            <div className="shrink-0 w-8">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-xs font-medium border border-primary/30">
                {otherUserDisplayName.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="flex flex-col items-start">
              <div className="px-4 py-3 rounded-2xl bg-bg-surface-hover border border-border-subtle rounded-tl-sm flex items-center gap-1.5 h-[44px]">
                <div className="w-1.5 h-1.5 bg-text-subtle rounded-full typing-dot"></div>
                <div className="w-1.5 h-1.5 bg-text-subtle rounded-full typing-dot"></div>
                <div className="w-1.5 h-1.5 bg-text-subtle rounded-full typing-dot"></div>
              </div>
            </div>
          </div>
        ) : <div className="h-4"></div>
      ),
    };
  }, [conversation, typingUsers, currentUserId]);

  if (!conversation) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-bg-base h-full">
        <div className="text-center">
          <div className="w-20 h-20 bg-bg-surface rounded-full flex items-center justify-center mx-auto mb-4 border border-border-subtle">
            <svg
              className="w-10 h-10 text-text-subtle"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-text-base">Your Messages</h3>
          <p className="text-text-subtle mt-2">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId) || conversation.participants[0];
  const otherUser = otherParticipant.user;
  const status = userPresence[otherUser.id]?.status || otherUser.status;

  return (
    <div
      className={`${
        isVisible ? 'flex' : 'hidden'
      } md:flex flex-col flex-1 bg-bg-base h-full`}
    >
      {/* Header */}
      <div className="h-[73px] px-4 border-b border-border-subtle flex items-center justify-between bg-bg-base/80 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-2 rounded-full hover:bg-bg-surface-hover text-text-base transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary-light flex items-center justify-center font-semibold border border-primary/30">
              {otherUser.displayName.charAt(0).toUpperCase()}
            </div>
            {status === 'ONLINE' && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success border-2 border-bg-surface rounded-full"></div>
            )}
          </div>
          
          <div>
            <h2 className="font-semibold text-text-base">{otherUser.displayName}</h2>
            <p className="text-xs text-text-muted capitalize">
              {status?.toLowerCase()}
            </p>
          </div>
        </div>
        
        <button className="p-2 rounded-full hover:bg-bg-surface-hover text-text-muted transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-bg-base overflow-hidden relative">
        {!conversation || !hasFetchedHistory[conversation.id] ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <Virtuoso
          key={conversation?.id || 'empty'}
          ref={virtuosoRef}
          data={messages}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={stableInitialTopMostItemIndex}
          alignToBottom={true}
          startReached={loadMoreMessages}
          atBottomThreshold={10}
          atBottomStateChange={(bottom) => {
            setIsAtBottom(bottom);
            if (bottom) {
              setUnreadWhileScrolled(0);
            }
          }}
          followOutput={(isAtBottom: boolean) => {
            return isAtBottom ? 'smooth' : false;
          }}
          className="h-full w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          components={virtuosoComponents}
          itemContent={(_, msg) => {
            if (!msg) return null;
            const dataIndex = messageIndexMap.get(msg.id) ?? -1;
            if (dataIndex === -1) return null;

            const isMine = msg.senderId === currentUserId;
            const prevMsg = dataIndex > 0 ? messages[dataIndex - 1] : null;
            const showAvatar = !isMine && (!prevMsg || prevMsg.senderId !== msg.senderId);

            const messageDateGroup = formatMessageGroupDate(msg.createdAt);
            const previousMessageDateGroup = prevMsg ? formatMessageGroupDate(prevMsg.createdAt) : null;
            const showDateSeparator = messageDateGroup !== previousMessageDateGroup;

            return (
              <div className="pb-6 px-4">
                {showDateSeparator && (
                  <div className="flex justify-center pb-4">
                    <div className="px-3 py-1 bg-bg-surface border border-border-subtle rounded-full text-xs font-medium text-text-subtle shadow-sm">
                      {messageDateGroup}
                    </div>
                  </div>
                )}
                <div
                  className={`flex gap-3 max-w-[85%] ${
                    isMine ? 'ml-auto flex-row-reverse' : ''
                  }`}
                >
                  {!isMine && (
                    <div className="shrink-0 w-8">
                      {showAvatar && (
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-xs font-medium border border-primary/30">
                          {otherUser.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-full`}>
                    <div
                      className={`px-3 pt-2 pb-1.5 rounded-2xl text-[15px] max-w-full shadow-sm ${
                        isMine
                          ? 'bg-primary text-white rounded-tr-sm'
                          : 'bg-bg-surface-hover text-text-base rounded-tl-sm border border-border-subtle'
                      }`}
                    >
                      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                        <div className="flex flex-col gap-2 max-w-full">
                          {msg.attachmentUrl && (
                            <div className="pb-1 rounded-lg overflow-hidden max-w-[280px]">
                              {msg.attachmentType?.startsWith('image/') ? (
                                <div className="cursor-pointer" onClick={() => setActiveMediaId(msg.id)}>
                                  <ImageWithRetry src={msg.attachmentUrl} msgId={msg.id} alt={msg.attachmentName || 'Image'} className="w-full h-auto object-cover rounded-lg" />
                                </div>
                              ) : msg.attachmentType?.startsWith('video/') ? (
                                <div className="relative group cursor-pointer" onClick={() => setActiveMediaId(msg.id)}>
                                  <VideoWithRetry src={msg.attachmentUrl} msgId={msg.id} controls={false} className="w-full h-auto rounded-lg max-h-[240px] object-cover pointer-events-none" />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors rounded-lg">
                                    <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center border border-white/20 shadow-md transform group-hover:scale-105 transition-all">
                                      <Play className="w-4 h-4 fill-current ml-0.5 text-white" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <a 
                                  href={msg.attachmentUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={(e) => handleDownloadClick(e, msg.id)}
                                  className={`flex items-center gap-2 p-3 rounded-lg ${isMine ? 'bg-primary-hover/50 text-white hover:bg-primary-hover' : 'bg-bg-surface border border-border-subtle hover:bg-bg-surface-hover text-text-base'} transition-colors`}
                                >
                                  <FileIcon className="w-8 h-8 shrink-0 opacity-80" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium truncate">{msg.attachmentName || 'Download File'}</span>
                                    <span className="text-xs opacity-70 uppercase">{msg.attachmentType?.split('/')[1] || 'FILE'}</span>
                                  </div>
                                  <Download className="w-4 h-4 ml-auto opacity-70" />
                                </a>
                              )}
                            </div>
                          )}
                          {msg.content && (
                            <span className="text-left leading-relaxed max-w-full break-words">
                              {msg.content}
                            </span>
                          )}
                        </div>
                        
                        <div className={`flex items-center justify-end gap-1 shrink-0 ml-auto pb-[1px] ${isMine ? 'text-white/80' : 'text-text-subtle'}`}>
                          <span className="text-[10.5px] font-medium leading-none tracking-wide">
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMine && (
                            <div className="flex items-center">
                              {otherParticipant.lastReadAt && new Date(msg.createdAt) <= new Date(otherParticipant.lastReadAt) ? (
                                <CheckCheck className="w-[15px] h-[15px] text-[#38bdf8] drop-shadow-sm stroke-[2.5]" />
                              ) : (
                                <CheckCheck className="w-[15px] h-[15px] opacity-75 stroke-[2.5]" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        />
        )}

        {/* Scroll to Bottom FAB */}
        {!isAtBottom && (
          <button
            onClick={() => {
              virtuosoRef.current?.scrollToIndex({
                index: firstItemIndex + messages.length - 1,
                align: 'end',
                behavior: 'smooth'
              });
            }}
            className="absolute bottom-4 right-4 z-20 p-2.5 bg-bg-surface/95 backdrop-blur-md border border-border-subtle rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:bg-bg-surface-hover hover:scale-105 active:scale-95 transition-all text-text-base flex items-center justify-center group"
          >
            <ChevronDown className="w-5 h-5 text-text-subtle group-hover:text-text-base transition-colors" />
            {unreadWhileScrolled > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] font-bold px-1.5 min-w-[20px] h-[20px] flex items-center justify-center rounded-full shadow-sm ring-2 ring-bg-surface">
                {unreadWhileScrolled > 99 ? '99+' : unreadWhileScrolled}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-bg-base border-t border-border-subtle shrink-0">
        {selectedFile && (
          <div className="mb-3 p-3 bg-bg-surface border border-border-subtle rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              {selectedFile.type.startsWith('image/') ? (
                <div className="w-10 h-10 rounded bg-bg-surface-hover flex items-center justify-center overflow-hidden shrink-0">
                  <img src={previewUrl || ''} alt="preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded bg-primary/10 text-primary-light flex items-center justify-center shrink-0">
                  <FileIcon className="w-5 h-5" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-text-base truncate">{selectedFile.name}</span>
                <span className="text-xs text-text-subtle">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </div>
            <button onClick={removeSelectedFile} className="p-1.5 rounded-full hover:bg-bg-surface-hover text-text-muted transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        
        <div className="flex items-end gap-2 bg-bg-surface rounded-xl p-2 border border-border-subtle focus-within:border-primary-light/50 focus-within:ring-1 focus-within:ring-primary-light/50 transition-all">
          <input type="file" ref={imageInputRef} onChange={handleFileSelect} accept="image/*,video/*" className="hidden" />
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
          
          <button onClick={() => imageInputRef.current?.click()} className="p-2 text-text-muted hover:text-primary-light hover:bg-bg-surface-hover rounded-lg transition-colors shrink-0" title="Attach Image or Video">
            <ImageIcon className="w-5 h-5" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="p-2 -ml-1 text-text-muted hover:text-primary-light hover:bg-bg-surface-hover rounded-lg transition-colors shrink-0" title="Attach File">
            <Paperclip className="w-5 h-5" />
          </button>
          
          <textarea
            value={inputText}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 max-h-32 min-h-[40px] bg-transparent border-none focus:ring-0 text-text-base placeholder:text-text-subtle resize-none py-2 px-2 text-sm"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          
          <button
            onClick={handleSend}
            disabled={!inputText.trim() && !selectedFile}
            className="p-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white rounded-lg transition-colors shrink-0 relative"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeMediaId !== null && activeMediaIndex !== -1 && (
        <MediaViewerModal 
          mediaMessages={mediaMessages}
          currentIndex={activeMediaIndex}
          onClose={handleCloseMediaViewer}
          onNavigate={handleNavigateMedia}
        />
      )}
    </div>
  );
};
