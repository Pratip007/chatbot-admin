# Dashboard Password Protection

## Overview
The dashboard route (`/dash`) now has an additional layer of password protection beyond the general admin authentication. The system uses session-based authentication that automatically clears when the browser is closed.

## Authentication Flow

### 1. General Admin Login
- **Route**: `/login`
- **Password**: `P@zz@#$007`
- **Access**: Grants access to chat interface and user management

### 2. Dashboard-Specific Login
- **Route**: `/dashboard-login`
- **Password**: `P@zz@#$007@master`
- **Access**: Required specifically for dashboard access

## How It Works

1. **First Login**: Users must first authenticate with the general admin password (`P@zz@#$007`) at `/login`
2. **Dashboard Access**: When trying to access `/dash`, users are redirected to `/dashboard-login` if they haven't entered the dashboard password
3. **Dashboard Password**: Users must enter `P@zz@#$007@master` to access the dashboard
4. **Session Management**: Authentication is session-based and automatically clears when browser is closed (no persistent storage)

## Navigation

- **From Chat to Dashboard**: Click the "Dashboard" button in the chat header
- **From Dashboard to Chat**: Click the "Chat" button in the dashboard header
- **Dashboard Logout**: Click "Logout Dashboard" to revoke dashboard access (keeps general admin access)

## Security Features

- **Two-layer authentication**: General admin + dashboard-specific passwords
- **Session-based**: No persistent storage - authentication clears when browser closes
- **Automatic redirects**: Unauthorized access attempts redirect to appropriate login pages
- **Temporary session**: Authentication only lasts for the current browser session
- **Graceful fallback**: Dashboard logout redirects to chat interface

## Password Summary

| Access Level | Route | Password |
|-------------|-------|----------|
| General Admin | `/login` | `P@zz@#$007` |
| Dashboard | `/dashboard-login` | `P@zz@#$007@master` |

## Routes Protected

- `/chat` - General admin authentication required
- `/dash` - Both general admin AND dashboard authentication required
- `/users/:id` - General admin authentication required

## Implementation Details

- **Guards**: `authGuard` for general access, `dashboardGuard` for dashboard
- **Services**: `AuthService` handles both authentication levels
- **Components**: Separate login components for each authentication level
- **Storage**: Uses sessionStorage (cleared on browser close) instead of localStorage
- **Security**: No persistent password storage - authentication expires with browser session
