export interface Message {
  id: string;
  userId: string;
  adminId?: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  isUserMessage: boolean;
  status: 'read' | 'unread' | 'deleted';
}
