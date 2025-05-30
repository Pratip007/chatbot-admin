import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'admin';

  constructor(
    public authService: AuthService,
    private router: Router
  ) {}

  get isAuthenticated(): boolean {
    return this.authService.isSessionAuthenticated();
  }

  isCurrentRoute(route: string): boolean {
    return this.router.url === route;
  }

  goToChat(): void {
    this.router.navigate(['/chat']);
  }

  goToDashboard(): void {
    this.router.navigate(['/dash']);
  }

  logout(): void {
    this.authService.logout();
  }
}
