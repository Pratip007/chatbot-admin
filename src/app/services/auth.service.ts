import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CanActivateFn, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private isDashboardAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isDashboardAuthenticated$ = this.isDashboardAuthenticatedSubject.asObservable();

  // Session-based authentication flags (cleared on browser close)
  private sessionAuthenticated = false;
  private sessionDashboardAuthenticated = false;

  constructor(private router: Router) {
    // Check session storage for temporary tokens (cleared on browser close)
    const sessionToken = sessionStorage.getItem('session_auth');
    const dashSessionToken = sessionStorage.getItem('session_dash_auth');

    if (sessionToken === 'authenticated') {
      this.sessionAuthenticated = true;
      this.isAuthenticatedSubject.next(true);
    }

    if (dashSessionToken === 'authenticated') {
      this.sessionDashboardAuthenticated = true;
      this.isDashboardAuthenticatedSubject.next(true);
    }
  }

  login(password: string): Observable<boolean> {
    // In a real app, you would call an API endpoint here
    // For demo purposes, we'll simulate a successful login if the password is 'P@zz@#$007'
    const success = password === 'P@zz@#$007';
    if (success) {
      // Use session storage instead of localStorage (cleared on browser close)
      sessionStorage.setItem('session_auth', 'authenticated');
      this.sessionAuthenticated = true;
      this.isAuthenticatedSubject.next(true);
    }
    return new Observable(observer => {
      observer.next(success);
      observer.complete();
    });
  }

  loginDashboard(password: string): Observable<boolean> {
    // Dashboard-specific password
    const success = password === 'P@zz@#$007@master';
    if (success) {
      // Use session storage instead of localStorage (cleared on browser close)
      sessionStorage.setItem('session_dash_auth', 'authenticated');
      this.sessionDashboardAuthenticated = true;
      this.isDashboardAuthenticatedSubject.next(true);
    }
    return new Observable(observer => {
      observer.next(success);
      observer.complete();
    });
  }

  logout(): void {
    // Clear all session data
    sessionStorage.removeItem('session_auth');
    sessionStorage.removeItem('session_dash_auth');
    this.sessionAuthenticated = false;
    this.sessionDashboardAuthenticated = false;
    this.isAuthenticatedSubject.next(false);
    this.isDashboardAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }

  logoutDashboard(): void {
    // Only clear dashboard session
    sessionStorage.removeItem('session_dash_auth');
    this.sessionDashboardAuthenticated = false;
    this.isDashboardAuthenticatedSubject.next(false);
  }

  isDashboardAuthenticated(): boolean {
    return this.sessionDashboardAuthenticated && sessionStorage.getItem('session_dash_auth') === 'authenticated';
  }

  isSessionAuthenticated(): boolean {
    return this.sessionAuthenticated && sessionStorage.getItem('session_auth') === 'authenticated';
  }
}

export const authGuard: CanActivateFn = (route, state) => {
  const sessionToken = sessionStorage.getItem('session_auth');
  if (sessionToken === 'authenticated') {
    return true;
  } else {
    window.location.href = '/login';
    return false;
  }
};

export const dashboardGuard: CanActivateFn = (route, state) => {
  const sessionToken = sessionStorage.getItem('session_auth');
  const dashSessionToken = sessionStorage.getItem('session_dash_auth');

  if (sessionToken !== 'authenticated') {
    window.location.href = '/login';
    return false;
  }

  if (dashSessionToken !== 'authenticated') {
    // Redirect to dashboard login
    window.location.href = '/dashboard-login';
    return false;
  }

  return true;
};

