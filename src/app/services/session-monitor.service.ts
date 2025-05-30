import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SessionMonitorService {
  private lastActivity = new Date();
  private sessionWarningSubject = new BehaviorSubject<boolean>(false);
  public sessionWarning$ = this.sessionWarningSubject.asObservable();

  // Session timeout settings (in minutes)
  private readonly WARNING_TIME = 25; // Warn after 25 minutes of inactivity
  private readonly SESSION_TIMEOUT = 30; // Auto-logout after 30 minutes of inactivity

  constructor() {
    this.initializeActivityTracking();
    this.startSessionMonitoring();
  }

  private initializeActivityTracking(): void {
    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, () => {
        this.updateLastActivity();
      }, true);
    });
  }

  private updateLastActivity(): void {
    this.lastActivity = new Date();
    // Clear any existing warning when user is active
    this.sessionWarningSubject.next(false);
  }

  private startSessionMonitoring(): void {
    setInterval(() => {
      const now = new Date();
      const timeSinceLastActivity = (now.getTime() - this.lastActivity.getTime()) / (1000 * 60); // in minutes

      if (timeSinceLastActivity >= this.WARNING_TIME && timeSinceLastActivity < this.SESSION_TIMEOUT) {
        // Show warning
        this.sessionWarningSubject.next(true);
      } else if (timeSinceLastActivity >= this.SESSION_TIMEOUT) {
        // Auto-logout (clear session storage)
        this.clearSession();
      }
    }, 60000); // Check every minute
  }

  private clearSession(): void {
    sessionStorage.clear();
    window.location.href = '/login';
  }

  public extendSession(): void {
    this.updateLastActivity();
  }

  public getTimeUntilWarning(): number {
    const now = new Date();
    const timeSinceLastActivity = (now.getTime() - this.lastActivity.getTime()) / (1000 * 60);
    return Math.max(0, this.WARNING_TIME - timeSinceLastActivity);
  }

  public getTimeUntilTimeout(): number {
    const now = new Date();
    const timeSinceLastActivity = (now.getTime() - this.lastActivity.getTime()) / (1000 * 60);
    return Math.max(0, this.SESSION_TIMEOUT - timeSinceLastActivity);
  }
}
