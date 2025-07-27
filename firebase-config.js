// Firebase SDK v9 modular imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js';

// Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);

// Initialize Analytics (optional)
let analytics;
try {
    analytics = getAnalytics(app);
} catch (error) {
    console.log('Analytics not available:', error);
}

export { analytics };

// Export the app instance
export default app;

