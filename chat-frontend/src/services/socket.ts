import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../store/useChatStore';

const SOCKET_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '') 
  : 'http://localhost:3000';

let socket: Socket | null = null;

export const connectSocket = () => {
  if (socket) return;

  const authStorage = localStorage.getItem('auth-storage');
  let token = '';
  if (authStorage) {
    const { state } = JSON.parse(authStorage);
    token = state.token || '';
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket?.id);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('new_message', (message) => {
    const store = useChatStore.getState();
    const convExists = store.conversations.some(c => c.id === message.conversationId);
    
    store.addMessage(message);
    
    // If we received a message for a conversation we don't have loaded,
    // fetch the latest conversations so it appears in the sidebar
    if (!convExists) {
      store.fetchConversations();
    }
  });

  socket.on('user_presence_changed', ({ userId, status, lastSeen }) => {
    useChatStore.getState().updateUserPresence(userId, status, lastSeen);
  });

  socket.on('messages_read', ({ conversationId, readBy, readAt }: { conversationId: string; readBy: string; readAt: string }) => {
    const authStorage = localStorage.getItem('auth-storage');
    let currentUserId = '';
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage);
        currentUserId = state.user?.id || '';
      } catch (e) {
        // ignore JSON parse error
      }
    }

    if (currentUserId === readBy) {
      useChatStore.getState().clearLocalUnreadCount(conversationId);
    } else {
      // The recipient read the messages — update sender's view to show blue checkmarks
      useChatStore.getState().updateParticipantLastReadAt(conversationId, readBy, readAt);
    }
  });

  socket.on('message_updated', (message) => {
    useChatStore.getState().updateMessageLocally(message);
  });

  socket.on('message_deleted', ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
    useChatStore.getState().deleteMessageLocally(conversationId, messageId);
  });

  socket.on('message_deleted_for_me', ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
    useChatStore.getState().deleteMessageLocally(conversationId, messageId);
    useChatStore.getState().fetchConversations();
  });

  socket.on('typing_start', ({ conversationId, userId }: { conversationId: string; userId: string }) => {
    useChatStore.getState().setTyping(conversationId, userId, true);
  });

  socket.on('typing_stop', ({ conversationId, userId }: { conversationId: string; userId: string }) => {
    useChatStore.getState().setTyping(conversationId, userId, false);
  });

  socket.on('block_status_changed', ({ userId, isBlockedByThem }: { userId: string; isBlockedByThem: boolean }) => {
    useChatStore.getState().updateConversationBlockStatusByThem(userId, isBlockedByThem);
    if (!isBlockedByThem) {
      useChatStore.getState().fetchConversations();
    }
  });
  
  socket.on('conversation_mute_changed', ({ conversationId, mutedUntil }: { conversationId: string; mutedUntil: string | null }) => {
    useChatStore.getState().updateConversationMuteStatus(conversationId, mutedUntil);
  });
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const emitTypingStatus = (conversationId: string, recipientId: string, isTyping: boolean) => {
  if (!socket || !socket.connected) return;
  const event = isTyping ? 'typing_start' : 'typing_stop';
  socket.emit(event, { conversationId, recipientId });
};
