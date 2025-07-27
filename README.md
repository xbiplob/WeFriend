# WeFriend - Social Media Platform

A modern social media platform built with Firebase backend and vanilla JavaScript, featuring real-time chat, friend requests, posts with likes and comments, and responsive design with dark/light mode.

## Features

- **Authentication**: Google Sign-In with Firebase Auth
- **User Profiles**: Custom usernames and profile management
- **Friend System**: Send/accept friend requests, real-time presence tracking
- **Real-time Chat**: One-on-one messaging between friends
- **Social Feed**: Create posts with text and images, like and comment
- **Notifications**: Real-time notifications for interactions
- **Responsive Design**: Mobile-friendly with dark/light mode toggle
- **Image Upload**: Firebase Storage integration for profile and post images

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6 modules)
- **Backend**: Firebase (Auth, Realtime Database, Storage, Analytics)
- **Hosting**: GitHub Pages
- **Design**: Responsive design with CSS Grid/Flexbox
- **Icons**: Font Awesome 6
- **Fonts**: Google Fonts (Inter)

## Firebase Configuration

The project is configured to use the following Firebase services:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyBBY8_NwdMSbt-0RLT3y8S4B0QRaB7i808",
    authDomain: "weffriend.firebaseapp.com",
    databaseURL: "https://weffriend-default-rtdb.firebaseio.com",
    projectId: "weffriend",
    storageBucket: "weffriend.firebasestorage.app",
    messagingSenderId: "143920532023",
    appId: "1:143920532023:web:2cedd49311829916094db2",
    measurementId: "G-W9JMB92BJJ"
};
```

## Project Structure

```
weffriend-social/
├── index.html              # Main HTML file
├── styles.css              # CSS styles with theme support
├── js/                     # JavaScript modules
│   ├── firebase-config.js  # Firebase initialization
│   ├── auth.js            # Authentication module
│   ├── database.js        # Database operations
│   ├── storage.js         # File upload handling
│   ├── friends.js         # Friend system
│   ├── chat.js           # Real-time messaging
│   ├── posts.js          # Posts and social features
│   ├── notifications.js  # Notifications system
│   └── app.js            # Main application logic
├── firebase-rules.json    # Realtime Database security rules
├── storage-rules.txt     # Storage security rules
└── README.md             # This file
```

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing "weffriend" project
3. Enable the following services:
   - **Authentication**: Enable Google Sign-In provider
   - **Realtime Database**: Create database in test mode
   - **Storage**: Create storage bucket
   - **Analytics**: (Optional) Enable for usage tracking

### 2. Configure Firebase Security Rules

#### Realtime Database Rules
Copy the contents of `firebase-rules.json` to your Firebase Realtime Database rules:

1. Go to Firebase Console → Realtime Database → Rules
2. Replace the rules with the content from `firebase-rules.json`
3. Publish the rules

#### Storage Rules
Copy the contents of `storage-rules.txt` to your Firebase Storage rules:

1. Go to Firebase Console → Storage → Rules
2. Replace the rules with the content from `storage-rules.txt`
3. Publish the rules

### 3. Google Sign-In Configuration

1. Go to Firebase Console → Authentication → Sign-in method
2. Enable Google provider
3. Add your domain to authorized domains:
   - `localhost` (for local development)
   - Your GitHub Pages domain (e.g., `username.github.io`)

### 4. Local Development

1. Clone or download the project files
2. Open `index.html` in a web browser or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```
3. Navigate to `http://localhost:8000`

### 5. GitHub Pages Deployment

#### Method 1: Direct Upload
1. Create a new GitHub repository
2. Upload all project files to the repository
3. Go to repository Settings → Pages
4. Select source: "Deploy from a branch"
5. Choose branch: "main" and folder: "/ (root)"
6. Save and wait for deployment

#### Method 2: Git Commands
```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit files
git commit -m "Initial commit: WeFriend social media platform"

# Add remote repository
git remote add origin https://github.com/yourusername/weffriend-social.git

# Push to GitHub
git push -u origin main

# Enable GitHub Pages in repository settings
```

### 6. Domain Configuration

After deployment, add your GitHub Pages domain to Firebase:

1. Go to Firebase Console → Authentication → Settings
2. Add your GitHub Pages domain to "Authorized domains"
3. Example: `yourusername.github.io`

## Usage Guide

### Getting Started
1. Visit the deployed website
2. Click "Sign in with Google" to authenticate
3. Set up your username in the Profile tab
4. Start connecting with friends!

### Adding Friends
1. Go to Friends tab
2. Click "Add Friend" button
3. Enter a friend's username
4. Send friend request
5. Friends can accept/reject requests

### Chatting
1. Go to Chat tab
2. Click on a friend from the chat list
3. Start messaging in real-time
4. Messages are only visible to participants

### Creating Posts
1. Go to Feed tab
2. Write your post content
3. Optionally add an image
4. Click "Post" to share
5. Friends can like and comment

### Notifications
1. Click the bell icon to view notifications
2. Get notified about:
   - Friend requests
   - New messages
   - Post likes and comments
3. Click "Clear All" to mark as read

## Security Features

- **Authentication**: Only authenticated users can access the platform
- **Data Privacy**: Users can only access their own data and friends' data
- **Message Security**: Chat messages are only readable by participants
- **File Upload**: Images are validated and size-limited (5MB max)
- **XSS Protection**: User input is sanitized and validated

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Optimizations

- **Lazy Loading**: Images and content load on demand
- **Real-time Updates**: Efficient Firebase listeners
- **Caching**: Browser caching for static assets
- **Image Compression**: Client-side image resizing
- **Modular Code**: ES6 modules for better loading

## Troubleshooting

### Common Issues

1. **Sign-in not working**
   - Check if domain is added to Firebase authorized domains
   - Verify Google Sign-In is enabled in Firebase Console

2. **Images not uploading**
   - Check Firebase Storage rules
   - Verify file size is under 5MB
   - Ensure file is a valid image format

3. **Real-time features not working**
   - Check Firebase Realtime Database rules
   - Verify internet connection
   - Check browser console for errors

4. **GitHub Pages not loading**
   - Ensure all files are in repository root
   - Check GitHub Pages settings
   - Wait for deployment to complete (can take a few minutes)

### Debug Mode
Open browser developer tools (F12) to see console logs and debug information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Firebase documentation
3. Check browser console for errors
4. Create an issue in the GitHub repository

## Future Enhancements

- [ ] Video calling integration
- [ ] Group chats
- [ ] Story features
- [ ] Advanced search
- [ ] Push notifications
- [ ] Mobile app (React Native)
- [ ] Admin dashboard
- [ ] Content moderation
- [ ] Multi-language support
- [ ] Advanced privacy settings

---

Built with ❤️ using Firebase and modern web technologies.

