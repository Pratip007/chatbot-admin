# Chatbot Admin Interface

A modern Angular-based admin interface for managing chatbot conversations, users, and messages.

## 🚀 Quick Start

### Development
```bash
npm install --legacy-peer-deps
npm start
```

### Production Deployment
```bash
# Local build
npm run build:prod

# Vercel deployment (automatic)
git push origin main
```

## 📁 Project Structure

```
chatbot-admin/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   └── user-chat/
│   │   ├── models/
│   │   ├── services/
│   │   └── app.component.ts
│   └── environments/
│       ├── environment.ts (development)
│       └── environment.prod.ts (production)
├── dist/admin/ (production build)
├── .npmrc (dependency resolution)
├── vercel.json (Vercel config)
├── .htaccess (Apache config)
└── public/_redirects (Netlify config)
```

## 🔧 Environment Configuration

### Development
- API URL: `http://localhost:5000/api`
- Socket URL: `http://localhost:5000`

### Production
- API URL: `https://api.urbanwealthcapitals.com/api`
- Socket URL: `https://api.urbanwealthcapitals.com`

## 📋 Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm run build:prod` - Build for production (explicit)
- `npm run build:dev` - Build for development
- `npm run serve:prod` - Serve production build locally
- `npm run analyze` - Analyze bundle size
- `npm test` - Run tests

## 🌐 Deployment

### Vercel (Recommended)
1. Push to GitHub repository
2. Connect to Vercel
3. Automatic deployment with provided configuration
4. See [Vercel Deployment Guide](VERCEL_DEPLOYMENT.md) for details

### Other Platforms
- **Netlify**: Use `public/_redirects` for SPA routing
- **Apache**: Use `.htaccess` for SPA routing
- **Nginx**: Configure try_files directive

## 🔍 Troubleshooting

### Dependency Issues
If you encounter npm dependency conflicts:
```bash
npm install --legacy-peer-deps
```

### "No Data" in Production
1. Check browser console for API errors
2. Verify environment configuration
3. Test API connectivity: `https://api.urbanwealthcapitals.com/api/users`
4. Check CORS configuration on backend

### Common Issues
- **CORS Errors**: Configure backend for admin domain
- **404 on Refresh**: Configure web server for SPA routing
- **Build Failures**: Use `--legacy-peer-deps` flag

## 📊 Features

### ✅ Implemented
- Real-time chat interface
- User management
- Message editing with history
- File upload support (including HEIC)
- Bulk message operations
- WebSocket integration
- Production-ready build
- Environment-specific configuration

### 🔧 Technical Features
- Angular 19.2
- TypeScript
- Tailwind CSS
- Socket.IO client
- Lazy-loaded dependencies
- Optimized bundle size (~112 KB initial)

## 📚 Documentation

- [Vercel Deployment Guide](VERCEL_DEPLOYMENT.md)

## 🔒 Security

- HTTPS required for production
- CORS configured for specific domains
- Security headers included
- XSS protection enabled

## ✅ Recent Fixes

### Vercel Deployment Issue (Resolved)
- ✅ Fixed Angular version conflicts
- ✅ Added `.npmrc` for dependency resolution
- ✅ Updated build configuration
- ✅ Corrected environment file setup

---

**Status**: ✅ Production Ready  
**Bundle Size**: 112 KB (initial load)  
**Last Updated**: May 29, 2025
