export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: 'ONLINE' | 'OFFLINE' | 'AWAY';
  lastSeen?: string;
  isDiscoverable?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
  createdAt: string;
  sender?: User;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  user: User;
  lastReadAt?: string;
}

export interface Conversation {
  id: string;
  createdAt: string;
  participants: ConversationParticipant[];
  messages: Message[];
  unreadCount?: number;
}
