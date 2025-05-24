import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { UserDetailComponent } from './components/user-detail/user-detail.component';
import { UserChatComponent } from './components/user-chat/user-chat.component';

export const routes: Routes = [
  { path: '', component: UserChatComponent },
  { path: 'dash', component: DashboardComponent },
  { path: 'users/:id', component: UserDetailComponent },
  // { path: 'chat', component: UserChatComponent },
  { path: '**', redirectTo: '' }
];
