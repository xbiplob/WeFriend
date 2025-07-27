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
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

import { database } from './firebase-config.js';
import { getUserProfile, getUserByUsername, listenToUsersPresence } from './database.js';
import { getCurrentUserId } from './auth.js';
import { addNotification } from './notifications.js';

// Send friend request
export async function sendFriendRequest(targetUsername) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        // Get target user by username
        const targetUser = await getUserByUsername(targetUsername);
        if (!targetUser) {
            throw new Error('User not found');
        }
        
        const targetUserId = Object.keys(await get(ref(database, 'users')))
            .find(uid => {
                return get(ref(database, `users/${uid}`)).then(snapshot => 
                    snapshot.val()?.username === targetUsername
                );
            });
        
        // Find target user ID by username
        const usersRef = ref(database, 'users');
        const usersSnapshot = await get(usersRef);
        const users = usersSnapshot.val();
        
        let targetUid = null;
        for (const uid in users) {
            if (users[uid].username === targetUsername) {
                targetUid = uid;
                break;
            }
        }
        
        if (!targetUid) {
            throw new Error('User not found');
        }
        
        if (targetUid === currentUserId) {
            throw new Error('Cannot send friend request to yourself');
        }
        
        // Check if already friends
        const friendsRef = ref(database, `friends/${currentUserId}/${targetUid}`);
        const friendsSnapshot = await get(friendsRef);
        if (friendsSnapshot.exists()) {
            throw new Error('Already friends with this user');
        }
        
        // Check if friend request already exists
        const requestRef = ref(database, `friendRequests/${targetUid}/${currentUserId}`);
        const requestSnapshot = await get(requestRef);
        if (requestSnapshot.exists()) {
            throw new Error('Friend request already sent');
        }
        
        // Check if there's a pending request from target user
        const reverseRequestRef = ref(database, `friendRequests/${currentUserId}/${targetUid}`);
        const reverseRequestSnapshot = await get(reverseRequestRef);
        if (reverseRequestSnapshot.exists()) {
            throw new Error('This user has already sent you a friend request');
        }
        
        // Create friend request
        const requestData = {
            from: currentUserId,
            to: targetUid,
            timestamp: serverTimestamp(),
            status: 'pending'
        };
        
        await set(requestRef, requestData);
        
        // Add notification for target user
        await addNotification(targetUid, {
            type: 'friend_request',
            from: currentUserId,
            message: `${(await getUserProfile(currentUserId)).displayName} sent you a friend request`,
            timestamp: Date.now()
        });
        
        console.log('Friend request sent successfully');
        return true;
    } catch (error) {
        console.error('Error sending friend request:', error);
        throw error;
    }
}

// Accept friend request
export async function acceptFriendRequest(fromUserId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        // Remove friend request
        const requestRef = ref(database, `friendRequests/${currentUserId}/${fromUserId}`);
        await remove(requestRef);
        
        // Add to both users' friend lists
        const timestamp = serverTimestamp();
        
        await set(ref(database, `friends/${currentUserId}/${fromUserId}`), {
            addedAt: timestamp,
            status: 'accepted'
        });
        
        await set(ref(database, `friends/${fromUserId}/${currentUserId}`), {
            addedAt: timestamp,
            status: 'accepted'
        });
        
        // Add notification for the user who sent the request
        await addNotification(fromUserId, {
            type: 'friend_request_accepted',
            from: currentUserId,
            message: `${(await getUserProfile(currentUserId)).displayName} accepted your friend request`,
            timestamp: Date.now()
        });
        
        console.log('Friend request accepted successfully');
        return true;
    } catch (error) {
        console.error('Error accepting friend request:', error);
        throw error;
    }
}

// Reject friend request
export async function rejectFriendRequest(fromUserId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        // Remove friend request
        const requestRef = ref(database, `friendRequests/${currentUserId}/${fromUserId}`);
        await remove(requestRef);
        
        console.log('Friend request rejected successfully');
        return true;
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        throw error;
    }
}

// Remove friend
export async function removeFriend(friendUserId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        // Remove from both users' friend lists
        await remove(ref(database, `friends/${currentUserId}/${friendUserId}`));
        await remove(ref(database, `friends/${friendUserId}/${currentUserId}`));
        
        console.log('Friend removed successfully');
        return true;
    } catch (error) {
        console.error('Error removing friend:', error);
        throw error;
    }
}

// Get friend requests
export async function getFriendRequests() {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return [];
        }
        
        const requestsRef = ref(database, `friendRequests/${currentUserId}`);
        const snapshot = await get(requestsRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const requests = snapshot.val();
        const requestList = [];
        
        for (const fromUserId in requests) {
            const userProfile = await getUserProfile(fromUserId);
            if (userProfile) {
                requestList.push({
                    fromUserId,
                    ...userProfile,
                    requestData: requests[fromUserId]
                });
            }
        }
        
        return requestList;
    } catch (error) {
        console.error('Error getting friend requests:', error);
        return [];
    }
}

// Get friends list
export async function getFriendsList() {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return [];
        }
        
        const friendsRef = ref(database, `friends/${currentUserId}`);
        const snapshot = await get(friendsRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const friends = snapshot.val();
        const friendsList = [];
        
        for (const friendUserId in friends) {
            const userProfile = await getUserProfile(friendUserId);
            if (userProfile) {
                friendsList.push({
                    uid: friendUserId,
                    ...userProfile,
                    friendshipData: friends[friendUserId]
                });
            }
        }
        
        return friendsList;
    } catch (error) {
        console.error('Error getting friends list:', error);
        return [];
    }
}

// Listen to friend requests
export function listenToFriendRequests(callback) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        return () => {};
    }
    
    const requestsRef = ref(database, `friendRequests/${currentUserId}`);
    
    const unsubscribe = onValue(requestsRef, async (snapshot) => {
        if (snapshot.exists()) {
            const requests = snapshot.val();
            const requestList = [];
            
            for (const fromUserId in requests) {
                const userProfile = await getUserProfile(fromUserId);
                if (userProfile) {
                    requestList.push({
                        fromUserId,
                        ...userProfile,
                        requestData: requests[fromUserId]
                    });
                }
            }
            
            callback(requestList);
        } else {
            callback([]);
        }
    });
    
    return unsubscribe;
}

// Listen to friends list
export function listenToFriendsList(callback) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        return () => {};
    }
    
    const friendsRef = ref(database, `friends/${currentUserId}`);
    
    const unsubscribe = onValue(friendsRef, async (snapshot) => {
        if (snapshot.exists()) {
            const friends = snapshot.val();
            const friendsList = [];
            const friendUids = Object.keys(friends);
            
            // Get all friend profiles
            for (const friendUserId of friendUids) {
                const userProfile = await getUserProfile(friendUserId);
                if (userProfile) {
                    friendsList.push({
                        uid: friendUserId,
                        ...userProfile,
                        friendshipData: friends[friendUserId]
                    });
                }
            }
            
            callback(friendsList);
        } else {
            callback([]);
        }
    });
    
    return unsubscribe;
}

// Check if users are friends
export async function areFriends(userId1, userId2) {
    try {
        const friendRef = ref(database, `friends/${userId1}/${userId2}`);
        const snapshot = await get(friendRef);
        return snapshot.exists();
    } catch (error) {
        console.error('Error checking friendship:', error);
        return false;
    }
}

// Get mutual friends
export async function getMutualFriends(targetUserId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return [];
        }
        
        const [currentUserFriends, targetUserFriends] = await Promise.all([
            getFriendsList(),
            getFriendsListForUser(targetUserId)
        ]);
        
        const currentFriendIds = currentUserFriends.map(friend => friend.uid);
        const targetFriendIds = targetUserFriends.map(friend => friend.uid);
        
        const mutualFriendIds = currentFriendIds.filter(id => targetFriendIds.includes(id));
        
        const mutualFriends = [];
        for (const friendId of mutualFriendIds) {
            const userProfile = await getUserProfile(friendId);
            if (userProfile) {
                mutualFriends.push({
                    uid: friendId,
                    ...userProfile
                });
            }
        }
        
        return mutualFriends;
    } catch (error) {
        console.error('Error getting mutual friends:', error);
        return [];
    }
}

// Get friends list for specific user
async function getFriendsListForUser(userId) {
    try {
        const friendsRef = ref(database, `friends/${userId}`);
        const snapshot = await get(friendsRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const friends = snapshot.val();
        const friendsList = [];
        
        for (const friendUserId in friends) {
            const userProfile = await getUserProfile(friendUserId);
            if (userProfile) {
                friendsList.push({
                    uid: friendUserId,
                    ...userProfile,
                    friendshipData: friends[friendUserId]
                });
            }
        }
        
        return friendsList;
    } catch (error) {
        console.error('Error getting friends list for user:', error);
        return [];
    }
}

// Get friend suggestions (users who are not friends yet)
export async function getFriendSuggestions(limit = 10) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return [];
        }
        
        const [allUsers, currentFriends, pendingRequests] = await Promise.all([
            getAllUsers(),
            getFriendsList(),
            getFriendRequests()
        ]);
        
        const friendIds = currentFriends.map(friend => friend.uid);
        const pendingRequestIds = pendingRequests.map(request => request.fromUserId);
        
        const suggestions = allUsers
            .filter(user => 
                user.uid !== currentUserId && 
                !friendIds.includes(user.uid) && 
                !pendingRequestIds.includes(user.uid)
            )
            .slice(0, limit);
        
        return suggestions;
    } catch (error) {
        console.error('Error getting friend suggestions:', error);
        return [];
    }
}

// Get all users (for suggestions)
async function getAllUsers() {
    try {
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const users = snapshot.val();
        const usersList = [];
        
        for (const uid in users) {
            usersList.push({
                uid,
                ...users[uid]
            });
        }
        
        return usersList;
    } catch (error) {
        console.error('Error getting all users:', error);
        return [];
    }
}

