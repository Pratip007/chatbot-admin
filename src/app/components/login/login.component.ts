import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  template: `
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <form (ngSubmit)="onSubmit()" class="bg-white p-8 rounded-lg shadow-md w-80">
        <h2 class="text-2xl font-bold mb-6 text-center text-gray-800">Admin Login</h2>

        <div class="mb-4">
          <input
            type="password"
            id="password"
            [(ngModel)]="password"
            name="password"
            required
            placeholder="Enter admin password"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autofocus
          >
        </div>

        <button
          type="submit"
          class="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200"
        >
          Login
        </button>

        <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p class="text-blue-800 text-xs">
            <strong>🔒 Session-based authentication:</strong> Your login will automatically expire when you close the browser for enhanced security.
          </p>
        </div>
      </form>
    </div>
  `,
  styles: [],
  standalone: true,
  imports: [FormsModule]
})
export class LoginComponent {
  password: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    this.authService.login(this.password).subscribe(success => {
      if (success) {
        this.router.navigate(['/chat']);
      } else {
        alert('Invalid credentials');
      }
    });
  }
}
