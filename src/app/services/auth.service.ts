import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CanActivateFn, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(private router: Router) {
    // Check if user is already logged in (e.g., from localStorage)
    const token = localStorage.getItem('auth_token');
    if (token) {
      this.isAuthenticatedSubject.next(true);
    }
  }

  login(password: string): Observable<boolean> {
    // In a real app, you would call an API endpoint here
    // For demo purposes, we'll simulate a successful login if the password is 'P@zz@#$007'
    const success = password === 'P@zz@#$007';
    if (success) {
      localStorage.setItem('auth_token', 'dummy_token');
      this.isAuthenticatedSubject.next(true);
    }
    return new Observable(observer => {
      observer.next(success);
      observer.complete();
    });
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/login']);
  }
}

export const authGuard: CanActivateFn = (route, state) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    return true;
  } else {
    window.location.href = '/login';
    return false;
  }
};

