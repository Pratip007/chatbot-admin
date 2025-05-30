import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { UserDetailComponent } from './components/user-detail/user-detail.component';
import { UserChatComponent } from './components/user-chat/user-chat.component';
import { LoginComponent } from './components/login/login.component';
import { DashboardLoginComponent } from './components/login/dashboard-login.component';
import { authGuard, dashboardGuard } from './services/auth.service';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard-login', component: DashboardLoginComponent },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'chat', component: UserChatComponent, canActivate: [authGuard] },
  { path: 'dash', component: DashboardComponent, canActivate: [dashboardGuard] },
  { path: 'users/:id', component: UserDetailComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
