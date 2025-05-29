import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { WebsocketService } from '../../services/websocket.service';
import { User } from '../../models/user.model';
import { ChatMessage } from '../../models/chat-message.model';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
// @ts-ignore
import heic2any from 'heic2any';

@Component({
  selector: 'app-user-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './user-chat.component.html',
  styleUrls: ['./user-chat.component.css']
})
export class UserChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  users: User[] = [];
  selectedUser?: User;
  messages: ChatMessage[] = [];
  newMessage: string = '';
  isLoading = false;
  previewImage: {url: string, name: string} | null = null;
  selectedFile: File | null = null;
  private subscriptions: Subscription[] = [];
  readonly #_bus=new Subscription();
  private deletingMessageIds = new Set<string>();
  // Track converted HEIC images to avoid re-conversion
  private convertedImages = new Map<string, string>();
  // Track image sources for display
  imageDisplaySources = new Map<string, string>();
  // Track editing state to prevent multiple simultaneous edits
  private editingMessageIds = new Set<string>();
  // Flag to prevent infinite change detection loops
  private isProcessingEdit = false;
  // Modal-based edit system
  editModal: {
    isOpen: boolean;
    message: ChatMessage | null;
    editContent: string;
  } = {
    isOpen: false,
    message: null,
    editContent: ''
  };

  constructor(
    private userService: UserService,
    private websocketService: WebsocketService,
    private route: ActivatedRoute,
    private router: Router,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();

    // Check if there's a userId in the route
    this.route.queryParams.subscribe(params => {
      if (params['userId']) {
        this.selectUser(params['userId']);
      }
    });

    // Subscribe to real-time message updates
    this.subscribeToWebSocketEvents();

    // Make component accessible for debugging
    (window as any).userChatComponent = this;
  }

  ngAfterViewChecked(): void {
    // Completely disable during edit processing to prevent infinite loops
    if (this.isProcessingEdit) {
      return;
    }

    // Only scroll to bottom if no messages are currently being edited
    const hasEditingMessages = this.messages.some(m => m.isEditing);
    if (!hasEditingMessages) {
      this.scrollToBottom();
    }
  }

  ngOnDestroy(): void {
    this.#_bus.unsubscribe();
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Clean up editing state
    this.editingMessageIds.clear();
  }

  // Subscribe to WebSocket events
  private subscribeToWebSocketEvents(): void {
    // Join admin room for all user updates
    this.websocketService.joinRoom();

    // Handle new messages
    const messageSub = this.websocketService.getMessages().subscribe(
      (messageData) => {
        console.log('Received message via WebSocket:', messageData);

        // Convert to ChatMessage format
        const newMessage: ChatMessage = {
          _id: messageData._id,
          content: messageData.content,
          timestamp: new Date(messageData.timestamp),
          senderType: messageData.senderType,
          senderId: messageData.senderId,
          file: messageData.file,
          isRead: messageData.isRead || false
        };

        // Validate that the message has an ID
        if (!newMessage._id) {
          console.warn('Received message without ID via WebSocket:', messageData);
          return; // Skip messages without IDs from WebSocket
        }

        // Check if this message is for our currently selected user
        if (this.selectedUser && (messageData.userId === this.selectedUser.id || !messageData.userId)) {
          // Check if the message already exists (avoid duplicates)
          const exists = this.messages.some(msg => {
            // First check by ID if both messages have IDs
            if (msg._id && newMessage._id) {
              return msg._id === newMessage._id;
            }
            // Fallback to content and timestamp matching
            return msg.content === newMessage.content &&
                   msg.senderType === newMessage.senderType &&
                   Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 5000;
          });

          if (!exists) {
            // Check if we have a local message without ID that matches this WebSocket message
            const localMessageIndex = this.messages.findIndex(msg =>
              !msg._id &&
              msg.content === newMessage.content &&
              msg.senderType === newMessage.senderType &&
              Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 10000
            );

            if (localMessageIndex !== -1) {
              // Update the existing local message with the ID from WebSocket
              console.log('Updating local message with WebSocket ID:', newMessage._id);
              this.messages[localMessageIndex]._id = newMessage._id;
              this.messages[localMessageIndex].senderId = newMessage.senderId;
              this.messages[localMessageIndex].isRead = newMessage.isRead;
              this.messages[localMessageIndex].file = newMessage.file || this.messages[localMessageIndex].file;

              // Trigger change detection to update the UI
              this.changeDetectorRef.detectChanges();
            } else {
              // Add as new message
              this.messages.push(newMessage);

              // Sort messages by timestamp
              this.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

              // Scroll to bottom after receiving a new message
              setTimeout(() => this.scrollToBottom(), 100);
            }

            // If this is a user message and admin is viewing the conversation, mark it as read
            if (newMessage.senderType === 'user' && this.selectedUser) {
              this.markMessageAsRead(newMessage);
            }

            // Update the selected user's last message
            this.selectedUser.lastMessage = newMessage;
          }
        }

        // Find the user this message belongs to and update their lastMessage
        if (messageData.userId) {
          const userToUpdate = this.users.find(u => u.id === messageData.userId);
          if (userToUpdate) {
            userToUpdate.lastMessage = newMessage;

            // If a new user message and it's not the current user, increment unread count
            if (newMessage.senderType === 'user' &&
                (!this.selectedUser || userToUpdate.id !== this.selectedUser.id)) {
              userToUpdate.unreadCount = (userToUpdate.unreadCount || 0) + 1;
            }
          }
        }

        // Reload users list to update the order based on most recent message
        this.refreshUsersList();
      }
    );

    // Handle message updates (legacy)
    const updateSub = this.websocketService.getMessageUpdates().subscribe(
      (updateData) => {
        console.log('Received message update via WebSocket:', updateData);

        // Find and update the message
        const messageIndex = this.messages.findIndex(msg => msg._id === updateData._id);
        if (messageIndex !== -1) {
          this.messages[messageIndex].content = updateData.content;
          this.messages[messageIndex].isEditing = false;
        }
      }
    );

    // Handle enhanced message edits
    const editSub = this.websocketService.getMessageEdits().subscribe(
      (editData) => {
        console.log('Received message edit via WebSocket:', editData);

        // Find and update the message
        const messageIndex = this.messages.findIndex(msg => msg._id === editData._id);
        if (messageIndex !== -1) {
          this.messages[messageIndex].content = editData.content;
          this.messages[messageIndex].isEdited = editData.isEdited;
          this.messages[messageIndex].updatedAt = new Date(editData.updatedAt);
          this.messages[messageIndex].editHistory = editData.editHistory;
          this.messages[messageIndex].isEditing = false;
        }
      }
    );

    // Handle message deletions
    const deleteSub = this.websocketService.getMessageDeletions().subscribe(
      (deleteData) => {
        console.log('Received message deletion via WebSocket:', deleteData);

        // Only update UI, don't make another API call
        const messageIndex = this.messages.findIndex(msg => msg._id === deleteData._id);
        if (messageIndex !== -1) {
          this.messages[messageIndex].isDeleted = true;

          // Show notification for real-time updates from other admins or the system
          const msgSender = deleteData.deletedBy || 'System';
          const notificationMsg = msgSender === 'System'
            ? 'A message was deleted'
            : `A message was deleted by ${msgSender}`;

          this.showNotification(notificationMsg, 'info');
        }
        // DO NOT call deleteChatByUserIdAndId here
      }
    );

    // Handle bulk message deletions
    const bulkDeleteSub = this.websocketService.getAllMessageDeletions().subscribe(
      (deleteData) => {
        console.log('Received bulk message deletion via WebSocket:', deleteData);

        if (deleteData.userId) {
          // Single user's messages deleted
          if (this.selectedUser && this.selectedUser.id === deleteData.userId) {
            this.messages = [];
          }

          // Update user in list
          const userToUpdate = this.users.find(u => u.id === deleteData.userId);
          if (userToUpdate) {
            userToUpdate.lastMessage = undefined;
            userToUpdate.unreadCount = 0;
          }

          this.showNotification(`All messages deleted for user`, 'info');
        } else {
          // All messages for all users deleted
          this.messages = [];
          this.users.forEach(user => {
            user.lastMessage = undefined;
            user.unreadCount = 0;
          });

          this.showNotification('All messages deleted for all users', 'info');
        }

        this.refreshUsersList();
      }
    );

    // Handle message read status updates
    const readSub = this.websocketService.getMessageReadUpdates().subscribe(
      (readData) => {
        console.log('Received message read update via WebSocket:', readData);

        if (readData.messageId) {
          // Single message update
          const messageToUpdate = this.messages.find(msg => msg._id === readData.messageId);
          if (messageToUpdate) {
            messageToUpdate.isRead = true;
          }
        } else if (readData.userId) {
          // All messages for a user update
          this.messages.forEach(msg => {
            if (msg.senderType === 'user') {
              msg.isRead = true;
            }
          });

          // Update unread count for this user in the list
          const userToUpdate = this.users.find(u => u.id === readData.userId);
          if (userToUpdate) {
            userToUpdate.unreadCount = 0;
          }
        }
      }
    );

    // Store subscriptions for cleanup
    this.subscriptions.push(messageSub, updateSub, editSub, deleteSub, bulkDeleteSub, readSub);
  }

  scrollToBottom(): void {
    try {
      if (this.messageContainer) {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  // Handle file downloads
  downloadFile(fileData: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Check if file should be displayed as image
  isImageFile(file: any): boolean {
    if (!file) {
      console.warn('isImageFile: No file provided');
      return false;
    }

    const result = this.getFileDisplayType(file.mimetype, file.originalname) === 'image';
    console.log('isImageFile check for:', file.originalname, 'MIME:', file.mimetype, 'Result:', result);
    return result;
  }

  // Handle image preview in a larger modal with HEIC support
  async openImagePreview(file: any): Promise<void> {
    if (!file) return;

    try {
      const imageUrl = await this.getImageSrc(file);
      this.previewImage = {
        url: imageUrl,
        name: file.originalname || 'Image'
      };
    } catch (error) {
      console.error('Error opening image preview:', error);
    }
  }

  // Close image preview
  closeImagePreview(): void {
    this.previewImage = null;
  }

  // Check if file is HEIC/HEIF format
  private isHeicFile(mimeType: string, filename: string): boolean {
    if (!mimeType && !filename) return false;

    const heicMimeTypes = ['image/heic', 'image/heif'];
    const heicExtensions = ['.heic', '.heif'];

    // Check MIME type first
    if (heicMimeTypes.includes(mimeType?.toLowerCase())) {
      return true;
    }

    // Check file extension (important for files with generic MIME types like application/octet-stream)
    if (filename && heicExtensions.some(ext => filename.toLowerCase().endsWith(ext))) {
      console.log('HEIC file detected by extension:', filename, 'MIME:', mimeType);
      return true;
    }

    return false;
  }

  // Convert HEIC to JPEG for display
  private async convertHeicToJpeg(fileData: string, filename: string): Promise<string> {
    try {
      // Check if already converted
      const cacheKey = `${filename}_${fileData.substring(0, 50)}`;
      if (this.convertedImages.has(cacheKey)) {
        return this.convertedImages.get(cacheKey)!;
      }

      // Convert base64 to blob
      const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/heic' });

      // Convert using heic2any
      const convertedBlob = await heic2any({
        blob: blob,
        toType: 'image/jpeg',
        quality: 0.8
      }) as Blob;

      // Convert back to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          this.convertedImages.set(cacheKey, result);
          resolve(result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(convertedBlob);
      });
    } catch (error) {
      console.error('Error converting HEIC image:', error);
      // Return original data as fallback
      return fileData.startsWith('data:') ? fileData : `data:image/heic;base64,${fileData}`;
    }
  }

  // Get proper image source for display
  async getImageSrc(file: any): Promise<string> {
    if (!file || !file.data) {
      return '';
    }

    // Ensure data has proper data URL format
    let imageData = file.data;
    if (!imageData.startsWith('data:')) {
      imageData = `data:${file.mimetype || 'image/jpeg'};base64,${imageData}`;
    }

    // Convert HEIC files
    if (this.isHeicFile(file.mimetype, file.originalname)) {
      return await this.convertHeicToJpeg(file.data, file.originalname);
    }

    return imageData;
  }

  // Simple file icon helper to fix compile error
  getFileIcon(mimeType: string): string {
    return 'file';
  }

  // Helper to determine file display type
  getFileDisplayType(mimeType: string, filename?: string): string {
    if (!mimeType && !filename) return 'other';

    // Check for HEIC files specifically
    if (this.isHeicFile(mimeType, filename || '')) {
      return 'image';
    }

    if (mimeType && mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType && mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType && mimeType.startsWith('audio/')) {
      return 'audio';
    } else if (mimeType === 'application/pdf') {
      return 'pdf';
    } else {
      return 'other';
    }
  }

  // Message editing methods
  startEditingMessage(message: ChatMessage): void {
    console.log('Starting to edit message:', message._id);

    // Set processing flag to prevent ngAfterViewChecked from running
    this.isProcessingEdit = true;

    try {
      // Check if message has ID
      if (!message._id) {
        this.showNotification('Cannot edit message without ID', 'error');
        return;
      }

      // Check if this message is already being edited
      if (this.editingMessageIds.has(message._id)) {
        console.log('Message is already being edited');
        return;
      }

      // Check if any other message is currently being edited
      const currentlyEditing = this.messages.find(m => m.isEditing);
      if (currentlyEditing && currentlyEditing._id !== message._id) {
        this.showNotification('Please finish editing the current message first', 'info');
        return;
      }

      // Add to editing set
      this.editingMessageIds.add(message._id);

      // Reset any other messages that might be in edit mode
      this.messages.forEach(m => {
        if (m !== message && m.isEditing) {
          m.isEditing = false;
          if (m._id) {
            this.editingMessageIds.delete(m._id);
          }
        }
      });

      // Start editing this message
      message.isEditing = true;
      message.editContent = message.content;

      console.log('Edit mode activated for message:', message._id);

    } catch (error) {
      console.error('Error in startEditingMessage:', error);

      // Clean up on error
      message.isEditing = false;
      message.editContent = undefined;
      if (message._id) {
        this.editingMessageIds.delete(message._id);
      }

      this.showNotification('Error starting edit mode', 'error');
    } finally {
      // Reset processing flag and trigger single change detection
      this.isProcessingEdit = false;

      // Use setTimeout to ensure this runs after the current execution context
      setTimeout(() => {
        this.changeDetectorRef.detectChanges();
      }, 0);
    }
  }

  cancelMessageEdit(message: ChatMessage): void {
    console.log('Cancelling edit for message:', message._id);

    this.isProcessingEdit = true;

    try {
      // Remove from editing set
      if (message._id) {
        this.editingMessageIds.delete(message._id);
        console.log('Removed from editing set:', message._id);
      }

      message.isEditing = false;
      message.editContent = undefined;

      console.log('Edit cancelled successfully');

    } catch (error) {
      console.error('Error in cancelMessageEdit:', error);
    } finally {
      this.isProcessingEdit = false;

      // Trigger change detection after a brief delay
      setTimeout(() => {
        this.changeDetectorRef.detectChanges();
      }, 0);
    }
  }

  saveMessageEdit(message: ChatMessage): void {
    console.log('Saving edit for message:', message._id);

    this.isProcessingEdit = true;

    try {
      if (!message.editContent?.trim()) {
        this.showNotification('Message content cannot be empty', 'error');
        return;
      }

      if (!message._id) {
        this.showNotification('Cannot save message without ID', 'error');
        return;
      }

      // Check if already saving this message
      if (!this.editingMessageIds.has(message._id)) {
        console.log('Message is not in editing state');
        return;
      }

      console.log('Proceeding with save...');

      // Store original content for potential rollback
      const originalContent = message.content;

      // Update the message content
      message.content = message.editContent.trim();
      message.isEditing = false;

      // Remove from editing set
      this.editingMessageIds.delete(message._id);

      console.log('Local state updated, calling server...');

      // Use enhanced edit API with history tracking
      this.editMessageWithHistory(message, originalContent, 'Message edited by admin');

    } catch (error) {
      console.error('Error in saveMessageEdit:', error);
      this.showNotification('Error saving message edit', 'error');
    } finally {
      this.isProcessingEdit = false;

      // Trigger change detection after a brief delay
      setTimeout(() => {
        this.changeDetectorRef.detectChanges();
      }, 0);
    }
  }

  // Enhanced edit message with history tracking
  editMessageWithHistory(message: ChatMessage, originalContent: string, reason: string): void {
    if (!message._id) {
      console.warn('Cannot edit message without ID - skipping server update');
      return;
    }

    console.log('Sending edit request to server for message:', message._id);

    this.userService.editMessageWithHistory(message._id, message.content, reason).subscribe({
      next: (response) => {
        console.log('Message edited successfully:', response);

        // Update message with edit information
        if (response.updatedMessage) {
          message.isEdited = response.updatedMessage.isEdited;
          message.updatedAt = new Date(response.updatedMessage.updatedAt);
          message.editHistory = response.updatedMessage.editHistory;
        }

        this.showNotification('Message edited successfully', 'success');
        this.changeDetectorRef.detectChanges();
      },
      error: (err) => {
        console.error('Error editing message:', err);

        // Rollback the content change on error
        message.content = originalContent;
        message.isEditing = true; // Put back in edit mode
        message.editContent = originalContent;

        // Add back to editing set
        if (message._id) {
          this.editingMessageIds.add(message._id);
        }

        this.changeDetectorRef.detectChanges();

        this.showNotification('Failed to edit message. Please try again.', 'error');
      }
    });
  }

  deleteMessage(message: ChatMessage): void {
    // Validate message ID
    if (!message._id) {
        console.error('Cannot delete message: No message ID found', message);
        this.showNotification('Cannot delete message: This message was not properly saved to the server', 'error');

        // Try to get the ID from server first
        this.handleMessageWithoutId(message);

        // Give it a moment to potentially get the ID, then offer local removal
        setTimeout(() => {
          if (!message._id) {
            // Still no ID, offer to remove locally
            if (confirm('This message was not saved to the server. Would you like to remove it from the chat locally?')) {
              const messageIndex = this.messages.findIndex(m => m === message);
              if (messageIndex !== -1) {
                this.messages.splice(messageIndex, 1);
                this.showNotification('Message removed locally', 'info');
              }
            }
          } else {
            // ID was found, try delete again
            this.showNotification('Message ID found, you can try deleting again', 'info');
          }
        }, 2000);

        return;
    }

    // Check if already deleting this message
    if (this.deletingMessageIds.has(message._id)) {
        console.log('Delete already in progress for this message');
        return;
    }

    console.log('Message to delete:', {
        id: message._id,
        content: message.content,
        senderType: message.senderType,
        timestamp: message.timestamp
    });

    if (confirm('Are you sure you want to delete this message?')) {
        console.log('Attempting to delete message:', message._id);

        // Add message ID to tracking set
        this.deletingMessageIds.add(message._id);

        // Call delete API once
        this.userService.deleteChatByUserIdAndId(message._id)
            .pipe(
                // Automatically remove from tracking after 5 seconds (safety cleanup)
                finalize(() => {
                    setTimeout(() => {
                        this.deletingMessageIds.delete(message._id!);
                    }, 5000);
                })
            )
            .subscribe({
                next: (response) => {
                    console.log('Message deleted successfully:', response);
                    // Mark message as deleted in UI
                    message.isDeleted = true;
                    // Remove from tracking
                    this.deletingMessageIds.delete(message._id!);
                    // Show success notification
                    this.showNotification('Message was successfully deleted', 'success');
                },
                error: (error) => {
                    console.error('Error deleting message:', error);
                    console.error('Error details:', {
                        status: error.status,
                        statusText: error.statusText,
                        message: error.message,
                        error: error.error
                    });

                    // Remove from tracking
                    this.deletingMessageIds.delete(message._id!);

                    // Show specific error message based on status
                    let errorMessage = 'Failed to delete message. Please try again.';
                    if (error.status === 404) {
                        errorMessage = 'Message not found or already deleted.';
                    } else if (error.status === 403) {
                        errorMessage = 'You do not have permission to delete this message.';
                    } else if (error.status === 500) {
                        errorMessage = 'Server error. Please try again later.';
                    } else if (error.status === 0) {
                        errorMessage = 'Network error. Please check your connection.';
                    }

                    this.showNotification(errorMessage, 'error');
                }
            });
    }
  }

  // Add notification method
  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    const notification = document.createElement('div');
    notification.className = `p-4 rounded-md shadow-lg flex items-center gap-2 ${
      type === 'success' ? 'bg-green-500' :
      type === 'error' ? 'bg-red-500' :
      'bg-blue-500'
    } text-white text-sm font-medium`;

    // Add icon based on type
    let icon = '';
    if (type === 'success') {
      icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>`;
    } else if (type === 'error') {
      icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>`;
    } else {
      icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>`;
    }

    notification.innerHTML = `
      ${icon}
      <span>${message}</span>
      <button class="ml-4 hover:bg-white hover:bg-opacity-20 rounded-full p-1" onclick="this.parentElement.remove()">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;

    // Add animation classes
    notification.style.transition = 'opacity 0.5s, transform 0.5s';
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-20px)';

    // Add to notification container
    const container = document.getElementById('notification-container');
    if (container) {
      container.appendChild(notification);
    } else {
      // Fallback to body if container not found
      document.body.appendChild(notification);
    }

    // Trigger animation
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 10);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-20px)';
      setTimeout(() => notification.remove(), 500);
    }, 5000);
  }

  // Server sync methods
  updateMessageOnServer(message: ChatMessage): void {
    // Only proceed if the message has an ID
    if (!message._id) {
      console.warn('Cannot update message without ID - skipping server update');
      return;
    }

    this.userService.updateMessage(message).subscribe({
      next: (response) => {
        console.log('Message updated successfully:', response);
      },
      error: (err) => {
        console.error('Error updating message:', err);
        // If update fails, you might want to revert the UI change
        // or show an error message to the user
      }
    });
  }

  deleteMessageOnServer(message: ChatMessage): void {
    // Only proceed if the message has an ID
    if (!message._id) {
      console.warn('Cannot delete message without ID - skipping server delete');
      return;
    }

    // this.userService.deleteMessage(message._id).subscribe({
    //   next: (response) => {
    //     debugger;
    //     console.log('Message deleted successfully:');
    //   },
    //   error: (err) => {
    //     console.error('Error deleting message:', err);
    //     // If delete fails, you might want to restore the message
    //     // or show an error message to the user
    //   }
    // });
  }

  deleteMessageByMessageId(messageId: any): void {
    // Find the message in our current messages array
    const message = this.messages.find(msg => msg._id === messageId._id);
    if (message) {
      // Use the main deleteMessage method to handle the deletion
      this.deleteMessage(message);
    } else {
      console.warn('Message not found in current messages array');
      // Fallback to direct API call if message not found in current array
      this.#_bus.add(
        this.userService.deleteChatByUserIdAndId(messageId._id!).subscribe({
          next: (response) => {
            console.log("Deleted record from angular user chat component", response);
            this.showNotification('Message was successfully deleted', 'success');
          },
          error: (error) => {
            console.log("Error in deleting record", error);
            this.showNotification('Failed to delete message. Please try again.', 'error');
          }
        })
      );
    }
  }

  loadUsers(): Promise<void> {
    this.isLoading = true;
    return new Promise<void>((resolve) => {
      this.userService.getUsers().subscribe({
        next: (users) => {
          this.users = users;
          this.isLoading = false;
          resolve();
        },
        error: (err) => {
          console.error('Error loading users:', err);
          this.isLoading = false;
          this.users = [];
          resolve();
        }
      });
    });
  }

  selectUser(userId: string): void {
    this.isLoading = true;
    // Clear current selection
    this.selectedUser = undefined;
    this.messages = [];
    this.newMessage = '';
    this.selectedFile = null;

    // Get user data and load chat history
    this.userService.getUserById(userId).subscribe({
      next: (user) => {
        this.selectedUser = user;
        // Store the user ID in the route for bookmarking/sharing
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { userId },
          queryParamsHandling: 'merge'
        });

        // Load chat history
        this.loadChatHistory(userId);

        // Mark messages as read when admin selects a user
        this.markMessagesAsRead(userId);
      },
      error: (err) => {
        console.error('Error loading user:', err);
        this.isLoading = false;
      }
    });
  }

  loadChatHistory(userId: string): void {
    this.isLoading = true;
    console.log('Loading chat history for user ID:', userId);
    this.userService.getChatHistory(userId).subscribe({
      next: (messages) => {
        console.log('Received messages from service:', messages);
        // Make sure messages have proper senderType
        if (messages && messages.length > 0) {
          this.messages = messages.map(msg => {
            if (!msg.senderType) {
              // If there's no senderType in the data, infer from position
              // Assuming odd messages are admin, even are user/bot
              // This is a fallback and should be removed once API provides senderType
              const index = messages.indexOf(msg);
              msg.senderType = index % 2 === 0 ? 'user' : 'bot';
            }
            return msg;
          });

          // Sort messages by timestamp, oldest first
          this.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        } else {
          // Add default welcome message if no messages exist
          this.messages = [
            {
              content: "Hello! How can I help you today?",
              timestamp: new Date(),
              senderType: 'bot'
            }
          ];
        }
        console.log('Final processed messages:', this.messages);
        this.isLoading = false;

        // Ensure we scroll to bottom after messages are loaded
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        console.error('Error loading chat history:', err);
        // Set default welcome message on error too
        this.messages = [
          {
            content: "Hello! There was an error loading your chat history, but you can start a new conversation.",
            timestamp: new Date(),
            senderType: 'bot'
          }
        ];
        this.isLoading = false;
      }
    });
  }

  // File upload methods
  onFileSelected(event: Event): void {
    const element = event.target as HTMLInputElement;
    if (element.files && element.files.length > 0) {
      const file = element.files[0];

      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit. Please select a smaller file.');
        element.value = '';
        return;
      }

      this.selectedFile = file;
      console.log('File selected:', this.selectedFile.name, 'Size:', this.selectedFile.size, 'Type:', this.selectedFile.type);
    }
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  sendMessage(): void {
    if ((!this.newMessage || this.newMessage.trim() === '') && !this.selectedFile) {
      return;
    }

    if (!this.selectedUser) {
      console.error('No user selected to send message to');
      return;
    }

    this.isLoading = true;

    if (this.selectedFile) {
      this.sendMessageWithFile();
    } else {
      this.sendMessageViaHttp();
    }
  }

  // Send message using HTTP API (for files or as fallback)
  private sendMessageViaHttp(): void {
    if (!this.selectedUser) return;

    // Send the request using the regular sendMessage method for text-only messages
    this.userService.sendMessage(this.selectedUser.id, this.newMessage).subscribe({
      next: (response) => {
        console.log('Message sent successfully:', response);
        this.handleMessageResponse(response);
      },
      error: (err) => {
        console.error('Error sending message:', err);
        this.handleMessageError(err);
      }
    });
  }

  private handleMessageResponse(response: any): void {
    console.log('Send message response:', response);
    console.log('Response structure:', {
      hasMessage: !!response.message,
      hasId: !!response._id,
      hasMessageId: !!(response.message && response.message._id),
      responseKeys: Object.keys(response || {}),
      messageKeys: response.message ? Object.keys(response.message) : []
    });

    // Clear input fields
    const sentMessage = this.newMessage;
    const sentFile = this.selectedFile;
    this.newMessage = '';
    this.selectedFile = null;
    this.isLoading = false;

    let newAdminMessage: ChatMessage;

    // Try different response formats to extract message data
    if (response && response.message && response.message._id) {
      // Format 1: response.message contains the full message with _id
      console.log('Using response.message format');
      newAdminMessage = {
        _id: response.message._id,
        content: response.message.content || sentMessage,
        timestamp: new Date(response.message.timestamp || Date.now()),
        senderType: 'admin',
        senderId: response.message.senderId || '3',
        isRead: response.message.isRead || false,
        file: response.fileData && sentFile ? {
          filename: sentFile.name,
          originalname: sentFile.name,
          mimetype: sentFile.type,
          size: sentFile.size,
          data: response.fileData
        } : response.message.file
      };
    } else if (response && response._id) {
      // Format 2: response itself contains the message data
      console.log('Using direct response format');
      newAdminMessage = {
        _id: response._id,
        content: response.content || sentMessage,
        timestamp: new Date(response.timestamp || Date.now()),
        senderType: 'admin',
        senderId: response.senderId || '3',
        isRead: response.isRead || false,
        file: response.fileData && sentFile ? {
          filename: sentFile.name,
          originalname: sentFile.name,
          mimetype: sentFile.type,
          size: sentFile.size,
          data: response.fileData
        } : response.file
      };
    } else if (response && response.success && response.data && response.data._id) {
      // Format 3: response.data contains the message
      console.log('Using response.data format');
      newAdminMessage = {
        _id: response.data._id,
        content: response.data.content || sentMessage,
        timestamp: new Date(response.data.timestamp || Date.now()),
        senderType: 'admin',
        senderId: response.data.senderId || '3',
        isRead: response.data.isRead || false,
        file: response.fileData && sentFile ? {
          filename: sentFile.name,
          originalname: sentFile.name,
          mimetype: sentFile.type,
          size: sentFile.size,
          data: response.fileData
        } : response.data.file
      };
    } else {
      // Fallback: create message without ID and try to get it from server
      console.warn('Server response missing message ID, creating local message and attempting to fetch ID');
      newAdminMessage = {
        content: sentMessage,
        timestamp: new Date(),
        senderType: 'admin',
        senderId: '3',
        file: response.fileData && sentFile ? {
          filename: sentFile.name,
          originalname: sentFile.name,
          mimetype: sentFile.type,
          size: sentFile.size,
          data: response.fileData
        } : undefined
      };

      // Try to get the message ID by refreshing chat history after a short delay
      setTimeout(() => {
        if (this.selectedUser) {
          this.attemptToGetMessageId(newAdminMessage);
        }
      }, 1000);
    }

    // Check if message already exists (avoid duplicates)
    const messageExists = newAdminMessage._id ?
      this.messages.some(msg => msg._id === newAdminMessage._id) :
      this.messages.some(msg =>
        msg.content === newAdminMessage.content &&
        msg.senderType === 'admin' &&
        Math.abs(new Date(msg.timestamp).getTime() - new Date(newAdminMessage.timestamp).getTime()) < 5000
      );

    if (!messageExists) {
      // Add it to the messages
      this.messages.push(newAdminMessage);

      // Sort messages by timestamp
      this.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Scroll to bottom with a tiny delay to ensure message is rendered
      setTimeout(() => this.scrollToBottom(), 100);

      // Update the selected user's last message
      if (this.selectedUser) {
        this.selectedUser.lastMessage = newAdminMessage;
      }
    }

    // Refresh users list to update the order
    this.refreshUsersList();
  }

  // Attempt to get message ID from server by matching content and timestamp
  private attemptToGetMessageId(message: ChatMessage): void {
    if (!this.selectedUser || message._id) return;

    console.log('Attempting to get message ID for:', message.content);

    this.userService.getChatHistory(this.selectedUser.id).subscribe({
      next: (serverMessages) => {
        // Find the matching message on the server
        const matchingMessage = serverMessages.find(serverMsg =>
          serverMsg.content === message.content &&
          serverMsg.senderType === 'admin' &&
          Math.abs(new Date(serverMsg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 10000 // 10 second tolerance
        );

        if (matchingMessage && matchingMessage._id) {
          // Update the local message with the server ID
          message._id = matchingMessage._id;
          message.senderId = matchingMessage.senderId;
          message.isRead = matchingMessage.isRead;
          console.log('Successfully found message ID:', matchingMessage._id);

          // Trigger change detection to update the UI
          this.changeDetectorRef.detectChanges();
        } else {
          console.warn('Could not find matching message on server for:', message.content);
        }
      },
      error: (err) => {
        console.error('Error fetching chat history for ID matching:', err);
      }
    });
  }

  // Handle error with a more user-friendly approach
  private handleMessageError(err: any): void {
    console.error('Error sending message:', err);

    // Show error feedback based on error type
    let errorMessage = 'Failed to send message';

    if (err.status === 413) {
      errorMessage = 'The file is too large to upload';
    } else if (err.status === 415) {
      errorMessage = 'This file type is not supported';
    } else if (err.status === 400) {
      errorMessage = 'Invalid request: ' + (err.error?.message || 'Please check your message');
    } else if (err.status === 0) {
      errorMessage = 'Server connection lost. Please check your internet connection';
    }

    // You could display this message to user with a toast or alert
    // For now we'll just alert it
    alert(errorMessage);

    // Still add the admin message even if the API call fails, but mark it as failed
    this.messages.push({
      content: this.newMessage || 'File upload',
      timestamp: new Date(),
      senderType: 'admin' as 'admin',
      error: errorMessage,
      file: this.selectedFile ? {
        filename: this.selectedFile.name,
        originalname: this.selectedFile.name,
        mimetype: this.selectedFile.type,
        size: this.selectedFile.size,
        data: ''
      } : undefined
    });

    this.newMessage = '';
    this.selectedFile = null;
    this.isLoading = false;

    // Scroll to bottom even if there was an error
    setTimeout(() => this.scrollToBottom(), 100);
  }

  // Refresh users list to update order
  refreshUsersList(): void {
    // Keep track of currently selected user
    const currentSelectedUserId = this.selectedUser?.id;

    this.loadUsers().then(() => {
      // Restore selected user if it was set
      if (currentSelectedUserId) {
        this.selectedUser = this.users.find(u => u.id === currentSelectedUserId);
      }
    });
  }

  // Helper to determine if a message is from today
  isMessageFromToday(timestamp: Date): boolean {
    if (!timestamp) return false;

    const today = new Date();
    const messageDate = new Date(timestamp);

    return today.getDate() === messageDate.getDate() &&
           today.getMonth() === messageDate.getMonth() &&
           today.getFullYear() === messageDate.getFullYear();
  }

  // Group messages by date for rendering date separators
  getMessageGroups(): { date: string, messages: ChatMessage[] }[] {
    if (!this.messages || this.messages.length === 0) {
      return [];
    }

    const groups: { date: string, messages: ChatMessage[] }[] = [];
    let currentDate = '';
    let currentGroup: ChatMessage[] = [];

    // Sort messages by timestamp first
    const sortedMessages = [...this.messages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sortedMessages.forEach(message => {
      const messageDate = new Date(message.timestamp);
      const dateStr = messageDate.toDateString();

      if (dateStr !== currentDate) {
        // Start a new group when date changes
        if (currentGroup.length > 0) {
          groups.push({
            date: currentDate,
            messages: [...currentGroup]
          });
        }
        currentDate = dateStr;
        currentGroup = [message];
      } else {
        // Add to current group
        currentGroup.push(message);
      }
    });

    // Add the last group
    if (currentGroup.length > 0) {
      groups.push({
        date: currentDate,
        messages: [...currentGroup]
      });
    }

    return groups;
  }

  // Format date for display in chat
  formatMessageDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  }

  // Mark all messages from a user as read
  markMessagesAsRead(userId: string): void {
    // Call the REST API
    this.userService.markMessagesAsRead(userId).subscribe({
      next: (result) => {
        console.log('Messages marked as read:', result);

        // Update local messages to reflect read status
        this.messages.forEach(msg => {
          if (msg.senderType === 'user') {
            msg.isRead = true;
          }
        });

        // Update user in the list to remove unread count
        const userToUpdate = this.users.find(u => u.id === userId);
        if (userToUpdate) {
          userToUpdate.unreadCount = 0;
        }

        // Also send WebSocket update to notify other admin clients
        this.websocketService.markMessagesAsRead(userId);
      },
      error: (err) => {
        console.error('Error marking messages as read:', err);
      }
    });
  }

  // Mark a specific message as read
  markMessageAsRead(message: ChatMessage): void {
    if (!message._id || message.isRead) {
      return;
    }

    const messageId = message._id;

    // Call the REST API
    this.userService.markMessageAsRead(messageId).subscribe({
      next: (result) => {
        console.log('Message marked as read:', result);
        message.isRead = true;

        // Also send WebSocket update to notify other admin clients
        this.websocketService.markMessageAsRead(messageId);
      },
      error: (err) => {
        console.error('Error marking message as read:', err);
      }
    });
  }

  // Send message with file
  private sendMessageWithFile(): void {
    if (!this.selectedUser || !this.selectedFile) return;

    // Create FormData for the request
    const formData = new FormData();
    formData.append('userId', this.selectedUser.id);
    formData.append('message', this.newMessage || '');
    formData.append('adminId', '3'); // Should come from auth
    formData.append('file', this.selectedFile, this.selectedFile.name);

    // Send the request
    this.userService.sendMessageWithFile(this.selectedUser.id, formData).subscribe({
      next: (response) => {
        console.log('Message with file sent successfully:', response);
        this.handleMessageResponse(response);
      },
      error: (err) => {
        console.error('Error sending message with file:', err);
        this.handleMessageError(err);
      }
    });
  }

  // Get image source for display (synchronous for template)
  getDisplayImageSrc(file: any): string {
    if (!file || !file.data) {
      console.warn('No file or file data provided');
      return '';
    }

    const fileKey = `${file.originalname}_${file.data.substring(0, 50)}`;
    console.log('Getting display image src for:', file.originalname, 'MIME type:', file.mimetype);

    // Return cached version if available
    if (this.imageDisplaySources.has(fileKey)) {
      const cachedSrc = this.imageDisplaySources.get(fileKey)!;
      console.log('Returning cached image for:', file.originalname);
      return cachedSrc;
    }

    // For HEIC files, start conversion and return placeholder
    if (this.isHeicFile(file.mimetype, file.originalname)) {
      console.log('HEIC file detected, starting conversion:', file.originalname);
      this.convertAndCacheImage(file, fileKey);
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkNvbnZlcnRpbmcgSEVJQy4uLjwvdGV4dD48L3N2Zz4=';
    }

    // For regular images, ensure proper data URL format
    let imageData = file.data;
    if (!imageData.startsWith('data:')) {
      imageData = `data:${file.mimetype || 'image/jpeg'};base64,${imageData}`;
    }

    console.log('Regular image processed:', file.originalname);
    this.imageDisplaySources.set(fileKey, imageData);
    return imageData;
  }

  // Convert and cache image asynchronously
  private async convertAndCacheImage(file: any, fileKey: string): Promise<void> {
    try {
      console.log('Converting HEIC image:', file.originalname);
      const convertedSrc = await this.getImageSrc(file);
      this.imageDisplaySources.set(fileKey, convertedSrc);

      // Trigger change detection to update the image
      this.changeDetectorRef.detectChanges();
      console.log('HEIC conversion completed for:', file.originalname);
    } catch (error) {
      console.error('Error converting image:', error);
      // Set fallback image
      const fallbackSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yIGxvYWRpbmcgaW1hZ2U8L3RleHQ+PC9zdmc+';
      this.imageDisplaySources.set(fileKey, fallbackSrc);
      this.changeDetectorRef.detectChanges();
    }
  }

  // Handle image loading errors
  onImageError(event: any, file: any): void {
    console.error('Image failed to load:', file.originalname);
    const img = event.target;
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
  }

  // Manually sync message IDs for messages without IDs
  syncMessageIds(): void {
    if (!this.selectedUser) {
      this.showNotification('No user selected', 'error');
      return;
    }

    const messagesWithoutIds = this.messages.filter(msg => !msg._id);

    if (messagesWithoutIds.length === 0) {
      this.showNotification('All messages already have IDs', 'info');
      return;
    }

    console.log(`Syncing IDs for ${messagesWithoutIds.length} messages`);
    this.showNotification(`Syncing IDs for ${messagesWithoutIds.length} messages...`, 'info');

    // Get fresh chat history from server
    this.userService.getChatHistory(this.selectedUser.id).subscribe({
      next: (serverMessages) => {
        let syncedCount = 0;

        messagesWithoutIds.forEach(localMsg => {
          const matchingServerMsg = serverMessages.find(serverMsg =>
            serverMsg.content === localMsg.content &&
            serverMsg.senderType === localMsg.senderType &&
            Math.abs(new Date(serverMsg.timestamp).getTime() - new Date(localMsg.timestamp).getTime()) < 15000 // 15 second tolerance
          );

          if (matchingServerMsg && matchingServerMsg._id) {
            localMsg._id = matchingServerMsg._id;
            localMsg.senderId = matchingServerMsg.senderId;
            localMsg.isRead = matchingServerMsg.isRead;
            syncedCount++;
            console.log('Synced message ID:', matchingServerMsg._id, 'for content:', localMsg.content.substring(0, 30));
          }
        });

        if (syncedCount > 0) {
          this.showNotification(`Successfully synced ${syncedCount} message IDs`, 'success');
          this.changeDetectorRef.detectChanges();
        } else {
          this.showNotification('Could not sync any message IDs', 'error');
        }
      },
      error: (err) => {
        console.error('Error syncing message IDs:', err);
        this.showNotification('Error syncing message IDs', 'error');
      }
    });
  }

  // Debug method for troubleshooting message IDs
  debugMessageIds(): void {
    console.log('=== MESSAGE ID DEBUG INFO ===');
    console.log('Total messages:', this.messages.length);

    this.messages.forEach((message, index) => {
      console.log(`Message ${index}:`, {
        hasId: !!message._id,
        id: message._id,
        content: message.content?.substring(0, 30) + '...',
        senderType: message.senderType,
        senderId: message.senderId,
        timestamp: message.timestamp,
        isDeleted: message.isDeleted
      });
    });

    const messagesWithoutId = this.messages.filter(m => !m._id);
    console.log('Messages without ID:', messagesWithoutId.length);

    if (messagesWithoutId.length > 0) {
      console.log('Messages missing IDs:', messagesWithoutId);
      this.showNotification(`Found ${messagesWithoutId.length} messages without IDs. Check console for details.`, 'info');
    } else {
      this.showNotification('All messages have IDs!', 'success');
    }
  }

  // Debug method for troubleshooting (can be called from browser console)
  debugImageIssues(): void {
    console.log('=== IMAGE DEBUG INFO ===');
    console.log('Messages with files:', this.messages.filter(m => m.file));
    console.log('Image display sources cache:', this.imageDisplaySources);
    console.log('Converted images cache:', this.convertedImages);

    // Test each message file
    this.messages.forEach((message, index) => {
      if (message.file) {
        console.log(`Message ${index}:`, {
          messageId: message._id,
          filename: message.file.originalname,
          mimetype: message.file.mimetype,
          isImage: this.isImageFile(message.file),
          isHeic: this.isHeicFile(message.file.mimetype, message.file.originalname),
          dataLength: message.file.data?.length || 0,
          dataStart: message.file.data?.substring(0, 50) || 'No data'
        });
      }
    });

    console.log('=== ALL MESSAGES DEBUG ===');
    this.messages.forEach((message, index) => {
      console.log(`Message ${index}:`, {
        id: message._id,
        content: message.content?.substring(0, 50) + '...',
        senderType: message.senderType,
        hasFile: !!message.file,
        isDeleted: message.isDeleted
      });
    });
  }

  // Test API connectivity and delete endpoint
  testDeleteAPI(): void {
    console.log('=== API DELETE TEST ===');

    // Find a message to test with
    const testMessage = this.messages.find(m => m._id && m.senderType === 'admin');
    if (!testMessage) {
      console.log('No admin messages found to test delete with');
      return;
    }

    console.log('Testing delete with message:', testMessage._id);
    console.log('API URL:', 'https://api.urbanwealthcapitals.com/api');
    console.log('Full delete URL:', `https://api.urbanwealthcapitals.com/api/chat/message/${testMessage._id}`);

    // Test if we can reach the API
    this.userService.getUsers().subscribe({
      next: (users) => {
        console.log('✅ API is reachable - getUsers() works');
        console.log('Users count:', users.length);
      },
      error: (error) => {
        console.error('❌ API is not reachable - getUsers() failed:', error);
      }
    });
  }

  // Bulk delete all messages for current user
  deleteAllUserMessages(): void {
    if (!this.selectedUser) {
      this.showNotification('No user selected', 'error');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ALL messages for user "${this.selectedUser.name}"? This action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.userService.deleteAllUserMessages(this.selectedUser.id).subscribe({
        next: (response) => {
          console.log('All user messages deleted successfully:', response);

          // Clear messages from UI
          this.messages = [];

          // Update user's last message
          if (this.selectedUser) {
            this.selectedUser.lastMessage = undefined;
            this.selectedUser.unreadCount = 0;
          }

          this.showNotification(`All messages deleted for user ${this.selectedUser?.name}`, 'success');
          this.refreshUsersList();
        },
        error: (error) => {
          console.error('Error deleting all user messages:', error);
          this.showNotification('Failed to delete messages. Please try again.', 'error');
        }
      });
    }
  }

  // Bulk delete all messages for all users (Admin only)
  deleteAllMessages(): void {
    const confirmMessage = 'Are you sure you want to delete ALL messages for ALL users? This action cannot be undone and will clear the entire chat history.';

    if (confirm(confirmMessage)) {
      this.userService.deleteAllMessages().subscribe({
        next: (response) => {
          console.log('All messages deleted successfully:', response);

          // Clear all messages from UI
          this.messages = [];

          // Update all users' last messages
          this.users.forEach(user => {
            user.lastMessage = undefined;
            user.unreadCount = 0;
          });

          this.showNotification('All messages deleted successfully', 'success');
          this.refreshUsersList();
        },
        error: (error) => {
          console.error('Error deleting all messages:', error);
          this.showNotification('Failed to delete all messages. Please try again.', 'error');
        }
      });
    }
  }

  // Refresh chat history to ensure all messages have proper IDs
  refreshChatHistory(): void {
    if (!this.selectedUser) {
      console.warn('No user selected for chat history refresh');
      return;
    }

    console.log('Refreshing chat history for user:', this.selectedUser.id);
    this.loadChatHistory(this.selectedUser.id);
  }

  // Enhanced method to handle messages without IDs
  handleMessageWithoutId(message: ChatMessage): void {
    console.warn('Handling message without ID:', message);

    // Try to find the message in the server by content and timestamp
    if (this.selectedUser) {
      this.userService.getChatHistory(this.selectedUser.id).subscribe({
        next: (serverMessages) => {
          // Try to match the message by content and approximate timestamp
          const matchingMessage = serverMessages.find(serverMsg =>
            serverMsg.content === message.content &&
            serverMsg.senderType === message.senderType &&
            Math.abs(new Date(serverMsg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 10000 // 10 second tolerance
          );

          if (matchingMessage && matchingMessage._id) {
            // Update the local message with the server ID
            message._id = matchingMessage._id;
            message.senderId = matchingMessage.senderId;
            console.log('Successfully matched message with server ID:', matchingMessage._id);
          } else {
            console.warn('Could not find matching message on server');
          }
        },
        error: (err) => {
          console.error('Error fetching chat history for ID matching:', err);
        }
      });
    }
  }

  // Test method for debugging edit functionality
  testEditMode(): void {
    console.log('=== TESTING EDIT MODE ===');
    const adminMessage = this.messages.find(m => m.senderType === 'admin' && m._id);

    if (adminMessage) {
      console.log('Found admin message to test:', adminMessage._id);
      console.log('Current editing state:', this.editingMessageIds);
      console.log('Message isEditing:', adminMessage.isEditing);

      // Test setting edit mode directly
      adminMessage.isEditing = true;
      adminMessage.editContent = adminMessage.content;

      console.log('Edit mode set, triggering change detection...');
      this.changeDetectorRef.detectChanges();

      setTimeout(() => {
        console.log('Edit mode should be active now');
        console.log('Edit input should be visible in DOM');
      }, 100);

    } else {
      console.log('No admin messages with ID found for testing');
    }
  }

  // Alternative modal-based edit methods
  openEditModal(message: ChatMessage): void {
    console.log('Opening edit modal for message:', message._id);

    if (!message._id) {
      this.showNotification('Cannot edit message without ID', 'error');
      return;
    }

    this.editModal.isOpen = true;
    this.editModal.message = message;
    this.editModal.editContent = message.content;
  }

  closeEditModal(): void {
    console.log('Closing edit modal');
    this.editModal.isOpen = false;
    this.editModal.message = null;
    this.editModal.editContent = '';
  }

  saveModalEdit(): void {
    console.log('Saving modal edit');

    if (!this.editModal.message || !this.editModal.editContent.trim()) {
      this.showNotification('Message content cannot be empty', 'error');
      return;
    }

    const message = this.editModal.message;
    const originalContent = message.content;

    // Update the message content
    message.content = this.editModal.editContent.trim();

    // Close modal
    this.closeEditModal();

    // Call server API
    this.editMessageWithHistory(message, originalContent, 'Message edited by admin');
  }
}
