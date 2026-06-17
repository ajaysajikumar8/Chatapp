export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: 'ONLINE' | 'OFFLINE' | 'AWAY';
  lastSeen?: string;
  isDiscoverable?: boolean;
  bio?: string;
  profilePhotoUrl?: string | null;
  avatarUrl?: string | null;
}

export interface UserSettings {
  isDiscoverable: boolean;
  readReceiptsEnabled: boolean;
  lastSeenVisibility: 'EVERYONE' | 'CONTACTS' | 'NOBODY';
  profilePhotoVisibility: 'EVERYONE' | 'CONTACTS' | 'NOBODY';
  notificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
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
  updatedAt?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  sender?: User;
  optimisticId?: string;
  status?: 'sending' | 'sent' | 'error';
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  user: User;
  lastReadAt?: string;
  mutedUntil?: string | null;
}

export interface Conversation {
  id: string;
  createdAt: string;
  participants: ConversationParticipant[];
  messages: Message[];
  unreadCount?: number;
  isBlockedByMe?: boolean;
  isBlockedByThem?: boolean;
}
