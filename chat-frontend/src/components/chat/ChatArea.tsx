import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, Send, MoreVertical, Image as ImageIcon, 
  CheckCheck, ChevronDown, Paperclip, X, File as FileIcon, 
  Download, Play, ShieldAlert, VolumeX, Volume2, Info, Trash2, Check
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { Conversation, Message } from '../../types/chat';
import { useChatStore } from '../../store/useChatStore';
import { MessageContextMenu } from './MessageContextMenu';
import { DeleteMessageModal } from './DeleteMessageModal';
import { formatMessageGroupDate } from '../../utils/dateUtils';
import { emitTypingStatus } from '../../services/socket';
import api from '../../services/api';
import { MediaViewerModal } from './MediaViewerModal';

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

// Extracted MediaViewerModal to its own file

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  onBack: () => void;
  isVisible: boolean;
  currentUserId: string;
  onNewMessage: () => void;
  onToggleDetails?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  messages,
  onBack,
  isVisible,
  currentUserId,
  onNewMessage,
  onToggleDetails,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showMuteSubmenu, setShowMuteSubmenu] = useState(false);

  // Context Menu & Edit State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: any } | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<any | null>(null);
  const touchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContextMenu = (e: React.MouseEvent, message: any) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      message,
    });
  };

  const handleTouchStart = (e: React.TouchEvent, message: any) => {
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    touchTimeoutRef.current = setTimeout(() => {
      setContextMenu({
        x: clientX,
        y: clientY,
        message,
      });
    }, 600);
  };

  const handleTouchEnd = () => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
  };

  const handleCopyMessage = (message: any) => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
  };

  const handleStartEdit = (message: any) => {
    setEditingMessage(message);
    setInputText(message.content || '');
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;
    const trimmed = inputText.trim();
    if (!trimmed) return;
    try {
      await editMessage(editingMessage.id, trimmed);
      handleCancelEdit();
    } catch (err) {
      console.error(err);
      alert('Failed to edit message. The 15-minute editing window may have expired.');
    }
  };

  const handleConfirmDelete = async (type: 'me' | 'everyone') => {
    if (!messageToDelete) return;
    try {
      await deleteMessage(messageToDelete.id, type);
    } catch (err) {
      console.error(err);
      alert('Failed to delete message. The deletion window may have expired.');
    } finally {
      setMessageToDelete(null);
    }
  };

  const canEdit = (msg: any) => {
    const timeDiff = Date.now() - new Date(msg.createdAt).getTime();
    return timeDiff <= 15 * 60 * 1000;
  };

  const canDeleteEveryone = (msg: any) => {
    const timeDiff = Date.now() - new Date(msg.createdAt).getTime();
    return timeDiff <= 24 * 60 * 60 * 1000;
  };

  useEffect(() => {
    if (!isMenuOpen) {
      setShowMuteSubmenu(false);
    }
  }, [isMenuOpen]);

  // Check block status whenever conversation changes
  useEffect(() => {
    if (!conversation) return;
    setIsBlocked(!!conversation.isBlockedByMe);
  }, [conversation]);

  const { 
    userPresence, 
    sendMessage, 
    hasMoreMessages, 
    cursors, 
    isFetchingMore, 
    fetchMessages,
    addMessage,
    hasFetchedHistory,
    firstItemIndex: storeFirstItemIndex,
    updateConversationBlockStatus,
    muteConversation,
    editMessage,
    deleteMessage
  } = useChatStore();

  const handleMute = async (duration: string) => {
    if (!conversation) return;
    await muteConversation(conversation.id, duration);
    setIsMenuOpen(false);
  };

  const handleUnmute = async () => {
    if (!conversation) return;
    await muteConversation(conversation.id, 'none');
    setIsMenuOpen(false);
  };

  const handleBlockToggle = async () => {
    if (!conversation) return;
    const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId) || conversation.participants[0];
    if (!otherParticipant) return;
    const targetUserId = otherParticipant.user.id;
    setIsMenuOpen(false);
    
    try {
      if (isBlocked) {
        await api.delete(`/users/me/block/${targetUserId}`);
        setIsBlocked(false);
        updateConversationBlockStatus(conversation.id, false);
      } else {
        await api.post(`/users/me/block/${targetUserId}`);
        setIsBlocked(true);
        updateConversationBlockStatus(conversation.id, true);
      }
    } catch (err) {
      console.error("Failed to toggle block status", err);
    }
  };

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
    setIsMenuOpen(false);
  }
  
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
    if (editingMessage) {
      await handleSaveEdit();
      return;
    }
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

  const mediaViewerItems = useMemo(() => {
    return mediaMessages.map(m => ({
      id: m.id,
      attachmentUrl: m.attachmentUrl || '',
      attachmentType: m.attachmentType || '',
      attachmentName: m.attachmentName,
      createdAt: m.createdAt.toString(),
      senderName: m.sender?.displayName || 'User'
    }));
  }, [mediaMessages]);

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
              {otherParticipant.user.avatarUrl ? (
                <img src={otherParticipant.user.avatarUrl} alt={otherUserDisplayName} className="w-8 h-8 rounded-full object-cover border border-primary/10" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-xs font-medium border border-primary/30">
                  {otherUserDisplayName.charAt(0).toUpperCase()}
                </div>
              )}
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
        <div 
          onClick={onToggleDetails}
          className="flex items-center gap-3 cursor-pointer hover:opacity-85 select-none transition-all"
          title="Click to view contact info"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            className="md:hidden p-2 -ml-2 rounded-full hover:bg-bg-surface-hover text-text-base transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="relative">
            {otherUser.avatarUrl ? (
              <img src={otherUser.avatarUrl} alt={otherUser.displayName} className="w-10 h-10 rounded-full object-cover border border-primary/10" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary-light flex items-center justify-center font-semibold border border-primary/30">
                {otherUser.displayName.charAt(0).toUpperCase()}
              </div>
            )}
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
        
        <div className="relative">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-2 rounded-full hover:bg-bg-surface-hover text-text-muted hover:text-white transition-colors ${isMenuOpen ? 'bg-bg-surface-hover text-white' : ''}`}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          <AnimatePresence>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-bg-surface border border-border-subtle rounded-xl shadow-xl z-40 py-1.5 overflow-hidden"
                >
                  {(() => {
                    const myParticipant = conversation.participants.find(p => p.userId === currentUserId);
                    const isMuted = !!(myParticipant?.mutedUntil && new Date(myParticipant.mutedUntil) > new Date());

                    if (!showMuteSubmenu) {
                      return (
                        <>
                          <button
                            onClick={() => {
                              setIsMenuOpen(false);
                              onToggleDetails?.();
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-base hover:bg-bg-surface-hover/80 transition-colors flex items-center gap-2 font-medium"
                          >
                            <Info className="w-4 h-4 text-text-muted" />
                            View Info
                          </button>

                          <div className="border-t border-border-subtle/50 my-1" />

                          {isMuted ? (
                            <button
                              onClick={handleUnmute}
                              className="w-full text-left px-4 py-2.5 text-sm text-text-base hover:bg-bg-surface-hover/80 transition-colors flex items-center gap-2 font-medium"
                            >
                              <Volume2 className="w-4 h-4 text-text-muted" />
                              Unmute Chat
                            </button>
                          ) : (
                            <button
                              onClick={() => setShowMuteSubmenu(true)}
                              className="w-full text-left px-4 py-2.5 text-sm text-text-base hover:bg-bg-surface-hover/80 transition-colors flex items-center gap-2 font-medium"
                            >
                              <VolumeX className="w-4 h-4 text-text-muted" />
                              Mute Chat
                            </button>
                          )}
                          
                          <div className="border-t border-border-subtle/50 my-1" />

                          <button
                            onClick={handleBlockToggle}
                            className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-bg-surface-hover/80 transition-colors flex items-center gap-2 font-medium"
                          >
                            <ShieldAlert className="w-4 h-4" />
                            {isBlocked ? 'Unblock User' : 'Block User'}
                          </button>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <div className="px-4 py-1.5 flex items-center gap-2 border-b border-border-subtle/50 text-xs font-semibold text-text-muted uppercase tracking-wider shrink-0">
                            <button 
                              onClick={() => setShowMuteSubmenu(false)} 
                              className="p-1 -ml-1 rounded hover:bg-bg-surface-hover/80 text-text-muted transition-colors"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            Mute Duration
                          </div>
                          <button
                            onClick={() => handleMute('1h')}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-base hover:bg-bg-surface-hover/80 transition-colors font-medium"
                          >
                            Mute for 1 hour
                          </button>
                          <button
                            onClick={() => handleMute('8h')}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-base hover:bg-bg-surface-hover/80 transition-colors font-medium"
                          >
                            Mute for 8 hours
                          </button>
                          <button
                            onClick={() => handleMute('24h')}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-base hover:bg-bg-surface-hover/80 transition-colors font-medium"
                          >
                            Mute for 24 hours
                          </button>
                          <button
                            onClick={() => handleMute('7d')}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-base hover:bg-bg-surface-hover/80 transition-colors font-medium"
                          >
                            Mute for 7 days
                          </button>
                          <button
                            onClick={() => handleMute('always')}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-base hover:bg-bg-surface-hover/80 transition-colors font-medium"
                          >
                            Mute always
                          </button>
                        </>
                      );
                    }
                  })()}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
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
                        otherUser.avatarUrl ? (
                          <img src={otherUser.avatarUrl} alt={otherUser.displayName} className="w-8 h-8 rounded-full object-cover border border-primary/10" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-xs font-medium border border-primary/30">
                            {otherUser.displayName.charAt(0).toUpperCase()}
                          </div>
                        )
                      )}
                    </div>
                  )}
                  
                  <div 
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-full`}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchEnd}
                  >
                    <div
                      className={`px-3 pt-2 pb-1.5 rounded-2xl text-[15px] max-w-full shadow-sm select-none ${
                        msg.isDeleted
                          ? 'bg-bg-surface-hover/30 border border-border-subtle/50 text-text-subtle italic rounded-tr-sm'
                          : isMine
                            ? 'bg-primary text-white rounded-tr-sm'
                            : 'bg-bg-surface-hover text-text-base rounded-tl-sm border border-border-subtle'
                      }`}
                    >
                      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                        <div className="flex flex-col gap-2 max-w-full">
                          {msg.isDeleted ? (
                            <span className="text-left leading-relaxed max-w-full break-words italic text-text-subtle flex items-center gap-1.5 py-0.5">
                              <Trash2 size={13} className="opacity-70 shrink-0" />
                              This message was deleted
                            </span>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                        
                        <div className={`flex items-center justify-end gap-1 shrink-0 ml-auto pb-[1px] ${isMine && !msg.isDeleted ? 'text-white/80' : 'text-text-subtle'}`}>
                          {msg.isEdited && !msg.isDeleted && (
                            <span className="text-[9.5px] opacity-75 font-normal mr-1">edited</span>
                          )}
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
        {conversation?.isBlockedByThem ? (
          <div className="flex flex-col items-center justify-center p-4 bg-bg-surface border border-border-subtle rounded-xl">
            <p className="text-sm text-text-muted font-medium text-center">
              You cannot send messages to this user.
            </p>
          </div>
        ) : isBlocked ? (
          <div className="flex flex-col items-center justify-center p-4 bg-danger/5 border border-danger/10 rounded-xl">
            <p className="text-sm text-danger font-medium text-center">
              You have blocked this user. Unblock them to send a message.
            </p>
            <button
              onClick={handleBlockToggle}
              className="mt-2 px-3.5 py-1.5 bg-danger hover:bg-danger-hover text-white rounded-lg text-xs font-semibold transition-colors shadow-md shadow-danger/20"
            >
              Unblock User
            </button>
          </div>
        ) : (
          <>
            {editingMessage && (
              <div className="mb-2 px-3 py-2 bg-primary/5 border-l-2 border-primary rounded-r-xl flex items-center justify-between text-xs text-text-base">
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-primary">Editing Message</span>
                  <span className="text-text-subtle truncate mt-0.5">{editingMessage.content}</span>
                </div>
                <button 
                  onClick={handleCancelEdit} 
                  className="p-1 text-text-muted hover:text-text-base rounded-full hover:bg-bg-surface-hover transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

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
              
              {!editingMessage && (
                <>
                  <button onClick={() => imageInputRef.current?.click()} className="p-2 text-text-muted hover:text-primary-light hover:bg-bg-surface-hover rounded-lg transition-colors shrink-0" title="Attach Image or Video">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 -ml-1 text-text-muted hover:text-primary-light hover:bg-bg-surface-hover rounded-lg transition-colors shrink-0" title="Attach File">
                    <Paperclip className="w-5 h-5" />
                  </button>
                </>
              )}
              
              <textarea
                value={inputText}
                onChange={handleInputChange}
                placeholder={editingMessage ? "Edit message..." : "Type a message..."}
                className="flex-1 max-h-32 min-h-[40px] bg-transparent border-none focus:ring-0 text-text-base placeholder:text-text-subtle resize-none py-2 px-2 text-sm"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  } else if (e.key === 'Escape') {
                    if (editingMessage) {
                      handleCancelEdit();
                    }
                  }
                }}
              />
              
              <button
                onClick={handleSend}
                disabled={editingMessage ? !inputText.trim() : (!inputText.trim() && !selectedFile)}
                className="p-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white rounded-lg transition-colors shrink-0 relative"
              >
                {editingMessage ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {activeMediaId !== null && activeMediaIndex !== -1 && (
        <MediaViewerModal 
          items={mediaViewerItems}
          currentIndex={activeMediaIndex}
          onClose={handleCloseMediaViewer}
          onNavigate={handleNavigateMedia}
        />
      )}

      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEdit={() => handleStartEdit(contextMenu.message)}
          onDelete={() => {
            setMessageToDelete(contextMenu.message);
            setContextMenu(null);
          }}
          onCopy={() => handleCopyMessage(contextMenu.message)}
          isOwnMessage={contextMenu.message.senderId === currentUserId}
          canEdit={canEdit(contextMenu.message)}
          isText={!!contextMenu.message.content}
          isDeleted={!!contextMenu.message.isDeleted}
        />
      )}

      <DeleteMessageModal
        isOpen={messageToDelete !== null}
        onClose={() => setMessageToDelete(null)}
        onConfirm={handleConfirmDelete}
        canDeleteEveryone={
          messageToDelete
            ? messageToDelete.senderId === currentUserId &&
              !messageToDelete.isDeleted &&
              canDeleteEveryone(messageToDelete)
            : false
        }
      />
    </div>
  );
};
