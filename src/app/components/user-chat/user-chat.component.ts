import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { WebsocketService } from '../../services/websocket.service';
import { User } from '../../models/user.model';
import { ChatMessage } from '../../models/chat-message.model';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

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

  constructor(
    private userService: UserService,
    private websocketService: WebsocketService,
    private route: ActivatedRoute,
    private router: Router
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
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.#_bus.unsubscribe();
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
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
          file: messageData.file,
          isRead: messageData.isRead || false
        };

        // Check if this message is for our currently selected user
        if (this.selectedUser && (messageData.userId === this.selectedUser.id || !messageData.userId)) {
          // Check if the message already exists (avoid duplicates)
          const exists = this.messages.some(msg => msg._id === newMessage._id);
          if (!exists) {
            this.messages.push(newMessage);

            // Sort messages by timestamp
            this.messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Scroll to bottom after receiving a new message
            setTimeout(() => this.scrollToBottom(), 100);

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

    // Handle message updates
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
    this.subscriptions.push(messageSub, updateSub, deleteSub, readSub);
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

  // Handle image preview in a larger modal
  openImagePreview(imageUrl: string, imageName: string): void {
    this.previewImage = {
      url: imageUrl,
      name: imageName
    };
  }

  // Close image preview
  closeImagePreview(): void {
    this.previewImage = null;
  }

  // Simple file icon helper to fix compile error
  getFileIcon(mimeType: string): string {
    return 'file';
  }

  // Helper to determine file display type
  getFileDisplayType(mimeType: string): string {
    if (!mimeType) return 'other';

    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'audio';
    } else if (mimeType === 'application/pdf') {
      return 'pdf';
    } else {
      return 'other';
    }
  }

  // Message editing methods
  startEditingMessage(message: ChatMessage): void {
    // Reset any other messages that might be in edit mode
    this.messages.forEach(m => {
      if (m !== message && m.isEditing) {
        m.isEditing = false;
      }
    });

    // Start editing this message
    message.isEditing = true;
    message.editContent = message.content;

    // Focus the input field after it renders
    setTimeout(() => {
      const editInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (editInput) {
        editInput.focus();
      }
    }, 0);
  }

  cancelMessageEdit(message: ChatMessage): void {
    message.isEditing = false;
    message.editContent = undefined;
  }

  saveMessageEdit(message: ChatMessage): void {
    if (!message.editContent?.trim()) {
      return;
    }

    // Update the message content
    message.content = message.editContent.trim();
    message.isEditing = false;

    // Update on server if needed
    this.updateMessageOnServer(message);
  }

  deleteMessage(message: ChatMessage): void {
    // Check if already deleting this message
    if (this.deletingMessageIds.has(message._id!)) {
        console.log('Delete already in progress for this message');
        return;
    }

    if (confirm('Are you sure you want to delete this message?')) {
        // Add message ID to tracking set
        this.deletingMessageIds.add(message._id!);

        // Call delete API once
        this.userService.deleteChatByUserIdAndId(message._id!)
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
                    // Remove from tracking
                    this.deletingMessageIds.delete(message._id!);
                    // Show error to user
                    this.showNotification('Failed to delete message. Please try again.', 'error');
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

    // Create FormData for the request
    const formData = new FormData();
    formData.append('userId', this.selectedUser.id);
    formData.append('message', this.newMessage);
    formData.append('adminId', '3'); // Should come from auth

    // Add file if selected
    if (this.selectedFile) {
      formData.append('file', this.selectedFile, this.selectedFile.name);
      console.log('Appending file to form data:', this.selectedFile.name);
    }

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

  private handleMessageResponse(response: any): void {
    console.log('Send message response:', response);

    // Clear input fields
    const sentMessage = this.newMessage;
    const sentFile = this.selectedFile;
    this.newMessage = '';
    this.selectedFile = null;
    this.isLoading = false;

    // Admin message should come back via WebSocket, but add it here as fallback
    // Add the admin message to our local array only if it wasn't added via WebSocket
    const messageExists = this.messages.some(msg =>
      msg.content === sentMessage &&
      Math.abs(new Date(msg.timestamp).getTime() - new Date().getTime()) < 3000 &&
      msg.senderType === 'admin'
    );

    if (!messageExists) {
      // Create a new message
      const newAdminMessage: ChatMessage = {
        content: sentMessage,
        timestamp: new Date(),
        senderType: 'admin',
        file: response.fileData && sentFile ? {
          filename: sentFile.name,
          originalname: sentFile.name,
          mimetype: sentFile.type,
          size: sentFile.size,
          data: response.fileData
        } : undefined
      };

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
}
