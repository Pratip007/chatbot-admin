import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { MessageService } from '../../services/message.service';
import { User } from '../../models/user.model';
import { Message } from '../../models/message.model';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './user-detail.component.html',
  styleUrls: ['./user-detail.component.css']
})
export class UserDetailComponent implements OnInit {
  userId: string = '';
  user?: User;
  messages: Message[] = [];
  newMessage: string = '';
  editingMessage: Message | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private messageService: MessageService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.userId = id;
        this.loadUser();
        this.loadMessages();
        this.markMessagesAsRead();
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  loadUser(): void {
    this.userService.getUserById(this.userId).subscribe(user => {
      this.user = user;
    });
  }

  loadMessages(): void {
    this.messageService.getMessagesByUserId(this.userId).subscribe(messages => {
      this.messages = messages;
    });
  }

  markMessagesAsRead(): void {
    this.messageService.markMessagesAsRead(this.userId).subscribe();
  }

  sendMessage(): void {
    if (!this.newMessage.trim()) return;

    const message: Omit<Message, 'id'> = {
      userId: this.userId,
      adminId: '3', // Assuming current admin id is 3
      content: this.newMessage.trim(),
      createdAt: new Date(),
      isUserMessage: false,
      status: 'read'
    };

    this.messageService.addMessage(message).subscribe(newMessage => {
      this.messages.push(newMessage);
      this.newMessage = '';
    });
  }

  startEditing(message: Message): void {
    this.editingMessage = { ...message };
  }

  cancelEditing(): void {
    this.editingMessage = null;
  }

  saveEdit(): void {
    if (this.editingMessage && this.editingMessage.content.trim()) {
      this.messageService.updateMessage(this.editingMessage.id, this.editingMessage.content)
        .subscribe(updatedMessage => {
          if (updatedMessage) {
            const index = this.messages.findIndex(m => m.id === updatedMessage.id);
            if (index !== -1) {
              this.messages[index] = updatedMessage;
            }
          }
          this.editingMessage = null;
        });
    }
  }

  deleteMessage(id: string): void {
    if (confirm('Are you sure you want to delete this message?')) {
      this.messageService.deleteMessage(id).subscribe(success => {
        if (success) {
          const index = this.messages.findIndex(m => m.id === id);
          if (index !== -1) {
            this.messages[index] = {
              ...this.messages[index],
              status: 'deleted'
            };
          }
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }
}
