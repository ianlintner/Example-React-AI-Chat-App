# AI Chat Mobile App - React Native

This is the React Native version of the AI Chat Application, migrated from the web version to provide native Android (and iOS) support for your users.

## 🚀 Features

- **Real-time AI Chat**: Full Socket.io integration with streaming responses
- **10 Specialized AI Agents**: Technical, Joke Master, Trivia Master, GIF Master, and customer service agents
- **RAG-Powered Entertainment**: Curated jokes, trivia, and GIFs during hold experiences
- **Professional Hold Management**: Complete customer service flow
- **Native Mobile UX**: Optimized for mobile with smooth animations and gestures
- **Offline Capability**: Graceful handling of network disconnections
- **Material Design**: Using React Native Paper for consistent UI

## 📱 Supported Platforms

- ✅ Android
- ✅ iOS (with macOS development environment)
- ✅ Web (via Expo web)

## 🛠 Prerequisites

- Node.js 18+
- npm or yarn
- Android Studio (for Android development)
- Xcode (for iOS development - macOS only)
- Expo CLI (optional but recommended)

## 🔧 Installation

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure backend connection:**

   The app is configured to connect to your existing backend. Update the server URL in `services/socketService.ts`:

   ```typescript
   const serverUrl = __DEV__
     ? 'http://10.0.2.2:5001' // Android emulator localhost
     : 'http://localhost:5001'; // Production URL
   ```

   **Important:**
   - For Android Emulator: Use `10.0.2.2:5001` (emulator's localhost)
   - For Physical Android Device: Use your computer's IP address (e.g., `192.168.1.100:5001`)
   - For iOS Simulator: Use `localhost:5001`
   - For Production: Use your deployed backend URL

## 🚀 Running the App

### Development

1. **Start your backend server first:**

   ```bash
   cd ../backend
   npm run dev
   ```

2. **Start the mobile app:**

   ```bash
   npm start
   ```

3. **Choose your platform:**
   - Press `a` for Android
   - Press `i` for iOS (macOS only)
   - Press `w` for web
   - Scan QR code with Expo Go app for physical device testing

### Android Development

1. **Using Android Studio:**

   ```bash
   npm run android
   ```

2. **Using Expo:**
   ```bash
   npx expo start --android
   ```

### iOS Development (macOS only)

1. **Using Xcode:**

   ```bash
   npm run ios
   ```

2. **Using Expo:**
   ```bash
   npx expo start --ios
   ```

## 🌐 Network Configuration

### For Development Testing

1. **Find your computer's IP address:**
   - Windows: `ipconfig`
   - macOS/Linux: `ifconfig`

2. **Update the backend URL** in `services/socketService.ts`:

   ```typescript
   const serverUrl = __DEV__
     ? 'http://YOUR_IP_ADDRESS:5001' // Replace with your IP
     : 'http://localhost:5001';
   ```

3. **Ensure your backend allows connections** from your mobile device's IP.

## 📦 Key Components

### Core Components

- **`App.tsx`**: Main application component with Socket.io integration
- **`ChatScreen.tsx`**: Mobile-optimized chat interface with message bubbles
- **`MessageInput.tsx`**: Mobile keyboard-friendly input component
- **`socketService.ts`**: Socket.io service adapted for mobile

### Features Migrated

- ✅ Real-time messaging with streaming responses
- ✅ All 10 AI agents with visual indicators
- ✅ Agent confidence scores and proactive messages
- ✅ Markdown rendering for AI responses
- ✅ Connection status indicators
- ✅ Mobile-optimized animations and UX
- ✅ Automatic reconnection handling
- ✅ App state management (background/foreground)

## 🎨 UI/UX Improvements for Mobile

- **Native Feel**: Uses React Native Paper for Material Design
- **Smooth Animations**: Pulsing effects for streaming messages
- **Mobile Keyboard**: Optimized input handling with KeyboardAvoidingView
- **Touch Interactions**: Proper touch targets and feedback
- **Responsive Design**: Adapts to different screen sizes
- **Loading States**: Native activity indicators

## 🔧 Configuration

### Environment Variables

Create a `.env` file for environment-specific configuration:

```env
API_URL=http://10.0.2.2:5001
SOCKET_TIMEOUT=20000
ENABLE_LOGGING=true
```

### Build Configuration

The app uses Expo's default configuration. For custom native modules, you may need to eject:

```bash
npx expo eject
```

## 🧪 Testing

### Testing on Physical Devices

1. **Install Expo Go** on your Android/iOS device
2. **Connect to same WiFi** as your development machine
3. **Scan QR code** from `npm start` output
4. **Update backend URL** to use your computer's IP address

### Testing Different Scenarios

- **Network Loss**: Test airplane mode and reconnection
- **Background/Foreground**: Test app state transitions
- **Different Agents**: Test all 10 AI agents work properly
- **Streaming**: Verify real-time message streaming works
- **Hold Experience**: Test the full customer service flow

## 🚀 Production Deployment

### Building for Production

1. **Android APK/AAB:**

   ```bash
   npx expo build:android
   ```

2. **iOS IPA:**
   ```bash
   npx expo build:ios
   ```

### Store Deployment

1. **Google Play Store**: Upload APK/AAB through Google Play Console
2. **Apple App Store**: Upload IPA through App Store Connect

## 🔄 Backend Compatibility

This mobile app is **100% compatible** with your existing backend:

- ✅ Same Socket.io events and protocols
- ✅ All 10 agents work identically
- ✅ RAG system fully functional
- ✅ Hold management system works
- ✅ Proactive messages supported
- ✅ No backend changes required

## 📊 Performance Optimizations

- **Efficient Re-renders**: Optimized React state management
- **Memory Management**: Proper cleanup of Socket.io listeners
- **Image Optimization**: Lazy loading for GIF content
- **Network Efficiency**: Minimal data usage with streaming

## 🐛 Troubleshooting

### Common Issues

1. **"Network request failed":**
   - Check backend URL in `socketService.ts`
   - Ensure backend is running
   - Verify network connectivity

2. **"Unable to connect to server":**
   - Use correct IP address for physical devices
   - Check firewall settings
   - Ensure backend allows cross-origin requests

3. **App crashes on Android:**
   - Check Metro bundler logs
   - Verify all dependencies are installed
   - Clear cache: `npx expo start -c`

### Debug Mode

Enable debug logging in `socketService.ts`:

```typescript
const DEBUG = __DEV__;
if (DEBUG) {
  console.log('Socket event:', eventName, data);
}
```

## 🤝 Contributing

1. Follow the same coding standards as the web version
2. Test on both Android and iOS if possible
3. Ensure backward compatibility with existing backend
4. Update documentation for any new features

## 📄 License

Same license as the main AI Chat Application project.

## 🆘 Support

- **Web Version Issues**: See main project documentation
- **Mobile-Specific Issues**: Check React Native and Expo documentation
- **Backend Issues**: Refer to backend documentation in `../backend/`

---

## 🎯 Migration Status

### ✅ Completed

- Core chat functionality
- Socket.io integration
- All 10 AI agents
- Mobile-optimized UI
- Real-time streaming
- Connection management
- Error handling

### 🔄 Future Enhancements

- Push notifications
- Dark theme support
- Voice message support
- File attachment support
- Conversation history persistence
- Advanced gesture controls

This mobile app provides the complete AI Chat experience optimized for Android users while maintaining full compatibility with your existing sophisticated backend system.
