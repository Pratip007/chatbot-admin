import { ChatMessage } from './chat-message.model';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: Date;
  lastActive?: Date;
  updatedAt?: Date;
  lastMessage?: ChatMessage;
  role: 'user' | 'admin';
  status: 'active' | 'inactive' | 'banned';
  messages?: ChatMessage[];
  unreadCount?: number;
}
