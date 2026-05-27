import React, { useEffect, useCallback } from 'react';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatArea } from '../components/chat/ChatArea';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { connectSocket, disconnectSocket } from '../services/socket';
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
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-50">
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
      />
    </div>
  );
};
