# NexusGrid PWA Setup Guide

## 🎉 Your app is now a Progressive Web App!

### What's been added:

#### 1. **Service Worker** (`public/service-worker.js`)
- Offline functionality with intelligent caching
- Network-first strategy for API calls
- Cache-first strategy for static assets
- Background sync support
- Push notification support

#### 2. **Web App Manifest** (`public/manifest.json`)
- Installable on mobile devices and desktop
- Custom app icons and splash screens
- Standalone display mode
- Theme colors and branding

#### 3. **PWA Registration** (`src/lib/pwa.ts`)
- Service worker registration
- Install prompt handling
- Update notifications
- Notification permissions

#### 4. **App Icons**
Standard PWA icons in multiple sizes (16x16 to 512x512)

---

## 🚀 Quick Start

### Generate Icons

**Option 1: Use the HTML Generator**
```bash
# Open in browser
open frontend/scripts/icon-generator.html
```
Then download each icon and place in `frontend/public/icons/`

**Option 2: Use Sharp (Automated)**
```bash
cd frontend
npm install sharp
node scripts/generate-icons.js
```

**Option 3: Online Tools**
- Visit https://realfavicongenerator.net/
- Upload `frontend/public/icons/icon.svg`
- Download and extract icons to `frontend/public/icons/`

### Required Icon Files
```
frontend/public/icons/
├── icon-16x16.png
├── icon-32x32.png
├── icon-72x72.png
├── icon-96x96.png
├── icon-128x128.png
├── icon-144x144.png
├── icon-152x152.png
├── icon-192x192.png
├── icon-384x384.png
└── icon-512x512.png
```

---

## 📱 Testing the PWA

### Development
```bash
npm run dev
```
Then visit http://localhost:5173

### Production Build
```bash
npm run build
npm run preview
```

### Testing Service Worker
1. Open Chrome DevTools
2. Go to **Application** tab
3. Check **Service Workers** section
4. Enable **Offline** mode to test offline functionality

### Testing Installation
1. Open in Chrome/Edge
2. Look for install icon in address bar
3. Click to install as desktop app
4. On mobile, tap "Add to Home Screen"

---

## 🔧 Configuration

### Update Cache Version
Edit `public/service-worker.js`:
```javascript
const CACHE_NAME = 'nexusgrid-v2'; // Increment version
```

### Customize App Manifest
Edit `public/manifest.json`:
```json
{
  "name": "Your Custom Name",
  "short_name": "Short Name",
  "theme_color": "#your-color",
  ...
}
```

### Disable PWA (Development)
Comment out in `src/main.tsx`:
```typescript
// registerServiceWorker();
// promptInstall();
```

---

## 📊 PWA Features

### ✅ Implemented
- [x] Service Worker registration
- [x] Offline page caching
- [x] API request caching
- [x] Install prompt
- [x] Update notifications
- [x] Push notification support
- [x] Background sync capability
- [x] App manifest
- [x] Multiple icon sizes
- [x] Splash screens

### 🔄 Optional Enhancements
- [ ] Advanced offline queue for failed requests
- [ ] Periodic background sync
- [ ] Push notification campaigns
- [ ] Share target API
- [ ] Badge API for notification counts
- [ ] Shortcuts in manifest

---

## 🎨 Customization

### Change App Colors
Update in `public/manifest.json`:
```json
{
  "theme_color": "#3b82f6",
  "background_color": "#0f172a"
}
```

### Add App Shortcuts
Add to `public/manifest.json`:
```json
{
  "shortcuts": [
    {
      "name": "Dashboard",
      "url": "/app/dashboard",
      "icons": [{ "src": "/icons/dashboard.png", "sizes": "192x192" }]
    }
  ]
}
```

---

## 🐛 Troubleshooting

### Service Worker Not Registering
1. Check browser console for errors
2. Ensure HTTPS or localhost
3. Clear browser cache
4. Hard refresh (Ctrl+Shift+R)

### Icons Not Showing
1. Verify files exist in `public/icons/`
2. Check file names match manifest
3. Clear service worker cache
4. Unregister and re-register

### App Not Installable
1. Manifest must be valid JSON
2. Must have 192x192 and 512x512 icons
3. Service worker must be registered
4. Must be served over HTTPS

### Update Not Showing
1. Increment cache version in service-worker.js
2. Clear application cache in DevTools
3. Unregister service worker
4. Hard refresh page

---

## 📚 Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Google PWA Checklist](https://web.dev/pwa-checklist/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

## 🔐 Security Notes

- Service workers require HTTPS in production
- localhost is allowed for development
- Be careful with caching sensitive data
- Always validate cached responses
- Consider cache expiration policies

---

## 📝 Maintenance

### Regular Tasks
1. Update cache version when deploying
2. Test offline functionality
3. Monitor service worker errors
4. Keep dependencies updated
5. Test on multiple devices/browsers

### Performance Monitoring
- Check cache sizes regularly
- Monitor service worker performance
- Analyze offline usage patterns
- Track install/uninstall rates

---

**Need help?** Check the main README or open an issue.
