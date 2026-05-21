import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, MoreVertical, Image as ImageIcon } from 'lucide-react';
import type { Conversation, Message } from '../../types/chat';
import { useChatStore } from '../../store/useChatStore';

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  onBack: () => void;
  isVisible: boolean;
  currentUserId: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  messages,
  onBack,
  isVisible,
  currentUserId,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { userPresence, sendMessage } = useChatStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const participant = conversation.participants.find(p => p.userId !== currentUserId)?.user || conversation.participants[0].user;
  const status = userPresence[participant.id]?.status || participant.status;

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
              {participant.displayName.charAt(0).toUpperCase()}
            </div>
            {status === 'ONLINE' && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success border-2 border-bg-surface rounded-full"></div>
            )}
          </div>
          
          <div>
            <h2 className="font-semibold text-text-base">{participant.displayName}</h2>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-bg-base">
        {messages.map((msg, index) => {
          const isMine = msg.senderId === currentUserId;
          const showAvatar = !isMine && (index === 0 || messages[index - 1].senderId !== msg.senderId);

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${
                isMine ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              {!isMine && (
                <div className="shrink-0 w-8">
                  {showAvatar && (
                    <div className="w-8 h-8 rounded-full bg-primary/20 text-primary-light flex items-center justify-center text-xs font-medium border border-primary/30">
                      {participant.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              )}
              
              <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMine
                      ? 'bg-primary text-white rounded-tr-sm'
                      : 'bg-bg-surface-hover text-text-base rounded-tl-sm border border-border-subtle'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-text-subtle mt-1 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-bg-base border-t border-border-subtle shrink-0">
        <div className="flex items-end gap-2 bg-bg-surface rounded-xl p-2 border border-border-subtle focus-within:border-primary-light/50 focus-within:ring-1 focus-within:ring-primary-light/50 transition-all">
          <button className="p-2 text-text-muted hover:text-primary-light hover:bg-bg-surface-hover rounded-lg transition-colors shrink-0">
            <ImageIcon className="w-5 h-5" />
          </button>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 max-h-32 min-h-[40px] bg-transparent border-none focus:ring-0 text-text-base placeholder:text-text-subtle resize-none py-2 px-2 text-sm"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (inputText.trim()) {
                  sendMessage(conversation.id, inputText.trim());
                  setInputText('');
                }
              }
            }}
          />
          
          <button
            onClick={() => {
              if (inputText.trim()) {
                sendMessage(conversation.id, inputText.trim());
                setInputText('');
              }
            }}
            disabled={!inputText.trim()}
            className="p-2 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:hover:bg-primary text-white rounded-lg transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
