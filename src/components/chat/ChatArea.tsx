import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, MoreVertical, Image as ImageIcon, CheckCheck, ChevronDown } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';
import type { Conversation, Message } from '../../types/chat';
import { useChatStore } from '../../store/useChatStore';
import { formatMessageGroupDate } from '../../utils/dateUtils';
import { emitTypingStatus } from '../../services/socket';

const EMPTY_ARRAY: string[] = [];

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
  const [isSending, setIsSending] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const lastEmitTimeRef = useRef(0);
  
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);

  // Manage firstItemIndex safely to avoid shifting on append
  const [firstItemIndex, setFirstItemIndex] = useState(() => 1000000 - (messages.length || 0));
  const firstMessageIdRef = useRef(messages[0]?.id);

  useEffect(() => {
    if (!messages.length) return;
    if (messages[0].id !== firstMessageIdRef.current) {
      const oldIndex = messages.findIndex(m => m.id === firstMessageIdRef.current);
      if (oldIndex > 0) {
        // Items were prepended
        setFirstItemIndex(prev => prev - oldIndex);
      } else {
        // Switched conversation
        setFirstItemIndex(1000000 - messages.length);
      }
      firstMessageIdRef.current = messages[0].id;
    }
  }, [messages, conversation?.id]);
  
  const { 
    userPresence, 
    sendMessage, 
    hasMoreMessages, 
    cursors, 
    isFetchingMore, 
    fetchMessages 
  } = useChatStore();
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  // Use a targeted selector to prevent unnecessary re-renders when other conversations update typing status
  const typingUsers = useChatStore(state => 
    conversation ? state.typingStatus[conversation.id] || EMPTY_ARRAY : EMPTY_ARRAY
  );

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending || !conversation) return;
    setInputText('');
    setIsSending(true);

    const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId) || conversation.participants[0];
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      emitTypingStatus(conversation.id, otherParticipant.userId, false);
      isTypingRef.current = false;
    }

    try {
      await sendMessage(conversation.id, text);
    } finally {
      setIsSending(false);
    }
  };

  // Remove the simple scroll to bottom since Virtuoso handles it via initialTopMostItemIndex
  // But we still might want to scroll on new messages if the user is already near the bottom

  // Call onNewMessage when new messages arrive so ChatPage can mark as read
  const prevMessagesLengthRef = React.useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      onNewMessage();
      
      const newMessagesCount = messages.length - prevMessagesLengthRef.current;
      if (!isAtBottom) {
        const incomingNewMessages = messages.slice(-newMessagesCount).filter(m => m.senderId !== currentUserId);
        if (incomingNewMessages.length > 0) {
          setUnreadWhileScrolled(prev => prev + incomingNewMessages.length);
        }
      }
    }
    prevMessagesLengthRef.current = messages.length;
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
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0} // Start at the bottom
          startReached={loadMoreMessages}
          atBottomStateChange={(bottom) => {
            setIsAtBottom(bottom);
            if (bottom) {
              setUnreadWhileScrolled(0);
            }
          }}
          followOutput={(isAtBottom: boolean) => {
            if (messages.length > 0 && messages[messages.length - 1].senderId === currentUserId) {
              return 'smooth';
            }
            return isAtBottom ? 'smooth' : false;
          }}
          className="h-full w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          components={{
            Header: () => <div className="h-4" />,
            Footer: () => (
              conversation && typingUsers.includes(otherUser.id) ? (
                <div className="flex gap-3 max-w-[85%] mt-2 pb-4 px-4">
                  <div className="shrink-0 w-8">
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-xs font-medium border border-primary/30">
                      {otherUser.displayName.charAt(0).toUpperCase()}
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
          }}
          itemContent={(_, msg) => {
            const dataIndex = messages.findIndex(m => m.id === msg.id);
            const isMine = msg.senderId === currentUserId;
            const showAvatar = !isMine && (dataIndex === 0 || messages[dataIndex - 1].senderId !== msg.senderId);

            const messageDateGroup = formatMessageGroupDate(msg.createdAt);
            const previousMessageDateGroup = dataIndex > 0 ? formatMessageGroupDate(messages[dataIndex - 1].createdAt) : null;
            const showDateSeparator = messageDateGroup !== previousMessageDateGroup;

            return (
              <div className="pb-6 px-4">
                {showDateSeparator && (
                  <div className="flex justify-center mb-4">
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
                        <span className="text-left leading-relaxed max-w-full break-words">
                          {msg.content}
                        </span>
                        
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
        <div className="flex items-end gap-2 bg-bg-surface rounded-xl p-2 border border-border-subtle focus-within:border-primary-light/50 focus-within:ring-1 focus-within:ring-primary-light/50 transition-all">
          <button className="p-2 text-text-muted hover:text-primary-light hover:bg-bg-surface-hover rounded-lg transition-colors shrink-0">
            <ImageIcon className="w-5 h-5" />
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
            disabled={!inputText.trim() || isSending}
            className="p-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white rounded-lg transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
