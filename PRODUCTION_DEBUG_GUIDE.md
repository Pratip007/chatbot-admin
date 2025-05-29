# Production "No Data" Issue - Debug Guide

## Problem
The chatbot admin interface shows no data (users, messages) in production, while it works fine in development.

## Root Cause Analysis
The issue was caused by **missing environment configuration** for production builds:

1. **Missing `environment.prod.ts` file** - Angular needs separate environment files for dev/prod
2. **No file replacement configuration** - Angular.json didn't specify which environment file to use for production
3. **Incorrect API URLs** - Production was using development API endpoints

## Fixes Applied

### 1. Environment Configuration Fixed ✅

**Created `src/environments/environment.prod.ts`:**
```typescript
export const environment = {
  production: true,
  API_URL: 'https://api.urbanwealthcapitals.com/api',
  SOCKET_URL: 'https://api.urbanwealthcapitals.com'
};
```

**Updated `src/environments/environment.ts` (for development):**
```typescript
export const environment = {
  production: false,
  API_URL: 'http://localhost:5000/api',
  SOCKET_URL: 'http://localhost:5000'
};
```

### 2. Angular Build Configuration Fixed ✅

**Added file replacements in `angular.json`:**
```json
"production": {
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }
  ]
}
```

### 3. Enhanced Debugging ✅

**Added comprehensive logging to UserService:**
- API URL logging on initialization
- Detailed error logging for API calls
- Response logging for troubleshooting

**Added Test API Connection button:**
- Click "Test API" button in the chat interface
- Check browser console for detailed connection logs

## Deployment Steps

### 1. Build for Production
```bash
cd chatbot-admin
npm run build
```

### 2. Deploy the `dist/admin` folder to your hosting platform

### 3. Verify Environment
After deployment, open browser console and check:
- UserService initialization logs
- API URL being used
- Any error messages

## Troubleshooting

### Check Browser Console
1. Open Developer Tools (F12)
2. Go to Console tab
3. Look for these logs:
   - `UserService initialized with API URL: https://api.urbanwealthcapitals.com/api`
   - `Environment: {production: true, ...}`
   - `Fetching users from: https://api.urbanwealthcapitals.com/api/users`

### Test API Connection
1. Click the "Test API" button in the chat interface
2. Check console for connection results
3. Look for success/error notifications

### Common Issues & Solutions

#### Issue: CORS Errors
**Symptoms:** Console shows CORS policy errors
**Solution:** Ensure your backend server includes the admin domain in CORS origins:
```javascript
// In your backend server.js
app.use(cors({
  origin: ['https://adminchat.urbanwealthcapitals.com', 'https://chat.urbanwealthcapitals.com'],
  credentials: true
}));
```

#### Issue: 404 Not Found
**Symptoms:** API calls return 404 errors
**Solution:** 
1. Verify backend server is running
2. Check API endpoints exist
3. Verify API URL format (with/without trailing slashes)

#### Issue: Network Errors
**Symptoms:** Console shows network connection failures
**Solution:**
1. Check if backend server is accessible
2. Test API directly: `https://api.urbanwealthcapitals.com/api/users`
3. Verify SSL certificates are valid

#### Issue: Empty Response
**Symptoms:** API returns 200 but empty array
**Solution:**
1. Check if database has data
2. Verify backend API logic
3. Check database connection

## Testing Checklist

- [ ] Build completes without errors
- [ ] Console shows correct API URL in production
- [ ] "Test API" button works and shows success
- [ ] Users list loads properly
- [ ] Chat messages load when selecting a user
- [ ] WebSocket connection establishes successfully

## Environment Variables (if using hosting platforms)

For platforms like Vercel, Netlify, etc., you might need to set:
```
NODE_ENV=production
```

## Backend Requirements

Ensure your backend API supports:
- `/api/users` - Get all users
- `/api/chat/history/{userId}` - Get chat history
- `/api/chat/unread-counts` - Get unread message counts
- CORS headers for your admin domain
- Proper error responses with status codes

## Contact & Support

If issues persist after following this guide:
1. Check browser console for specific error messages
2. Test API endpoints directly in browser/Postman
3. Verify backend server logs for incoming requests
4. Ensure database connectivity on backend

---

**Last Updated:** May 29, 2025
**Status:** ✅ Fixed - Environment configuration corrected 
