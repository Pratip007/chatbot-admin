# Chatbot Admin Panel

This is an Angular-based admin panel for managing chatbot conversations with enhanced message management capabilities.

## Features

### Message Management
- **View Conversations**: Browse all user conversations with real-time updates
- **Send Messages**: Send text messages and file attachments to users
- **Edit Messages**: Edit admin messages with history tracking
- **Delete Messages**: Delete individual messages or bulk delete operations
- **Real-time Updates**: Live updates via WebSocket connections

### Enhanced Delete & Edit Functions

#### Individual Message Operations
- **Edit Admin Messages**: Click the "Edit" button on admin messages to modify content
  - Maintains edit history with timestamps and reasons
  - Real-time updates across all admin clients
  - Disabled for messages without server IDs

- **Delete Messages**: Click the "Delete" button to remove messages
  - Confirmation dialog for safety
  - Handles messages with and without server IDs
  - Real-time updates via WebSocket

#### Bulk Operations
- **Clear User Chat**: Delete all messages for a specific user
- **Clear All Chats**: Delete all messages for all users (admin only)

#### Debug Features
- **Refresh**: Reload chat history to ensure all messages have proper IDs
- **Debug**: Console logging to troubleshoot message ID issues
- **Visual Indicators**: Messages without server IDs show "No ID" warning

### API Integration

The admin panel integrates with the following enhanced API endpoints:

#### Enhanced Edit Endpoint
```
PUT /api/chat/message/:messageId/edit
```
- Tracks edit history with timestamps and reasons
- Maintains audit trail for accountability

#### Bulk Delete Endpoints
```
DELETE /api/chat/messages/user/:userId    # Delete all messages for a user
DELETE /api/chat/messages/all             # Delete all messages (admin only)
```

#### WebSocket Events
- `messageEdited` - Enhanced edit notifications
- `allMessagesDeleted` - Bulk deletion notifications
- `editMessageResult` - Edit operation results
- `deleteAllUserMessagesResult` - Bulk delete results

### Message Schema

Messages now include enhanced fields:
```typescript
interface ChatMessage {
  _id?: string;
  content: string;
  timestamp: Date;
  senderType: 'user' | 'bot' | 'admin';
  senderId?: string;
  isEdited?: boolean;
  updatedAt?: Date;
  editHistory?: EditRecord[];
  // ... other fields
}

interface EditRecord {
  originalContent: string;
  editedAt: Date;
  editedBy: string;
  reason: string;
}
```

## Development

### Prerequisites
- Node.js 18+
- Angular CLI 17+

### Installation
```bash
npm install
```

### Development Server
```bash
ng serve
```

### Build
```bash
ng build
```

## Troubleshooting

### Message ID Issues
If you encounter "Cannot delete message: No message ID found" errors:

1. Click the "Debug" button to check which messages lack IDs
2. Click the "Refresh" button to reload chat history from server
3. Messages without IDs will show a "No ID" warning badge
4. Edit/Delete buttons are disabled for messages without IDs

### Common Issues
- **WebSocket Connection**: Ensure the server is running and WebSocket URL is correct
- **API Endpoints**: Verify all enhanced endpoints are implemented on the server
- **Message Sync**: Use the refresh button if messages appear out of sync

## Configuration

Update `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  API_URL: 'https://your-api-url.com/api',
  SOCKET_URL: 'https://your-api-url.com'
};
```
