// Firebase Database imports
import { 
    ref, 
    set, 
    get, 
    update, 
    push, 
    remove,
    onValue,
    off,
    onDisconnect,
    serverTimestamp,
    query,
    orderByChild,
    equalTo
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

import { database } from './firebase-config.js';

// Store user profile data
export async function storeUserProfile(userData) {
    try {
        const userRef = ref(database, `users/${userData.uid}`);
        
        // Get existing user data to preserve username if it exists
        const snapshot = await get(userRef);
        const existingData = snapshot.val();
        
        const profileData = {
            displayName: userData.displayName,
            email: userData.email,
            photoURL: userData.photoURL,
            lastLogin: userData.lastLogin,
            createdAt: existingData?.createdAt || Date.now(),
            // Preserve existing username if it exists
            username: existingData?.username || null
        };
        
        await set(userRef, profileData);
        console.log('User profile stored successfully');
        
        return profileData;
    } catch (error) {
        console.error('Error storing user profile:', error);
        throw error;
    }
}

// Get user profile by UID
export async function getUserProfile(uid) {
    try {
        const userRef = ref(database, `users/${uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            console.log('User profile not found');
            return null;
        }
    } catch (error) {
        console.error('Error getting user profile:', error);
        throw error;
    }
}

// Set username for user
export async function setUsername(uid, username) {
    try {
        // Check if username is already taken
        const isAvailable = await checkUsernameAvailability(username);
        
        if (!isAvailable) {
            throw new Error('Username is already taken');
        }
        
        // Update user profile with username
        const userRef = ref(database, `users/${uid}`);
        await update(userRef, {
            username: username,
            usernameSetAt: Date.now()
        });
        
        // Add username to usernames index for quick lookup
        const usernameRef = ref(database, `usernames/${username}`);
        await set(usernameRef, uid);
        
        console.log('Username set successfully:', username);
        return true;
    } catch (error) {
        console.error('Error setting username:', error);
        throw error;
    }
}

// Check username availability
export async function checkUsernameAvailability(username) {
    try {
        // Check if username exists in usernames index
        const usernameRef = ref(database, `usernames/${username}`);
        const snapshot = await get(usernameRef);
        
        return !snapshot.exists();
    } catch (error) {
        console.error('Error checking username availability:', error);
        return false;
    }
}

// Get user by username
export async function getUserByUsername(username) {
    try {
        // Get UID from username index
        const usernameRef = ref(database, `usernames/${username}`);
        const snapshot = await get(usernameRef);
        
        if (snapshot.exists()) {
            const uid = snapshot.val();
            return await getUserProfile(uid);
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error getting user by username:', error);
        throw error;
    }
}

// Set user presence (online/offline)
export async function setUserPresence(uid, isOnline) {
    try {
        const presenceRef = ref(database, `presence/${uid}`);
        
        if (isOnline) {
            // Set user as online
            await set(presenceRef, {
                status: 'online',
                lastSeen: serverTimestamp()
            });
            
            // Set up disconnect handler to mark user as offline when they disconnect
            const disconnectRef = onDisconnect(presenceRef);
            await disconnectRef.set({
                status: 'offline',
                lastSeen: serverTimestamp()
            });
            
            console.log('User presence set to online');
        } else {
            // Set user as offline
            await set(presenceRef, {
                status: 'offline',
                lastSeen: serverTimestamp()
            });
            
            console.log('User presence set to offline');
        }
    } catch (error) {
        console.error('Error setting user presence:', error);
    }
}

// Remove user presence
export async function removeUserPresence(uid) {
    try {
        const presenceRef = ref(database, `presence/${uid}`);
        await set(presenceRef, {
            status: 'offline',
            lastSeen: serverTimestamp()
        });
        
        console.log('User presence removed');
    } catch (error) {
        console.error('Error removing user presence:', error);
    }
}

// Listen to user presence
export function listenToUserPresence(uid, callback) {
    const presenceRef = ref(database, `presence/${uid}`);
    
    const unsubscribe = onValue(presenceRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            callback({ status: 'offline', lastSeen: null });
        }
    });
    
    return unsubscribe;
}

// Get multiple users' presence
export async function getUsersPresence(uids) {
    try {
        const presencePromises = uids.map(async (uid) => {
            const presenceRef = ref(database, `presence/${uid}`);
            const snapshot = await get(presenceRef);
            return {
                uid,
                presence: snapshot.exists() ? snapshot.val() : { status: 'offline', lastSeen: null }
            };
        });
        
        const results = await Promise.all(presencePromises);
        
        // Convert to object for easier access
        const presenceMap = {};
        results.forEach(({ uid, presence }) => {
            presenceMap[uid] = presence;
        });
        
        return presenceMap;
    } catch (error) {
        console.error('Error getting users presence:', error);
        return {};
    }
}

// Listen to multiple users' presence
export function listenToUsersPresence(uids, callback) {
    const unsubscribes = [];
    const presenceData = {};
    
    uids.forEach(uid => {
        const presenceRef = ref(database, `presence/${uid}`);
        
        const unsubscribe = onValue(presenceRef, (snapshot) => {
            if (snapshot.exists()) {
                presenceData[uid] = snapshot.val();
            } else {
                presenceData[uid] = { status: 'offline', lastSeen: null };
            }
            
            // Call callback with updated presence data
            callback({ ...presenceData });
        });
        
        unsubscribes.push(unsubscribe);
    });
    
    // Return function to unsubscribe from all listeners
    return () => {
        unsubscribes.forEach(unsubscribe => unsubscribe());
    };
}

// Search users by display name or username
export async function searchUsers(searchTerm, currentUserId) {
    try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const users = snapshot.val();
        const results = [];
        
        Object.keys(users).forEach(uid => {
            // Skip current user
            if (uid === currentUserId) return;
            
            const user = users[uid];
            const displayName = user.displayName?.toLowerCase() || '';
            const username = user.username?.toLowerCase() || '';
            const search = searchTerm.toLowerCase();
            
            if (displayName.includes(search) || username.includes(search)) {
                results.push({
                    uid,
                    ...user
                });
            }
        });
        
        return results;
    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
}

// Update user profile
export async function updateUserProfile(uid, updates) {
    try {
        const userRef = ref(database, `users/${uid}`);
        await update(userRef, {
            ...updates,
            updatedAt: Date.now()
        });
        
        console.log('User profile updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
}

// Get user's current username
export async function getCurrentUsername(uid) {
    try {
        const userProfile = await getUserProfile(uid);
        return userProfile?.username || null;
    } catch (error) {
        console.error('Error getting current username:', error);
        return null;
    }
}

