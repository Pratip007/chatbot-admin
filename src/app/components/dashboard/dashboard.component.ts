import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { MessageService } from '../../services/message.service';
import { User } from '../../models/user.model';
import { Message } from '../../models/message.model';
import { HttpClientModule } from '@angular/common/http';
import { ChatMessage } from '../../models/chat-message.model';

interface UserWithLastMessageTime extends User {
  lastMessageTime: Date;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  users: UserWithLastMessageTime[] = [];
  unreadMessages: {
    userId: string;
    content: string;
    createdAt: Date;
    status: string;
  }[] = [];
  totalUsers = 0;
  activeUsers = 0;
  inactiveUsers = 0;
  totalMessages = 0;
  isLoading = false;

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.userService.getUsersWithMessages().subscribe({
      next: (users: User[]) => {
        // For each user, find the most recent message timestamp
        const usersWithLastMessageTime: UserWithLastMessageTime[] = users.map((user: User) => {
          const messages = user.messages || [];
          let lastMessageTime = user.createdAt;

          if (messages.length > 0) {
            // Find the most recent message timestamp
            const timestamps = messages.map((msg: ChatMessage) => new Date(msg.timestamp));
            const mostRecentTime = new Date(Math.max(...timestamps.map((t: Date) => t.getTime())));
            lastMessageTime = mostRecentTime;
          }

          return {
            ...user,
            lastMessageTime
          };
        });

        // Sort users by most recent message timestamp in descending order
        this.users = usersWithLastMessageTime.sort((a: UserWithLastMessageTime, b: UserWithLastMessageTime) =>
          b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
        );

        this.totalUsers = users.length;
        this.activeUsers = users.length; // All users are considered active for now
        this.inactiveUsers = 0; // No inactive users for now
        this.totalMessages = users.reduce((total: number, user: User) => {
          return total + (user.messages?.length || 0);
        }, 0);

        // Get latest messages from users for unread messages section
        this.unreadMessages = [];
        this.users.forEach(user => {
          if (user.messages && user.messages.length > 0) {
            const latestMessage = user.messages[user.messages.length - 1];
            this.unreadMessages.push({
              userId: user.id,
              content: latestMessage.content,
              createdAt: latestMessage.timestamp,
              status: 'unread'
            });
          }
        });

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading users:', err);
        this.isLoading = false;
      }
    });
  }

  viewUserMessages(userId: string): void {
    // Navigate to chat interface with selected user ID
    this.router.navigate(['/chat'], {
      queryParams: { userId: userId }
    });
  }

  getUserAvatar(userId: string): string | undefined {
    return this.users.find(u => u.id === userId)?.avatar;
  }

  getUserName(userId: string): string {
    return this.users.find(u => u.id === userId)?.name || 'Unknown User';
  }

  getUserEmail(userId: string): string {
    return this.users.find(u => u.id === userId)?.email || 'No email';
  }

  getUserInitial(userId: string): string {
    const name = this.users.find(u => u.id === userId)?.name;
    return name ? name.charAt(0) : 'U';
  }

  deleteUser(user: UserWithLastMessageTime): void {
    const confirmMessage = `Are you sure you want to delete user "${user.name}"? This will permanently delete the user and all their messages. This action cannot be undone.`;

    if (confirm(confirmMessage)) {
      const adminId = 'admin499'; // This should come from auth service in production

      this.userService.deleteUser(user.id, adminId).subscribe({
        next: (response) => {
          console.log('User deleted successfully:', response);

          // Remove user from local array
          this.users = this.users.filter(u => u.id !== user.id);

          // Update stats
          this.totalUsers = this.users.length;
          this.activeUsers = this.users.length;
          this.totalMessages = this.users.reduce((total: number, user: User) => {
            return total + (user.messages?.length || 0);
          }, 0);

          // Remove from unread messages
          this.unreadMessages = this.unreadMessages.filter(msg => msg.userId !== user.id);

          // Show success notification
          this.showNotification(`User "${user.name}" has been deleted successfully`, 'success');
        },
        error: (error) => {
          console.error('Error deleting user:', error);
          const errorMessage = error.error?.error || error.message || 'Failed to delete user';
          this.showNotification(`Failed to delete user: ${errorMessage}`, 'error');
        }
      });
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 transform translate-x-full`;

    // Set colors based on type
    switch (type) {
      case 'success':
        notification.className += ' bg-green-500 text-white';
        break;
      case 'error':
        notification.className += ' bg-red-500 text-white';
        break;
      default:
        notification.className += ' bg-blue-500 text-white';
    }

    notification.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full');
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.classList.add('translate-x-full');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
}
