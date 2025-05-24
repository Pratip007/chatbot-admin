import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { ChatMessage } from '../models/chat-message.model';
import { environment } from '../../environments/environment';

// Using a more generic approach to avoid type issues
declare const io: any;

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: any;
  private messageSubject = new Subject<any>();
  private messageUpdatedSubject = new Subject<any>();
  private messageDeletedSubject = new Subject<any>();
  private messageReadSubject = new Subject<any>();

  constructor() {
    this.socket = io(environment.SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    // Listen for incoming messages
    this.socket.on('message', (message: any) => {
      console.log('WebSocket received message:', message);
      this.messageSubject.next(message);
    });

    // Listen for message updates
    this.socket.on('messageUpdated', (data: any) => {
      console.log('WebSocket received message update:', data);
      this.messageUpdatedSubject.next(data);
    });

    // Listen for message deletions
    this.socket.on('messageDeleted', (data: any) => {
      console.log('WebSocket received message deletion:', data);
      this.messageDeletedSubject.next(data);
    });

    // Listen for message read status updates
    this.socket.on('messageRead', (data: any) => {
      console.log('WebSocket received message read status update:', data);
      this.messageReadSubject.next(data);
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
    });
  }

  // Join room as admin or specific user
  joinRoom(userId?: string): void {
    this.socket.emit('join', {
      userId: userId,
      isAdmin: true
    });
  }

  // Get message updates
  getMessages(): Observable<any> {
    return this.messageSubject.asObservable();
  }

  // Get message update notifications
  getMessageUpdates(): Observable<any> {
    return this.messageUpdatedSubject.asObservable();
  }

  // Get message deletion notifications
  getMessageDeletions(): Observable<any> {
    return this.messageDeletedSubject.asObservable();
  }

  // Get message read status notifications
  getMessageReadUpdates(): Observable<any> {
    return this.messageReadSubject.asObservable();
  }

  // Send message through socket
  sendMessage(userId: string, message: string): void {
    this.socket.emit('sendMessage', {
      userId: userId,
      text: message,
      timestamp: new Date(),
      isAdmin: true,
      adminId: '3' // This should come from auth service in a real app
    });
  }

  // Mark messages as read through socket
  markMessagesAsRead(userId: string): void {
    this.socket.emit('markMessagesRead', {
      userId: userId,
      adminId: '3', // This should come from auth service
      timestamp: new Date()
    });
  }

  // Mark a specific message as read
  markMessageAsRead(messageId: string): void {
    this.socket.emit('markMessageRead', {
      messageId: messageId,
      adminId: '3', // This should come from auth service
      timestamp: new Date()
    });
  }

  // Disconnect WebSocket
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
