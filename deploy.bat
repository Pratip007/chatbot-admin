@echo off
REM Production Deployment Script for Chatbot Admin (Windows)
echo 🚀 Starting production deployment...

REM Check if we're in the right directory
if not exist "angular.json" (
    echo ❌ Error: angular.json not found. Please run this script from the chatbot-admin directory.
    pause
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm ci

REM Build for production
echo 🔨 Building for production...
call npm run build:prod

REM Check if build was successful
if %errorlevel% equ 0 (
    echo ✅ Production build completed successfully!
    echo 📁 Build output is in: dist/admin/
    echo.
    echo 📋 Next steps:
    echo 1. Upload the contents of 'dist/admin/' to your web server
    echo 2. Configure your web server to serve index.html for all routes ^(SPA routing^)
    echo 3. Ensure your backend API is running at: https://api.urbanwealthcapitals.com
    echo 4. Test the deployment by opening the admin interface in a browser
    echo.
    echo 🔍 To verify the build:
    echo - Check browser console for: 'UserService initialized with API URL: https://api.urbanwealthcapitals.com/api'
    echo - Click 'Test API' button to verify connectivity
) else (
    echo ❌ Production build failed!
    pause
    exit /b 1
)

pause
