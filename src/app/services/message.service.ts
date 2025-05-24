import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Message } from '../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  // Mock data - replace with actual API calls
  private messages: Message[] = [];

  constructor() { }

  getMessages(): Observable<Message[]> {
    return of(this.messages);
  }

  getMessagesByUserId(userId: string): Observable<Message[]> {
    const userMessages = this.messages.filter(m => m.userId === userId);
    return of(userMessages);
  }

  addMessage(message: Omit<Message, 'id'>): Observable<Message> {
    const newMessage: Message = {
      ...message,
      id: (this.messages.length + 1).toString(),
      createdAt: new Date()
    };

    this.messages.push(newMessage);
    return of(newMessage);
  }

  updateMessage(id: string, content: string): Observable<Message | undefined> {
    const messageIndex = this.messages.findIndex(m => m.id === id);
    if (messageIndex !== -1) {
      this.messages[messageIndex] = {
        ...this.messages[messageIndex],
        content,
        updatedAt: new Date()
      };
      return of(this.messages[messageIndex]);
    }
    return of(undefined);
  }

  deleteMessage(id: string): Observable<boolean> {
    const messageIndex = this.messages.findIndex(m => m.id === id);
    if (messageIndex !== -1) {
      this.messages[messageIndex] = {
        ...this.messages[messageIndex],
        status: 'deleted'
      };
      return of(true);
    }
    return of(false);
  }

  markMessagesAsRead(userId: string): Observable<boolean> {
    this.messages.forEach((message, index) => {
      if (message.userId === userId && message.status === 'unread') {
        this.messages[index] = {
          ...message,
          status: 'read'
        };
      }
    });
    return of(true);
  }
}
