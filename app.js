// Import all modules
import { initializeAuth, signInWithGoogle, signOutUser, getCurrentUserId } from './auth.js';
import { 
    setUsername, 
    getCurrentUsername, 
    checkUsernameAvailability,
    listenToUsersPresence 
} from './database.js';
import { 
    sendFriendRequest, 
    acceptFriendRequest, 
    rejectFriendRequest,
    listenToFriendRequests,
    listenToFriendsList,
    getFriendsList
} from './friends.js';
import { 
    sendMessage, 
    listenToChatMessages, 
    markMessagesAsRead,
    listenToUserChats,
    startChatWithFriend
} from './chat.js';
import { 
    createPost, 
    listenToFeedPosts, 
    togglePostLike, 
    addComment,
    listenToPostComments,
    hasUserLikedPost
} from './posts.js';
import { 
    listenToUserNotifications, 
    markAllNotificationsAsRead,
    listenToUnreadNotificationsCount,
    formatNotificationMessage,
    getNotificationIcon,
    formatTimeAgo,
    requestNotificationPermission
} from './notifications.js';

// Global state
let currentUser = null;
let currentChatUser = null;
let unsubscribeFunctions = [];

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('WeFriend app initializing...');
    
    // Initialize authentication
    currentUser = await initializeAuth();
    
    // Set up event listeners
    setupEventListeners();
    
    // Request notification permission
    await requestNotificationPermission();
    
    console.log('WeFriend app initialized');
});

// Setup event listeners
function setupEventListeners() {
    // Authentication
    document.getElementById('google-signin-btn')?.addEventListener('click', handleGoogleSignIn);
    document.getElementById('signout-btn')?.addEventListener('click', handleSignOut);
    
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.dataset.tab;
            switchTab(tab);
        });
    });
    
    // User menu
    document.getElementById('user-menu-btn')?.addEventListener('click', toggleUserMenu);
    
    // Notifications
    document.getElementById('notifications-btn')?.addEventListener('click', toggleNotificationsPanel);
    document.getElementById('clear-notifications')?.addEventListener('click', handleClearNotifications);
    
    // Username
    document.getElementById('save-username-btn')?.addEventListener('click', handleSaveUsername);
    
    // Friends
    document.getElementById('add-friend-btn')?.addEventListener('click', showAddFriendModal);
    document.getElementById('send-friend-request-btn')?.addEventListener('click', handleSendFriendRequest);
    
    // Posts
    document.getElementById('create-post-btn')?.addEventListener('click', handleCreatePost);
    document.getElementById('add-image-btn')?.addEventListener('click', () => {
        document.getElementById('post-image').click();
    });
    document.getElementById('post-image')?.addEventListener('change', handlePostImageSelect);
    document.getElementById('remove-image')?.addEventListener('click', removePostImage);
    
    // Chat
    document.getElementById('send-message-btn')?.addEventListener('click', handleSendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
    
    // Modal close
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.add('hidden');
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
    
    // Click outside dropdowns to close
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-dropdown')) {
            document.getElementById('user-menu')?.classList.add('hidden');
        }
        if (!e.target.closest('.notifications-dropdown')) {
            document.getElementById('notifications-panel')?.classList.add('hidden');
        }
    });
}

// Authentication handlers
async function handleGoogleSignIn() {
    try {
        const btn = document.getElementById('google-signin-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
        
        await signInWithGoogle();
    } catch (error) {
        console.error('Sign-in failed:', error);
    } finally {
        const btn = document.getElementById('google-signin-btn');
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-google"></i> Sign in with Google';
    }
}

async function handleSignOut() {
    try {
        // Clean up listeners
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
        unsubscribeFunctions = [];
        
        await signOutUser();
    } catch (error) {
        console.error('Sign-out failed:', error);
    }
}

// Theme management
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update theme toggle icon
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle.querySelector('i');
    icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Initialize theme
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle?.querySelector('i');
    if (icon) {
        icon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// Navigation
function switchTab(tabName) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
    
    // Load tab-specific content
    switch (tabName) {
        case 'feed':
            loadFeedPosts();
            break;
        case 'friends':
            loadFriendsData();
            break;
        case 'chat':
            loadUserChats();
            break;
        case 'profile':
            loadUserProfile();
            break;
    }
}

// User menu
function toggleUserMenu() {
    const userMenu = document.getElementById('user-menu');
    userMenu.classList.toggle('hidden');
}

// Notifications
function toggleNotificationsPanel() {
    const panel = document.getElementById('notifications-panel');
    panel.classList.toggle('hidden');
    
    if (!panel.classList.contains('hidden')) {
        loadNotifications();
    }
}

async function handleClearNotifications() {
    try {
        await markAllNotificationsAsRead();
        loadNotifications();
    } catch (error) {
        console.error('Error clearing notifications:', error);
    }
}

// Username management
async function handleSaveUsername() {
    try {
        const usernameInput = document.getElementById('username-input');
        const username = usernameInput.value.trim();
        
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        if (username.length < 3) {
            alert('Username must be at least 3 characters long');
            return;
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            alert('Username can only contain letters, numbers, and underscores');
            return;
        }
        
        const isAvailable = await checkUsernameAvailability(username);
        if (!isAvailable) {
            alert('Username is already taken');
            return;
        }
        
        const btn = document.getElementById('save-username-btn');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        await setUsername(getCurrentUserId(), username);
        alert('Username saved successfully!');
        
        btn.disabled = false;
        btn.textContent = 'Save';
    } catch (error) {
        console.error('Error saving username:', error);
        alert('Failed to save username. Please try again.');
        
        const btn = document.getElementById('save-username-btn');
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

// Friends management
function showAddFriendModal() {
    document.getElementById('add-friend-modal').classList.remove('hidden');
    document.getElementById('friend-username-input').focus();
}

async function handleSendFriendRequest() {
    try {
        const usernameInput = document.getElementById('friend-username-input');
        const username = usernameInput.value.trim();
        
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        const btn = document.getElementById('send-friend-request-btn');
        btn.disabled = true;
        btn.textContent = 'Sending...';
        
        await sendFriendRequest(username);
        alert('Friend request sent successfully!');
        
        usernameInput.value = '';
        document.getElementById('add-friend-modal').classList.add('hidden');
        
        btn.disabled = false;
        btn.textContent = 'Send Request';
    } catch (error) {
        console.error('Error sending friend request:', error);
        alert(error.message || 'Failed to send friend request');
        
        const btn = document.getElementById('send-friend-request-btn');
        btn.disabled = false;
        btn.textContent = 'Send Request';
    }
}

// Posts management
async function handleCreatePost() {
    try {
        const contentTextarea = document.getElementById('post-content');
        const content = contentTextarea.value.trim();
        const imageInput = document.getElementById('post-image');
        const imageFile = imageInput.files[0];
        
        if (!content && !imageFile) {
            alert('Please add some content or an image');
            return;
        }
        
        const btn = document.getElementById('create-post-btn');
        btn.disabled = true;
        btn.textContent = 'Posting...';
        
        await createPost(content, imageFile);
        
        // Clear form
        contentTextarea.value = '';
        imageInput.value = '';
        removePostImage();
        
        btn.disabled = false;
        btn.textContent = 'Post';
        
        // Reload feed
        loadFeedPosts();
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Failed to create post. Please try again.');
        
        const btn = document.getElementById('create-post-btn');
        btn.disabled = false;
        btn.textContent = 'Post';
    }
}

function handlePostImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('image-preview');
            const previewImage = document.getElementById('preview-image');
            
            previewImage.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function removePostImage() {
    document.getElementById('post-image').value = '';
    document.getElementById('image-preview').classList.add('hidden');
}

// Chat management
async function handleSendMessage() {
    try {
        if (!currentChatUser) return;
        
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        await sendMessage(currentChatUser.uid, message);
        chatInput.value = '';
        
        // Mark messages as read
        await markMessagesAsRead(currentChatUser.uid);
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Data loading functions
async function loadFeedPosts() {
    try {
        // Set up real-time listener for feed posts
        const unsubscribe = listenToFeedPosts((posts) => {
            renderFeedPosts(posts);
        });
        unsubscribeFunctions.push(unsubscribe);
    } catch (error) {
        console.error('Error loading feed posts:', error);
    }
}

async function loadFriendsData() {
    try {
        // Set up real-time listeners
        const unsubscribeFriendRequests = listenToFriendRequests((requests) => {
            renderFriendRequests(requests);
        });
        
        const unsubscribeFriendsList = listenToFriendsList((friends) => {
            renderFriendsList(friends);
        });
        
        unsubscribeFunctions.push(unsubscribeFriendRequests, unsubscribeFriendsList);
    } catch (error) {
        console.error('Error loading friends data:', error);
    }
}

async function loadUserChats() {
    try {
        // Set up real-time listener for user chats
        const unsubscribe = listenToUserChats((chats) => {
            renderChatList(chats);
        });
        unsubscribeFunctions.push(unsubscribe);
    } catch (error) {
        console.error('Error loading user chats:', error);
    }
}

async function loadUserProfile() {
    try {
        const username = await getCurrentUsername(getCurrentUserId());
        if (username) {
            document.getElementById('username-input').value = username;
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

async function loadNotifications() {
    try {
        // Set up real-time listener for notifications
        const unsubscribe = listenToUserNotifications((notifications) => {
            renderNotifications(notifications);
        });
        
        // Set up unread count listener
        const unsubscribeCount = listenToUnreadNotificationsCount((count) => {
            updateNotificationCount(count);
        });
        
        unsubscribeFunctions.push(unsubscribe, unsubscribeCount);
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Rendering functions
function renderFeedPosts(posts) {
    const container = document.getElementById('posts-container');
    container.innerHTML = '';
    
    posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

function renderFriendRequests(requests) {
    const container = document.getElementById('friend-requests-list');
    container.innerHTML = '';
    
    if (requests.length === 0) {
        container.innerHTML = '<p class="text-secondary">No friend requests</p>';
        return;
    }
    
    requests.forEach(request => {
        const requestElement = createFriendRequestElement(request);
        container.appendChild(requestElement);
    });
}

function renderFriendsList(friends) {
    const container = document.getElementById('friends-list');
    container.innerHTML = '';
    
    if (friends.length === 0) {
        container.innerHTML = '<p class="text-secondary">No friends yet</p>';
        return;
    }
    
    friends.forEach(friend => {
        const friendElement = createFriendElement(friend);
        container.appendChild(friendElement);
    });
}

function renderChatList(chats) {
    const container = document.getElementById('chat-list');
    container.innerHTML = '';
    
    if (chats.length === 0) {
        container.innerHTML = '<p class="text-secondary">No chats yet</p>';
        return;
    }
    
    chats.forEach(chat => {
        const chatElement = createChatListElement(chat);
        container.appendChild(chatElement);
    });
}

function renderNotifications(notifications) {
    const container = document.getElementById('notifications-list');
    container.innerHTML = '';
    
    if (notifications.length === 0) {
        container.innerHTML = '<p class="text-secondary">No notifications</p>';
        return;
    }
    
    notifications.forEach(notification => {
        const notificationElement = createNotificationElement(notification);
        container.appendChild(notificationElement);
    });
}

// Element creation functions
function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post-card';
    div.innerHTML = `
        <div class="post-header">
            <img src="${post.authorPhoto || '/images/default-avatar.png'}" alt="${post.authorName}">
            <div class="post-user-info">
                <h4>${post.authorName}</h4>
                <div class="post-timestamp">${formatTimeAgo(post.createdAt)}</div>
            </div>
        </div>
        <div class="post-content">
            ${post.content ? `<div class="post-text">${post.content}</div>` : ''}
            ${post.image ? `<img src="${post.image.url}" alt="Post image" class="post-image">` : ''}
        </div>
        <div class="post-actions">
            <button class="post-action-btn like-btn" data-post-id="${post.id}">
                <i class="fas fa-heart"></i>
                <span>${post.likesCount || 0}</span>
            </button>
            <button class="post-action-btn comment-btn" data-post-id="${post.id}">
                <i class="fas fa-comment"></i>
                <span>${post.commentsCount || 0}</span>
            </button>
        </div>
    `;
    
    // Add event listeners
    const likeBtn = div.querySelector('.like-btn');
    likeBtn.addEventListener('click', () => handlePostLike(post.id));
    
    return div;
}

function createFriendRequestElement(request) {
    const div = document.createElement('div');
    div.className = 'friend-request-item';
    div.innerHTML = `
        <div class="friend-info">
            <img src="${request.photoURL || '/images/default-avatar.png'}" alt="${request.displayName}">
            <div class="friend-details">
                <h5>${request.displayName}</h5>
                <div class="friend-username">@${request.username || 'No username'}</div>
            </div>
        </div>
        <div class="friend-actions">
            <button class="friend-action-btn accept-btn" data-user-id="${request.fromUserId}">Accept</button>
            <button class="friend-action-btn reject-btn" data-user-id="${request.fromUserId}">Reject</button>
        </div>
    `;
    
    // Add event listeners
    div.querySelector('.accept-btn').addEventListener('click', () => handleAcceptFriendRequest(request.fromUserId));
    div.querySelector('.reject-btn').addEventListener('click', () => handleRejectFriendRequest(request.fromUserId));
    
    return div;
}

function createFriendElement(friend) {
    const div = document.createElement('div');
    div.className = 'friend-item';
    div.innerHTML = `
        <div class="friend-info">
            <img src="${friend.photoURL || '/images/default-avatar.png'}" alt="${friend.displayName}">
            <div class="friend-details">
                <h5>${friend.displayName}</h5>
                <div class="friend-username">@${friend.username || 'No username'}</div>
                <div class="friend-status">
                    <span class="status-indicator"></span>
                    <span>Offline</span>
                </div>
            </div>
        </div>
        <div class="friend-actions">
            <button class="friend-action-btn chat-btn" data-user-id="${friend.uid}">Chat</button>
        </div>
    `;
    
    // Add event listeners
    div.querySelector('.chat-btn').addEventListener('click', () => openChat(friend));
    
    return div;
}

function createChatListElement(chat) {
    const div = document.createElement('div');
    div.className = 'chat-list-item';
    div.innerHTML = `
        <img src="${chat.otherUser.photoURL || '/images/default-avatar.png'}" alt="${chat.otherUser.displayName}">
        <div class="chat-item-info">
            <h5>${chat.otherUser.displayName}</h5>
            <div class="chat-last-message">${chat.lastMessage || 'No messages yet'}</div>
        </div>
        ${chat.unreadCount > 0 ? `<div class="unread-badge">${chat.unreadCount}</div>` : ''}
    `;
    
    div.addEventListener('click', () => openChat(chat.otherUser));
    
    return div;
}

function createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
    div.innerHTML = `
        <div class="notification-icon">
            <i class="${getNotificationIcon(notification.type)}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-message">${formatNotificationMessage(notification)}</div>
            <div class="notification-time">${formatTimeAgo(notification.createdAt)}</div>
        </div>
    `;
    
    return div;
}

// Event handlers
async function handlePostLike(postId) {
    try {
        await togglePostLike(postId);
    } catch (error) {
        console.error('Error toggling post like:', error);
    }
}

async function handleAcceptFriendRequest(fromUserId) {
    try {
        await acceptFriendRequest(fromUserId);
    } catch (error) {
        console.error('Error accepting friend request:', error);
        alert('Failed to accept friend request');
    }
}

async function handleRejectFriendRequest(fromUserId) {
    try {
        await rejectFriendRequest(fromUserId);
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        alert('Failed to reject friend request');
    }
}

async function openChat(user) {
    try {
        currentChatUser = user;
        
        // Update chat UI
        document.getElementById('chat-placeholder').classList.add('hidden');
        document.getElementById('chat-window').classList.remove('hidden');
        
        // Update chat header
        document.getElementById('chat-friend-avatar').src = user.photoURL || '/images/default-avatar.png';
        document.getElementById('chat-friend-name').textContent = user.displayName;
        document.getElementById('chat-friend-status').textContent = 'Online'; // TODO: Update with real presence
        
        // Start chat and load messages
        await startChatWithFriend(user.uid);
        
        // Set up real-time message listener
        const unsubscribe = listenToChatMessages(user.uid, (messages) => {
            renderChatMessages(messages);
        });
        
        // Clean up previous chat listener
        if (window.currentChatUnsubscribe) {
            window.currentChatUnsubscribe();
        }
        window.currentChatUnsubscribe = unsubscribe;
        
        // Mark messages as read
        await markMessagesAsRead(user.uid);
        
        // Switch to chat tab
        switchTab('chat');
    } catch (error) {
        console.error('Error opening chat:', error);
        alert('Failed to open chat');
    }
}

function renderChatMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    
    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        container.appendChild(messageElement);
    });
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.senderId === getCurrentUserId() ? 'sent' : 'received'}`;
    div.innerHTML = `
        <div class="message-content">
            <div class="message-text">${message.text}</div>
            <div class="message-time">${formatTimeAgo(message.timestamp || Date.now())}</div>
        </div>
    `;
    
    return div;
}

function updateNotificationCount(count) {
    const badge = document.getElementById('notification-count');
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Initialize theme on load
initializeTheme();

