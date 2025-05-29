# 🚀 Production Deployment Guide

## ✅ Configuration Status
- **Environment Files**: ✅ Configured
- **Build Configuration**: ✅ Ready
- **Production Scripts**: ✅ Added
- **Web Server Configs**: ✅ Included
- **Deployment Scripts**: ✅ Created

## 📋 Quick Deployment

### Option 1: Windows (Recommended)
```bash
# Run the deployment script
deploy.bat
```

### Option 2: Linux/Mac
```bash
# Make script executable and run
chmod +x deploy.sh
./deploy.sh
```

### Option 3: Manual
```bash
# Install dependencies
npm ci

# Build for production
npm run build:prod

# Deploy the dist/admin folder
```

## 🌐 Hosting Platform Setup

### Netlify
1. Upload `dist/admin` folder
2. The `public/_redirects` file is already configured
3. Set build command: `npm run build:prod`
4. Set publish directory: `dist/admin`

### Vercel
1. Upload project or connect Git repository
2. The `vercel.json` file is already configured
3. Set build command: `npm run build:prod`
4. Set output directory: `dist/admin`

### Apache Server
1. Upload `dist/admin` contents to web root
2. The `.htaccess` file is already configured for SPA routing
3. Ensure mod_rewrite is enabled

### Nginx
Add this configuration to your nginx.conf:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist/admin;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1M;
        add_header Cache-Control "public, immutable";
    }
}
```

## 🔧 Environment Configuration

### Development Environment
- **API URL**: `http://localhost:5000/api`
- **Socket URL**: `http://localhost:5000`
- **File**: `src/environments/environment.ts`

### Production Environment
- **API URL**: `https://api.urbanwealthcapitals.com/api`
- **Socket URL**: `https://api.urbanwealthcapitals.com`
- **File**: `src/environments/environment.prod.ts`

## 🔍 Verification Steps

### 1. Check Build Output
After running `npm run build:prod`, verify:
- ✅ Build completes without errors
- ✅ `dist/admin` folder is created
- ✅ Files are properly minified and optimized

### 2. Test Production Build Locally
```bash
# Serve the production build locally
npx http-server dist/admin -p 8080 -c-1

# Open http://localhost:8080 in browser
```

### 3. Verify Environment in Browser
Open browser console and check for:
```
UserService initialized with API URL: https://api.urbanwealthcapitals.com/api
Environment: {production: true, API_URL: "https://api.urbanwealthcapitals.com/api", ...}
```

### 4. Test API Connectivity
1. Open the admin interface
2. Check browser console for API calls
3. Verify users load properly
4. Test sending/receiving messages

## 🐛 Troubleshooting

### Issue: "No users found"
**Cause**: API connection issues
**Solutions**:
1. Check browser console for error messages
2. Verify backend server is running
3. Test API directly: `https://api.urbanwealthcapitals.com/api/users`
4. Check CORS configuration on backend

### Issue: CORS Errors
**Cause**: Backend not configured for admin domain
**Solution**: Update backend CORS settings:
```javascript
app.use(cors({
  origin: [
    'https://your-admin-domain.com',
    'https://chat.urbanwealthcapitals.com'
  ],
  credentials: true
}));
```

### Issue: 404 on Page Refresh
**Cause**: Web server not configured for SPA routing
**Solutions**:
- **Netlify**: Use provided `_redirects` file
- **Vercel**: Use provided `vercel.json` file
- **Apache**: Use provided `.htaccess` file
- **Nginx**: Configure try_files directive

### Issue: Build Fails
**Common causes**:
1. Missing dependencies: Run `npm ci`
2. TypeScript errors: Check console output
3. Memory issues: Increase Node.js memory: `node --max-old-space-size=4096`

## 📊 Performance Optimization

### Bundle Analysis
```bash
# Analyze bundle size
npm run analyze
```

### Current Bundle Sizes
- **Initial Bundle**: ~112 KB (compressed)
- **HEIC Converter**: ~263 KB (lazy-loaded)
- **Total Initial Load**: ~112 KB

### Optimization Features
- ✅ Lazy loading for HEIC converter
- ✅ Tree shaking enabled
- ✅ Minification enabled
- ✅ Gzip compression ready
- ✅ Cache headers configured

## 🔒 Security Considerations

### Headers Configured
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

### HTTPS Requirements
- Backend API must use HTTPS in production
- Admin interface should be served over HTTPS
- WebSocket connections will use WSS automatically

## 📝 Deployment Checklist

- [ ] Backend API is running at `https://api.urbanwealthcapitals.com`
- [ ] CORS is configured for admin domain
- [ ] Database is accessible and has data
- [ ] SSL certificates are valid
- [ ] Web server is configured for SPA routing
- [ ] Build completes without errors
- [ ] Environment variables are correct
- [ ] API connectivity test passes
- [ ] Users and messages load properly
- [ ] WebSocket connection works
- [ ] File uploads work (if applicable)

## 🆘 Support

If you encounter issues:

1. **Check browser console** for error messages
2. **Test API endpoints** directly in browser/Postman
3. **Verify backend logs** for incoming requests
4. **Check network tab** in browser dev tools
5. **Review this guide** for common solutions

---

**Last Updated**: May 29, 2025  
**Build Status**: ✅ Ready for Production  
**Bundle Size**: 112 KB (initial load) 