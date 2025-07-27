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
import { getUserProfile, areFriends } from './friends.js';
import { addNotification } from './notifications.js';

// Generate chat ID for two users (consistent ordering)
function generateChatId(userId1, userId2) {
    return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`;
}

// Send message
export async function sendMessage(recipientId, messageText) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        // Check if users are friends
        const isFriend = await areFriends(currentUserId, recipientId);
        if (!isFriend) {
            throw new Error('Can only send messages to friends');
        }
        
        const chatId = generateChatId(currentUserId, recipientId);
        const messagesRef = ref(database, `messages/${chatId}`);
        
        const messageData = {
            senderId: currentUserId,
            recipientId: recipientId,
            text: messageText,
            timestamp: serverTimestamp(),
            read: false
        };
        
        // Add message to chat
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, messageData);
        
        // Update chat metadata
        const chatMetaRef = ref(database, `chats/${chatId}`);
        await set(chatMetaRef, {
            participants: [currentUserId, recipientId],
            lastMessage: {
                text: messageText,
                senderId: currentUserId,
                timestamp: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        });
        
        // Update last message for both users
        await update(ref(database, `userChats/${currentUserId}/${chatId}`), {
            lastMessage: messageText,
            lastMessageTime: serverTimestamp(),
            otherUserId: recipientId
        });
        
        await update(ref(database, `userChats/${recipientId}/${chatId}`), {
            lastMessage: messageText,
            lastMessageTime: serverTimestamp(),
            otherUserId: currentUserId,
            unreadCount: (await getUnreadCount(recipientId, chatId)) + 1
        });
        
        // Add notification for recipient
        const senderProfile = await getUserProfile(currentUserId);
        await addNotification(recipientId, {
            type: 'new_message',
            from: currentUserId,
            message: `${senderProfile.displayName} sent you a message`,
            timestamp: Date.now(),
            chatId: chatId
        });
        
        console.log('Message sent successfully');
        return newMessageRef.key;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}

// Get chat messages
export async function getChatMessages(otherUserId, limit = 50) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return [];
        }
        
        const chatId = generateChatId(currentUserId, otherUserId);
        const messagesRef = ref(database, `messages/${chatId}`);
        const messagesQuery = query(messagesRef, limitToLast(limit));
        
        const snapshot = await get(messagesQuery);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const messages = snapshot.val();
        const messagesList = [];
        
        Object.keys(messages).forEach(messageId => {
            messagesList.push({
                id: messageId,
                ...messages[messageId]
            });
        });
        
        // Sort by timestamp
        messagesList.sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return timeA - timeB;
        });
        
        return messagesList;
    } catch (error) {
        console.error('Error getting chat messages:', error);
        return [];
    }
}

// Listen to chat messages
export function listenToChatMessages(otherUserId, callback, limit = 50) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        return () => {};
    }
    
    const chatId = generateChatId(currentUserId, otherUserId);
    const messagesRef = ref(database, `messages/${chatId}`);
    const messagesQuery = query(messagesRef, limitToLast(limit));
    
    const unsubscribe = onValue(messagesQuery, (snapshot) => {
        if (snapshot.exists()) {
            const messages = snapshot.val();
            const messagesList = [];
            
            Object.keys(messages).forEach(messageId => {
                messagesList.push({
                    id: messageId,
                    ...messages[messageId]
                });
            });
            
            // Sort by timestamp
            messagesList.sort((a, b) => {
                const timeA = a.timestamp || 0;
                const timeB = b.timestamp || 0;
                return timeA - timeB;
            });
            
            callback(messagesList);
        } else {
            callback([]);
        }
    });
    
    return unsubscribe;
}

// Mark messages as read
export async function markMessagesAsRead(otherUserId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return;
        }
        
        const chatId = generateChatId(currentUserId, otherUserId);
        
        // Reset unread count for current user
        await update(ref(database, `userChats/${currentUserId}/${chatId}`), {
            unreadCount: 0
        });
        
        // Mark individual messages as read
        const messagesRef = ref(database, `messages/${chatId}`);
        const snapshot = await get(messagesRef);
        
        if (snapshot.exists()) {
            const messages = snapshot.val();
            const updates = {};
            
            Object.keys(messages).forEach(messageId => {
                const message = messages[messageId];
                if (message.recipientId === currentUserId && !message.read) {
                    updates[`${messageId}/read`] = true;
                }
            });
            
            if (Object.keys(updates).length > 0) {
                await update(messagesRef, updates);
            }
        }
        
        console.log('Messages marked as read');
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// Get user chats
export async function getUserChats() {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return [];
        }
        
        const userChatsRef = ref(database, `userChats/${currentUserId}`);
        const snapshot = await get(userChatsRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const chats = snapshot.val();
        const chatsList = [];
        
        for (const chatId in chats) {
            const chatData = chats[chatId];
            const otherUserId = chatData.otherUserId;
            
            // Get other user's profile
            const otherUserProfile = await getUserProfile(otherUserId);
            if (otherUserProfile) {
                chatsList.push({
                    chatId,
                    otherUser: {
                        uid: otherUserId,
                        ...otherUserProfile
                    },
                    lastMessage: chatData.lastMessage || '',
                    lastMessageTime: chatData.lastMessageTime || 0,
                    unreadCount: chatData.unreadCount || 0
                });
            }
        }
        
        // Sort by last message time
        chatsList.sort((a, b) => {
            const timeA = a.lastMessageTime || 0;
            const timeB = b.lastMessageTime || 0;
            return timeB - timeA;
        });
        
        return chatsList;
    } catch (error) {
        console.error('Error getting user chats:', error);
        return [];
    }
}

// Listen to user chats
export function listenToUserChats(callback) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        return () => {};
    }
    
    const userChatsRef = ref(database, `userChats/${currentUserId}`);
    
    const unsubscribe = onValue(userChatsRef, async (snapshot) => {
        if (snapshot.exists()) {
            const chats = snapshot.val();
            const chatsList = [];
            
            for (const chatId in chats) {
                const chatData = chats[chatId];
                const otherUserId = chatData.otherUserId;
                
                // Get other user's profile
                const otherUserProfile = await getUserProfile(otherUserId);
                if (otherUserProfile) {
                    chatsList.push({
                        chatId,
                        otherUser: {
                            uid: otherUserId,
                            ...otherUserProfile
                        },
                        lastMessage: chatData.lastMessage || '',
                        lastMessageTime: chatData.lastMessageTime || 0,
                        unreadCount: chatData.unreadCount || 0
                    });
                }
            }
            
            // Sort by last message time
            chatsList.sort((a, b) => {
                const timeA = a.lastMessageTime || 0;
                const timeB = b.lastMessageTime || 0;
                return timeB - timeA;
            });
            
            callback(chatsList);
        } else {
            callback([]);
        }
    });
    
    return unsubscribe;
}

// Get unread count for a chat
async function getUnreadCount(userId, chatId) {
    try {
        const userChatRef = ref(database, `userChats/${userId}/${chatId}`);
        const snapshot = await get(userChatRef);
        
        if (snapshot.exists()) {
            return snapshot.val().unreadCount || 0;
        }
        
        return 0;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

// Get total unread messages count
export async function getTotalUnreadCount() {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return 0;
        }
        
        const userChatsRef = ref(database, `userChats/${currentUserId}`);
        const snapshot = await get(userChatsRef);
        
        if (!snapshot.exists()) {
            return 0;
        }
        
        const chats = snapshot.val();
        let totalUnread = 0;
        
        Object.values(chats).forEach(chat => {
            totalUnread += chat.unreadCount || 0;
        });
        
        return totalUnread;
    } catch (error) {
        console.error('Error getting total unread count:', error);
        return 0;
    }
}

// Delete message
export async function deleteMessage(otherUserId, messageId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        const chatId = generateChatId(currentUserId, otherUserId);
        const messageRef = ref(database, `messages/${chatId}/${messageId}`);
        
        // Check if message exists and user is the sender
        const snapshot = await get(messageRef);
        if (!snapshot.exists()) {
            throw new Error('Message not found');
        }
        
        const message = snapshot.val();
        if (message.senderId !== currentUserId) {
            throw new Error('Can only delete your own messages');
        }
        
        // Delete the message
        await remove(messageRef);
        
        console.log('Message deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting message:', error);
        throw error;
    }
}

// Start chat with friend
export async function startChatWithFriend(friendId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        // Check if users are friends
        const isFriend = await areFriends(currentUserId, friendId);
        if (!isFriend) {
            throw new Error('Can only chat with friends');
        }
        
        const chatId = generateChatId(currentUserId, friendId);
        
        // Initialize chat metadata if it doesn't exist
        const chatMetaRef = ref(database, `chats/${chatId}`);
        const chatSnapshot = await get(chatMetaRef);
        
        if (!chatSnapshot.exists()) {
            await set(chatMetaRef, {
                participants: [currentUserId, friendId],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        
        // Initialize user chat entries
        await update(ref(database, `userChats/${currentUserId}/${chatId}`), {
            otherUserId: friendId,
            unreadCount: 0
        });
        
        await update(ref(database, `userChats/${friendId}/${chatId}`), {
            otherUserId: currentUserId,
            unreadCount: 0
        });
        
        console.log('Chat initialized successfully');
        return chatId;
    } catch (error) {
        console.error('Error starting chat:', error);
        throw error;
    }
}

// Search messages in chat
export async function searchMessagesInChat(otherUserId, searchTerm) {
    try {
        const messages = await getChatMessages(otherUserId, 1000); // Get more messages for search
        
        const filteredMessages = messages.filter(message => 
            message.text.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        return filteredMessages;
    } catch (error) {
        console.error('Error searching messages:', error);
        return [];
    }
}

// Get chat statistics
export async function getChatStatistics(otherUserId) {
    try {
        const messages = await getChatMessages(otherUserId, 1000);
        const currentUserId = getCurrentUserId();
        
        const stats = {
            totalMessages: messages.length,
            messagesSent: messages.filter(m => m.senderId === currentUserId).length,
            messagesReceived: messages.filter(m => m.senderId === otherUserId).length,
            firstMessageDate: messages.length > 0 ? messages[0].timestamp : null,
            lastMessageDate: messages.length > 0 ? messages[messages.length - 1].timestamp : null
        };
        
        return stats;
    } catch (error) {
        console.error('Error getting chat statistics:', error);
        return null;
    }
}

