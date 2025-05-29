export interface ChatMessage {
  _id?: string;
  content: string;
  timestamp: Date;
  senderType?: 'user' | 'bot' | 'admin';
  senderId?: string;
  isEditing?: boolean;
  editContent?: string;
  isDeleted?: boolean;
  error?: string;
  isRead?: boolean;
  isEdited?: boolean;
  updatedAt?: Date;
  editHistory?: EditRecord[];
  file?: {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    data: string;
  };
}

export interface EditRecord {
  originalContent: string;
  editedAt: Date;
  editedBy: string;
  reason: string;
}
