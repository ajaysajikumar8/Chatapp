import { create } from 'zustand';
import api from '../services/api';
import type { Conversation, Message, User } from '../types/chat';
import { useAuthStore } from './useAuthStore';

interface ChatState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  hasFetchedHistory: Record<string, boolean>;
  hasMoreMessages: Record<string, boolean>;
  cursors: Record<string, string | null>;
  userPresence: Record<string, { status: string; lastSeen?: string }>;
  typingStatus: Record<string, string[]>; // conversationId -> array of userIds currently typing
  selectedConversationId: string | null;
  isLoading: boolean;
  isFetchingMore: boolean;
  error: string | null;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  addMessage: (message: Message) => void;
  setMessages: (conversationId: string, messages: Message[], nextCursor?: string, hasMore?: boolean, prepend?: boolean) => void;
  setSelectedConversationId: (id: string | null) => void;
  updateUserPresence: (userId: string, status: string, lastSeen?: string) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  clearLocalUnreadCount: (conversationId: string) => void;
  updateParticipantLastReadAt: (conversationId: string, userId: string, lastReadAt: string) => void;
  updateMessageLocally: (message: Message) => void;
  deleteMessageLocally: (conversationId: string, messageId: string) => void;

  // Thunks
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string, cursor?: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string, attachment?: { url: string, type: string, name: string }) => Promise<void>;
  startConversation: (user: User) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
}

// Module-level variable to manage typing timeouts (TTL) without bloating the Zustand state
const typingTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  hasFetchedHistory: {},
  hasMoreMessages: {},
  cursors: {},
  userPresence: {},
  typingStatus: {},
  selectedConversationId: null,
  isLoading: false,
  isFetchingMore: false,
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

  setMessages: (conversationId, messages, nextCursor, hasMore, _prepend) => set((state) => {
    const existingMessages = state.messages[conversationId] || [];
    const messageMap = new Map(existingMessages.map(m => [m.id, m]));
    messages.forEach(m => messageMap.set(m.id, m));
    
    const mergedMessages = Array.from(messageMap.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return {
      messages: { ...state.messages, [conversationId]: mergedMessages },
      hasFetchedHistory: { ...state.hasFetchedHistory, [conversationId]: true },
      cursors: { ...state.cursors, [conversationId]: nextCursor !== undefined ? nextCursor : state.cursors[conversationId] },
      hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: hasMore !== undefined ? hasMore : state.hasMoreMessages[conversationId] },
    };
  }),

  updateMessageLocally: (message) => set((state) => {
    const convId = message.conversationId;
    const currentMessages = state.messages[convId];
    if (!currentMessages) return state;

    return {
      messages: {
        ...state.messages,
        [convId]: currentMessages.map((m) => (m.id === message.id ? message : m)),
      },
      conversations: state.conversations.map((c) => {
        if (c.id === convId && c.messages && c.messages.length > 0 && c.messages[0].id === message.id) {
          return {
            ...c,
            messages: [message],
          };
        }
        return c;
      }),
    };
  }),

  deleteMessageLocally: (conversationId, messageId) => set((state) => {
    const currentMessages = state.messages[conversationId];
    if (!currentMessages) return state;

    const updatedMessages = currentMessages.filter((m) => m.id !== messageId);
    
    return {
      messages: {
        ...state.messages,
        [conversationId]: updatedMessages,
      },
      conversations: state.conversations.map((c) => {
        if (c.id === conversationId && c.messages && c.messages.length > 0 && c.messages[0].id === messageId) {
          return {
            ...c,
            messages: updatedMessages.length > 0 ? [updatedMessages[updatedMessages.length - 1]] : [],
          };
        }
        return c;
      }),
    };
  }),

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to fetch conversations' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (conversationId: string, cursor?: string) => {
    if (conversationId.startsWith('temp_')) return;
    if (!cursor && get().hasFetchedHistory[conversationId]) return;
    if (cursor && get().hasMoreMessages[conversationId] === false) return;
    if (cursor && get().isFetchingMore) return;

    if (cursor) set({ isFetchingMore: true });

    try {
      const url = cursor ? `/messages/${conversationId}?cursor=${cursor}` : `/messages/${conversationId}`;
      const response = await api.get(url);
      
      const { messages, nextCursor, hasMore } = response.data.data;
      get().setMessages(conversationId, messages, nextCursor, hasMore, !!cursor);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
    } finally {
      if (cursor) set({ isFetchingMore: false });
    }
  },

  sendMessage: async (conversationId: string, content: string, attachment?: { url: string, type: string, name: string }) => {
    try {
      const payload = {
        content,
        attachmentUrl: attachment?.url,
        attachmentType: attachment?.type,
        attachmentName: attachment?.name
      };

      if (conversationId.startsWith('temp_')) {
        const recipientId = conversationId.replace('temp_', '');
        const response = await api.post(`/messages/direct/${recipientId}`, payload);
        const { message, conversation } = response.data.data;

        const newConversations = get().conversations.map(c => c.id === conversationId ? conversation : c);
        get().setConversations(newConversations);
        get().setSelectedConversationId(conversation.id);
        get().addMessage(message);
        set((state) => ({
          hasFetchedHistory: { ...state.hasFetchedHistory, [conversation.id]: true }
        }));
      } else {
        const response = await api.post(`/messages/${conversationId}`, payload);
        get().addMessage(response.data.data);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      throw error;
    }
  },
}));
