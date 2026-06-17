import React, { useEffect, useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { ConversationDetails } from '../components/chat/ConversationDetails';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { connectSocket, disconnectSocket } from '../services/socket';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { AnimatePresence } from 'framer-motion';
import type { Message } from '../types/chat';

const EMPTY_MESSAGES: Message[] = [];

export const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    conversations,
    messages,
    selectedConversationId,
    setSelectedConversationId,
    fetchConversations,
    fetchMessages,
    markConversationRead,
  } = useChatStore();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscribe, permission, pushError, setPushError } = usePushNotifications();
  const [showDetails, setShowDetails] = useState(false);

  // Automatically close details when the active conversation changes
  useEffect(() => {
    setShowDetails(false);
  }, [selectedConversationId]);

  // Handle URL deep linking for push notifications
  useEffect(() => {
    const chatId = searchParams.get('chatId');
    if (chatId) {
      setSelectedConversationId(chatId);
      searchParams.delete('chatId');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, setSelectedConversationId]);

  // Listen to Service Worker messages (when user clicks notification and app is already open)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        const url = new URL(event.data.url, window.location.origin);
        const chatId = url.searchParams.get('chatId');
        if (chatId) {
          setSelectedConversationId(chatId);
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [setSelectedConversationId]);

  // Prompt for push notifications politely after a short delay
  useEffect(() => {
    if (permission === 'default') {
      const timer = setTimeout(() => {
        subscribe();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [permission, subscribe]);

  useEffect(() => {
    connectSocket();
    fetchConversations();

    return () => {
      disconnectSocket();
    };
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    }
  }, [selectedConversationId, fetchMessages]);

  // Mark as read when a conversation is selected (if tab is visible)
  const tryMarkRead = useCallback((conversationId: string | null) => {
    if (!conversationId || conversationId.startsWith('temp_')) return;
    if (document.visibilityState === 'visible') {
      markConversationRead(conversationId);
    }
  }, [markConversationRead]);

  // Mark as read when conversation changes
  useEffect(() => {
    tryMarkRead(selectedConversationId);
  }, [selectedConversationId, tryMarkRead]);

  // Page Visibility API: mark as read when user comes back to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedConversationId) {
        tryMarkRead(selectedConversationId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedConversationId, tryMarkRead]);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null;
  const conversationMessages = selectedConversationId ? messages[selectedConversationId] || EMPTY_MESSAGES : EMPTY_MESSAGES;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden text-slate-50">
      {pushError && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 text-red-400 text-sm flex justify-between items-start z-50">
          <div>
            <strong>Warning:</strong> {pushError}
          </div>
          <button onClick={() => setPushError(null)} className="text-red-400 hover:text-red-300 ml-4 font-bold">
            ✕
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          isVisible={selectedConversationId === null}
        />
        <ChatArea
          conversation={selectedConversation}
          messages={conversationMessages}
          onBack={() => setSelectedConversationId(null)}
          isVisible={selectedConversationId !== null}
          currentUserId={user?.id || ''}
          onNewMessage={() => tryMarkRead(selectedConversationId)}
          onToggleDetails={() => setShowDetails(!showDetails)}
        />
        <AnimatePresence>
          {showDetails && selectedConversation && (
            <ConversationDetails
              conversation={selectedConversation}
              currentUserId={user?.id || ''}
              onClose={() => setShowDetails(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
