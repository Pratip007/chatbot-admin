import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard-login',
  template: `
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div class="bg-white p-8 rounded-lg shadow-md w-96">
        <div class="text-center mb-6">
          <h2 class="text-2xl font-bold text-gray-800">Dashboard Access</h2>
          <p class="text-gray-600 mt-2">Enter dashboard password to continue</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
              Dashboard Password
            </label>
            <input
              type="password"
              id="password"
              [(ngModel)]="password"
              name="password"
              required
              placeholder="Enter dashboard password"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              [class.border-red-500]="showError"
              autofocus
            >
            <div *ngIf="showError" class="text-red-500 text-sm mt-1">
              Invalid dashboard password. Please try again.
            </div>
          </div>

          <button
            type="submit"
            class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
            [disabled]="isLoading"
          >
            <span *ngIf="!isLoading">Access Dashboard</span>
            <span *ngIf="isLoading" class="flex items-center justify-center">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </span>
          </button>
        </form>

        <div class="mt-6 text-center">
          <button
            (click)="goBack()"
            class="text-blue-600 hover:text-blue-800 text-sm underline"
          >
            ← Back to Chat
          </button>
        </div>

        <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p class="text-yellow-800 text-xs">
            <strong>🔒 Enhanced Security:</strong> Dashboard access requires a separate password and uses session-based authentication that expires when you close the browser.
          </p>
        </div>

        <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p class="text-blue-800 text-xs">
            <strong>💡 Note:</strong> No passwords are stored permanently - your session automatically clears for maximum security.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [],
  standalone: true,
  imports: [FormsModule, CommonModule]
})
export class DashboardLoginComponent {
  password: string = '';
  showError: boolean = false;
  isLoading: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    if (!this.password.trim()) {
      this.showError = true;
      return;
    }

    this.isLoading = true;
    this.showError = false;

    this.authService.loginDashboard(this.password).subscribe(success => {
      this.isLoading = false;
      if (success) {
        this.router.navigate(['/dash']);
      } else {
        this.showError = true;
        this.password = ''; // Clear password field
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/chat']);
  }
}
