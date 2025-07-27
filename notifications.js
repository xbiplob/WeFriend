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
    serverTimestamp,
    query,
    orderByChild,
    limitToLast
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

import { database } from './firebase-config.js';
import { getCurrentUserId } from './auth.js';
import { getUserProfile } from './database.js';

// Add notification
export async function addNotification(userId, notificationData) {
    try {
        const notificationsRef = ref(database, `notifications/${userId}`);
        const newNotificationRef = push(notificationsRef);
        
        const notification = {
            ...notificationData,
            id: newNotificationRef.key,
            read: false,
            createdAt: Date.now()
        };
        
        await set(newNotificationRef, notification);
        
        console.log('Notification added successfully');
        return newNotificationRef.key;
    } catch (error) {
        console.error('Error adding notification:', error);
        throw error;
    }
}

// Get user notifications
export async function getUserNotifications(limit = 50) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return [];
        }
        
        const notificationsRef = ref(database, `notifications/${currentUserId}`);
        const notificationsQuery = query(notificationsRef, limitToLast(limit));
        const snapshot = await get(notificationsQuery);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const notifications = snapshot.val();
        const notificationsList = [];
        
        for (const notificationId in notifications) {
            const notification = notifications[notificationId];
            
            // Get sender profile if notification has 'from' field
            if (notification.from) {
                const senderProfile = await getUserProfile(notification.from);
                notification.senderProfile = senderProfile;
            }
            
            notificationsList.push({
                id: notificationId,
                ...notification
            });
        }
        
        // Sort by timestamp (newest first)
        notificationsList.sort((a, b) => {
            const timeA = a.createdAt || 0;
            const timeB = b.createdAt || 0;
            return timeB - timeA;
        });
        
        return notificationsList;
    } catch (error) {
        console.error('Error getting user notifications:', error);
        return [];
    }
}

// Listen to user notifications
export function listenToUserNotifications(callback, limit = 50) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        return () => {};
    }
    
    const notificationsRef = ref(database, `notifications/${currentUserId}`);
    const notificationsQuery = query(notificationsRef, limitToLast(limit));
    
    const unsubscribe = onValue(notificationsQuery, async (snapshot) => {
        if (snapshot.exists()) {
            const notifications = snapshot.val();
            const notificationsList = [];
            
            for (const notificationId in notifications) {
                const notification = notifications[notificationId];
                
                // Get sender profile if notification has 'from' field
                if (notification.from) {
                    const senderProfile = await getUserProfile(notification.from);
                    notification.senderProfile = senderProfile;
                }
                
                notificationsList.push({
                    id: notificationId,
                    ...notification
                });
            }
            
            // Sort by timestamp (newest first)
            notificationsList.sort((a, b) => {
                const timeA = a.createdAt || 0;
                const timeB = b.createdAt || 0;
                return timeB - timeA;
            });
            
            callback(notificationsList);
        } else {
            callback([]);
        }
    });
    
    return unsubscribe;
}

// Mark notification as read
export async function markNotificationAsRead(notificationId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return;
        }
        
        const notificationRef = ref(database, `notifications/${currentUserId}/${notificationId}`);
        await update(notificationRef, {
            read: true,
            readAt: Date.now()
        });
        
        console.log('Notification marked as read');
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Mark all notifications as read
export async function markAllNotificationsAsRead() {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return;
        }
        
        const notificationsRef = ref(database, `notifications/${currentUserId}`);
        const snapshot = await get(notificationsRef);
        
        if (!snapshot.exists()) {
            return;
        }
        
        const notifications = snapshot.val();
        const updates = {};
        
        Object.keys(notifications).forEach(notificationId => {
            if (!notifications[notificationId].read) {
                updates[`${notificationId}/read`] = true;
                updates[`${notificationId}/readAt`] = Date.now();
            }
        });
        
        if (Object.keys(updates).length > 0) {
            await update(notificationsRef, updates);
        }
        
        console.log('All notifications marked as read');
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

// Delete notification
export async function deleteNotification(notificationId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return;
        }
        
        const notificationRef = ref(database, `notifications/${currentUserId}/${notificationId}`);
        await remove(notificationRef);
        
        console.log('Notification deleted');
    } catch (error) {
        console.error('Error deleting notification:', error);
    }
}

// Clear all notifications
export async function clearAllNotifications() {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return;
        }
        
        const notificationsRef = ref(database, `notifications/${currentUserId}`);
        await remove(notificationsRef);
        
        console.log('All notifications cleared');
    } catch (error) {
        console.error('Error clearing all notifications:', error);
    }
}

// Get unread notifications count
export async function getUnreadNotificationsCount() {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return 0;
        }
        
        const notificationsRef = ref(database, `notifications/${currentUserId}`);
        const snapshot = await get(notificationsRef);
        
        if (!snapshot.exists()) {
            return 0;
        }
        
        const notifications = snapshot.val();
        let unreadCount = 0;
        
        Object.values(notifications).forEach(notification => {
            if (!notification.read) {
                unreadCount++;
            }
        });
        
        return unreadCount;
    } catch (error) {
        console.error('Error getting unread notifications count:', error);
        return 0;
    }
}

// Listen to unread notifications count
export function listenToUnreadNotificationsCount(callback) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        return () => {};
    }
    
    const notificationsRef = ref(database, `notifications/${currentUserId}`);
    
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
        if (snapshot.exists()) {
            const notifications = snapshot.val();
            let unreadCount = 0;
            
            Object.values(notifications).forEach(notification => {
                if (!notification.read) {
                    unreadCount++;
                }
            });
            
            callback(unreadCount);
        } else {
            callback(0);
        }
    });
    
    return unsubscribe;
}

// Get notification types
export const NOTIFICATION_TYPES = {
    FRIEND_REQUEST: 'friend_request',
    FRIEND_REQUEST_ACCEPTED: 'friend_request_accepted',
    NEW_MESSAGE: 'new_message',
    POST_LIKE: 'post_like',
    POST_COMMENT: 'post_comment',
    MENTION: 'mention'
};

// Format notification message
export function formatNotificationMessage(notification) {
    const senderName = notification.senderProfile?.displayName || 'Someone';
    
    switch (notification.type) {
        case NOTIFICATION_TYPES.FRIEND_REQUEST:
            return `${senderName} sent you a friend request`;
        case NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED:
            return `${senderName} accepted your friend request`;
        case NOTIFICATION_TYPES.NEW_MESSAGE:
            return `${senderName} sent you a message`;
        case NOTIFICATION_TYPES.POST_LIKE:
            return `${senderName} liked your post`;
        case NOTIFICATION_TYPES.POST_COMMENT:
            return `${senderName} commented on your post`;
        case NOTIFICATION_TYPES.MENTION:
            return `${senderName} mentioned you in a post`;
        default:
            return notification.message || 'New notification';
    }
}

// Get notification icon
export function getNotificationIcon(type) {
    switch (type) {
        case NOTIFICATION_TYPES.FRIEND_REQUEST:
            return 'fas fa-user-plus';
        case NOTIFICATION_TYPES.FRIEND_REQUEST_ACCEPTED:
            return 'fas fa-user-check';
        case NOTIFICATION_TYPES.NEW_MESSAGE:
            return 'fas fa-comment';
        case NOTIFICATION_TYPES.POST_LIKE:
            return 'fas fa-heart';
        case NOTIFICATION_TYPES.POST_COMMENT:
            return 'fas fa-comment-dots';
        case NOTIFICATION_TYPES.MENTION:
            return 'fas fa-at';
        default:
            return 'fas fa-bell';
    }
}

// Format time ago
export function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (years > 0) {
        return `${years} year${years > 1 ? 's' : ''} ago`;
    } else if (months > 0) {
        return `${months} month${months > 1 ? 's' : ''} ago`;
    } else if (weeks > 0) {
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

// Show browser notification (if permission granted)
export function showBrowserNotification(title, body, icon = null) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: body,
            icon: icon || '/favicon.ico',
            badge: '/favicon.ico'
        });
        
        // Auto close after 5 seconds
        setTimeout(() => {
            notification.close();
        }, 5000);
        
        return notification;
    }
    
    return null;
}

// Request notification permission
export async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    return false;
}

