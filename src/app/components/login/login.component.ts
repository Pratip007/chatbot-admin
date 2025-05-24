import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  template: `
    <div class="flex flex-col items-center justify-center min-h-screen">
      <form (ngSubmit)="onSubmit()" class="bg-white p-8 rounded shadow-md w-80">
        <h2 class="text-2xl font-bold mb-6 text-center">Admin Login</h2>
        <div class="mb-4">
          <input type="password" id="password" [(ngModel)]="password" name="password" required placeholder="Enter password" class="w-full px-3 py-2 border rounded" autofocus>
        </div>
        <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Login</button>
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
