# Chatbot Admin Interface

A modern Angular-based admin interface for managing chatbot conversations, users, and messages.

## 🚀 Quick Start

### Development
```bash
npm install
npm start
```

### Production Deployment
```bash
# Windows
deploy.bat

# Linux/Mac
chmod +x deploy.sh && ./deploy.sh

# Manual
npm run build:prod
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
├── deploy.bat (Windows deployment)
├── deploy.sh (Linux/Mac deployment)
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

### Hosting Platforms
- **Netlify**: Use `public/_redirects` for SPA routing
- **Vercel**: Use `vercel.json` for configuration
- **Apache**: Use `.htaccess` for SPA routing
- **Nginx**: Configure try_files directive

### Quick Deploy
1. Run `npm run build:prod`
2. Upload `dist/admin` folder to your web server
3. Configure SPA routing (files provided)
4. Ensure backend API is accessible

## 🔍 Troubleshooting

### "No Data" in Production
1. Check browser console for API errors
2. Verify environment configuration
3. Test API connectivity: `https://api.urbanwealthcapitals.com/api/users`
4. Check CORS configuration on backend

### Common Issues
- **CORS Errors**: Configure backend for admin domain
- **404 on Refresh**: Configure web server for SPA routing
- **Build Failures**: Run `npm ci` to reinstall dependencies

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
- Angular 19
- TypeScript
- Tailwind CSS
- Socket.IO client
- Lazy-loaded dependencies
- Optimized bundle size (~112 KB initial)

## 📚 Documentation

- [Production Deployment Guide](PRODUCTION_DEPLOYMENT.md)
- [Debug Guide](PRODUCTION_DEBUG_GUIDE.md)

## 🔒 Security

- HTTPS required for production
- CORS configured for specific domains
- Security headers included
- XSS protection enabled

---

**Status**: ✅ Production Ready  
**Bundle Size**: 112 KB (initial load)  
**Last Updated**: May 29, 2025
