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

  // Delete a specific user
  deleteUser(userId: string): void {
    const user = this.users.find(u => u.id === userId);
    const userName = user?.name || 'Unknown User';

    // First confirmation
    if (!confirm(`Are you sure you want to delete user "${userName}"?\n\nThis action cannot be undone and will delete all their messages.`)) {
      return;
    }

    // Prompt for admin ID
    const adminId = prompt('Please enter your Admin ID to confirm this action:');
    if (!adminId || adminId.trim() === '') {
      alert('Admin ID is required to delete users.');
      return;
    }

    // Final confirmation with admin ID
    if (!confirm(`Confirm deletion of user "${userName}" with Admin ID: ${adminId}?\n\nThis action is irreversible!`)) {
      return;
    }

    // Perform deletion
    this.userService.deleteUser(userId, adminId.trim()).subscribe({
      next: (response) => {
        console.log('User deleted successfully:', response);
        alert(`User "${userName}" has been deleted successfully.`);

        // Remove user from local array
        this.users = this.users.filter(u => u.id !== userId);
        this.totalUsers = this.users.length;

        // Update stats
        this.updateStats();
      },
      error: (error) => {
        console.error('Error deleting user:', error);
        let errorMessage = 'Failed to delete user.';

        if (error.status === 404) {
          errorMessage = 'User not found.';
        } else if (error.status === 400) {
          errorMessage = 'Invalid request. Please check your Admin ID.';
        } else if (error.error?.error) {
          errorMessage = error.error.error;
        }

        alert(`Error: ${errorMessage}`);
      }
    });
  }

  // Delete all users
  deleteAllUsers(): void {
    if (this.users.length === 0) {
      alert('No users to delete.');
      return;
    }

    // First warning
    if (!confirm(`⚠️ DANGER: Delete ALL ${this.users.length} users?\n\nThis will permanently delete:\n- All user accounts\n- All chat messages\n- All user data\n\nThis action CANNOT be undone!`)) {
      return;
    }

    // Prompt for admin ID
    const adminId = prompt('Please enter your Admin ID to confirm this DANGEROUS action:');
    if (!adminId || adminId.trim() === '') {
      alert('Admin ID is required to delete all users.');
      return;
    }

    // Prompt for confirmation code
    const confirmationCode = prompt('Type "DELETE_ALL_USERS_CONFIRMED" to proceed with deleting ALL users:');
    if (confirmationCode !== 'DELETE_ALL_USERS_CONFIRMED') {
      alert('Invalid confirmation code. Operation cancelled.');
      return;
    }

    // Final confirmation
    if (!confirm(`FINAL CONFIRMATION:\n\nDelete ALL ${this.users.length} users with Admin ID: ${adminId}?\n\nTHIS CANNOT BE UNDONE!`)) {
      return;
    }

    // Perform deletion
    this.userService.deleteAllUsers(adminId.trim(), confirmationCode).subscribe({
      next: (response) => {
        console.log('All users deleted successfully:', response);
        alert(`All ${response.deletedCount || this.users.length} users have been deleted successfully.`);

        // Clear local data
        this.users = [];
        this.unreadMessages = [];
        this.totalUsers = 0;
        this.activeUsers = 0;
        this.inactiveUsers = 0;
        this.totalMessages = 0;
      },
      error: (error) => {
        console.error('Error deleting all users:', error);
        let errorMessage = 'Failed to delete all users.';

        if (error.status === 400) {
          errorMessage = 'Invalid request. Please check your Admin ID and confirmation code.';
        } else if (error.error?.error) {
          errorMessage = error.error.error;
        }

        alert(`Error: ${errorMessage}`);
      }
    });
  }

  // Update statistics after user deletion
  private updateStats(): void {
    this.totalUsers = this.users.length;
    this.activeUsers = this.users.length;
    this.inactiveUsers = 0;
    this.totalMessages = this.users.reduce((total: number, user: User) => {
      return total + (user.messages?.length || 0);
    }, 0);

    // Update unread messages
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
  }
}
