import { create } from 'zustand';
import api from '../services/api';
import type { Conversation, Message, User } from '../types/chat';
import { useAuthStore } from './useAuthStore';

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  userPresence: Record<string, { status: string; lastSeen?: string }>;
  typingStatus: Record<string, string[]>; // conversationId -> array of userIds currently typing
  selectedConversationId: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  addMessage: (message: Message) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  setSelectedConversationId: (id: string | null) => void;
  updateUserPresence: (userId: string, status: string, lastSeen?: string) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  clearLocalUnreadCount: (conversationId: string) => void;
  updateParticipantLastReadAt: (conversationId: string, userId: string, lastReadAt: string) => void;

  // Thunks
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  startConversation: (user: User) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
}

// Module-level variable to manage typing timeouts (TTL) without bloating the Zustand state
const typingTimeouts: Record<string, NodeJS.Timeout> = {};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  userPresence: {},
  typingStatus: {},
  selectedConversationId: null,
  isLoading: false,
  error: null,

  setConversations: (conversations) => {
    const presence: Record<string, { status: string; lastSeen?: string }> = {};
    conversations.forEach((conv) => {
      conv.participants.forEach((p) => {
        if (p.user) {
          presence[p.user.id] = { status: p.user.status, lastSeen: p.user.lastSeen };
        }
      });
    });
    set((state) => ({
      conversations,
      userPresence: { ...state.userPresence, ...presence },
    }));
  },

  addMessage: (message) => set((state) => {
    const convId = message.conversationId;
    const currentMessages = state.messages[convId] || [];

    if (currentMessages.some((m) => m.id === message.id)) {
      return state;
    }

    const currentUserId = useAuthStore.getState().user?.id;
    const selectedId = state.selectedConversationId;
    const isActiveConversation = selectedId === convId;
    const isTabVisible = document.visibilityState === 'visible';
    const isMine = message.senderId === currentUserId;

    // Increment unread only if: not my message, not currently viewing, or tab hidden
    const shouldIncrementUnread = !isMine && !(isActiveConversation && isTabVisible);

    return {
      messages: {
        ...state.messages,
        [convId]: [...currentMessages, message],
      },
      conversations: state.conversations.map((c) => {
        if (c.id === convId) {
          const newLastMessage = c.messages && c.messages.length > 0 && new Date(c.messages[0].createdAt) > new Date(message.createdAt)
            ? c.messages
            : [message];
          return {
            ...c,
            messages: newLastMessage,
            unreadCount: shouldIncrementUnread ? (c.unreadCount ?? 0) + 1 : (c.unreadCount ?? 0),
          };
        }
        return c;
      }),
    };
  }),

  setMessages: (conversationId, messages) => set((state) => ({
    messages: { ...state.messages, [conversationId]: messages },
  })),

  setSelectedConversationId: (id) => set({ selectedConversationId: id }),

  updateUserPresence: (userId, status, lastSeen) => set((state) => ({
    userPresence: { ...state.userPresence, [userId]: { status, lastSeen } },
  })),

  setTyping: (conversationId, userId, isTyping) => set((state) => {
    const currentTyping = state.typingStatus[conversationId] || [];
    const isCurrentlyTyping = currentTyping.includes(userId);
    const timeoutKey = `${conversationId}-${userId}`;

    // Manage TTL
    if (typingTimeouts[timeoutKey]) {
      clearTimeout(typingTimeouts[timeoutKey]);
      delete typingTimeouts[timeoutKey];
    }

    if (isTyping) {
      // Set a 5-second TTL to automatically clear the typing indicator if a 'stop' or 'keep-alive' isn't received
      typingTimeouts[timeoutKey] = setTimeout(() => {
        get().setTyping(conversationId, userId, false);
      }, 5000);

      if (!isCurrentlyTyping) {
        return {
          typingStatus: {
            ...state.typingStatus,
            [conversationId]: [...currentTyping, userId],
          },
        };
      }
    } else if (!isTyping) {
      if (isCurrentlyTyping) {
        return {
          typingStatus: {
            ...state.typingStatus,
            [conversationId]: currentTyping.filter((id) => id !== userId),
          },
        };
      }
    }
    return state;
  }),

  // Called when we mark a conversation as read locally
  clearLocalUnreadCount: (conversationId) => set((state) => ({
    conversations: state.conversations.map((c) =>
      c.id === conversationId ? { ...c, unreadCount: 0 } : c
    ),
  })),

  // Called when we receive messages_read socket event — updates the other person's read receipt
  updateParticipantLastReadAt: (conversationId, userId, lastReadAt) => set((state) => ({
    conversations: state.conversations.map((c) => {
      if (c.id === conversationId) {
        return {
          ...c,
          participants: c.participants.map((p) =>
            p.userId === userId ? { ...p, lastReadAt } : p
          ),
        };
      }
      return c;
    }),
  })),

  fetchConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/conversations');
      get().setConversations(response.data.data);
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to fetch conversations' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId: string) => {
    if (conversationId.startsWith('temp_')) return;
    if (get().messages[conversationId]) return;
    try {
      const response = await api.get(`/messages/${conversationId}`);
      get().setMessages(conversationId, response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
    }
  },

  sendMessage: async (conversationId: string, content: string) => {
    try {
      if (conversationId.startsWith('temp_')) {
        const recipientId = conversationId.replace('temp_', '');
        const response = await api.post(`/messages/direct/${recipientId}`, { content });
        const { message, conversation } = response.data.data;

        const newConversations = get().conversations.map(c => c.id === conversationId ? conversation : c);
        get().setConversations(newConversations);
        get().setSelectedConversationId(conversation.id);
        get().addMessage(message);
      } else {
        const response = await api.post(`/messages/${conversationId}`, { content });
        get().addMessage(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      throw error;
    }
  },

  markConversationRead: async (conversationId: string) => {
    if (conversationId.startsWith('temp_')) return;
    try {
      await api.post(`/conversations/${conversationId}/read`);
      // Clear unread count locally immediately for instant UI feedback
      get().clearLocalUnreadCount(conversationId);
    } catch (error: any) {
      console.error('Failed to mark conversation as read:', error);
    }
  },

  startConversation: async (user: User) => {
    try {
      const existingConv = get().conversations.find(c =>
        c.participants.some(p => p.userId === user.id)
      );

      if (existingConv) {
        get().setSelectedConversationId(existingConv.id);
        return;
      }

      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;

      const tempId = `temp_${user.id}`;
      const tempConversation: Conversation = {
        id: tempId,
        createdAt: new Date().toISOString(),
        participants: [
          { id: `temp_p_${currentUser.id}`, conversationId: tempId, userId: currentUser.id, user: currentUser as User },
          { id: `temp_p_${user.id}`, conversationId: tempId, userId: user.id, user: user },
        ],
        messages: [],
        unreadCount: 0,
      };

      get().setConversations([tempConversation, ...get().conversations]);
      get().setSelectedConversationId(tempId);
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      throw error;
    }
  },
}));
