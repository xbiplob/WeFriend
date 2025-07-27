// Firebase Auth imports
import { 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

import { auth } from './firebase-config.js';
import { setUserPresence, removeUserPresence } from './database.js';

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Current user state
let currentUser = null;

// Auth state observer
export function initializeAuth() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            
            if (user) {
                console.log('User signed in:', user);
                
                // Set user presence as online
                await setUserPresence(user.uid, true);
                
                // Show main screen
                showMainScreen();
                
                // Update UI with user info
                updateUserUI(user);
                
                resolve(user);
            } else {
                console.log('User signed out');
                
                // Show login screen
                showLoginScreen();
                
                resolve(null);
            }
        });
    });
}

// Google Sign-In
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        console.log('Google sign-in successful:', user);
        
        // Store user data in database
        await storeUserData(user);
        
        return user;
    } catch (error) {
        console.error('Google sign-in error:', error);
        
        // Handle specific error codes
        if (error.code === 'auth/popup-closed-by-user') {
            alert('Sign-in was cancelled. Please try again.');
        } else if (error.code === 'auth/popup-blocked') {
            alert('Pop-up was blocked. Please allow pop-ups for this site and try again.');
        } else {
            alert('Sign-in failed. Please try again.');
        }
        
        throw error;
    }
}

// Sign Out
export async function signOutUser() {
    try {
        if (currentUser) {
            // Set user presence as offline before signing out
            await removeUserPresence(currentUser.uid);
        }
        
        await signOut(auth);
        console.log('User signed out successfully');
    } catch (error) {
        console.error('Sign-out error:', error);
        alert('Sign-out failed. Please try again.');
    }
}

// Store user data in database
async function storeUserData(user) {
    try {
        const { storeUserProfile } = await import('./database.js');
        
        const userData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: Date.now()
        };
        
        await storeUserProfile(userData);
        console.log('User data stored successfully');
    } catch (error) {
        console.error('Error storing user data:', error);
    }
}

// Update UI with user information
function updateUserUI(user) {
    // Update user avatars
    const userAvatars = document.querySelectorAll('#user-avatar, #menu-user-avatar, #post-user-avatar, #profile-avatar');
    userAvatars.forEach(avatar => {
        avatar.src = user.photoURL || '/images/default-avatar.png';
        avatar.alt = user.displayName || 'User Avatar';
    });
    
    // Update user name and email
    const userNameElements = document.querySelectorAll('#menu-user-name, #profile-display-name');
    userNameElements.forEach(element => {
        element.textContent = user.displayName || 'User';
    });
    
    const userEmailElements = document.querySelectorAll('#menu-user-email, #profile-email');
    userEmailElements.forEach(element => {
        element.textContent = user.email || '';
    });
}

// Show login screen
function showLoginScreen() {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
}

// Show main screen
function showMainScreen() {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-screen').classList.remove('hidden');
}

// Get current user
export function getCurrentUser() {
    return currentUser;
}

// Check if user is authenticated
export function isAuthenticated() {
    return currentUser !== null;
}

// Get user ID
export function getCurrentUserId() {
    return currentUser ? currentUser.uid : null;
}

// Get user display name
export function getCurrentUserDisplayName() {
    return currentUser ? currentUser.displayName : null;
}

// Get user email
export function getCurrentUserEmail() {
    return currentUser ? currentUser.email : null;
}

// Get user photo URL
export function getCurrentUserPhotoURL() {
    return currentUser ? currentUser.photoURL : null;
}

