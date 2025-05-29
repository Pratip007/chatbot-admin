#!/bin/bash

# Production Deployment Script for Chatbot Admin
echo "🚀 Starting production deployment..."

# Check if we're in the right directory
if [ ! -f "angular.json" ]; then
    echo "❌ Error: angular.json not found. Please run this script from the chatbot-admin directory."
    exit 1
fi

# Install dependencies with legacy peer deps
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

# Build for production
echo "🔨 Building for production..."
npm run build:prod

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Production build completed successfully!"
    echo "📁 Build output is in: dist/admin/"
    echo ""
    echo "📋 Next steps:"
    echo "1. Upload the contents of 'dist/admin/' to your web server"
    echo "2. Configure your web server to serve index.html for all routes (SPA routing)"
    echo "3. Ensure your backend API is running at: https://api.urbanwealthcapitals.com"
    echo "4. Test the deployment by opening the admin interface in a browser"
    echo ""
    echo "🔍 To verify the build:"
    echo "- Check browser console for: 'UserService initialized with API URL: https://api.urbanwealthcapitals.com/api'"
else
    echo "❌ Production build failed!"
    exit 1
fi
