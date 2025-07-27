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
    limitToLast,
    startAt,
    endAt
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

import { database } from './firebase-config.js';
import { getCurrentUserId } from './auth.js';
import { getUserProfile, getFriendsList } from './friends.js';
import { uploadPostImage } from './storage.js';
import { addNotification } from './notifications.js';

// Create a new post
export async function createPost(content, imageFile = null) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        if (!content.trim() && !imageFile) {
            throw new Error('Post must have content or an image');
        }
        
        let imageData = null;
        
        // Upload image if provided
        if (imageFile) {
            imageData = await uploadPostImage(imageFile);
        }
        
        // Get user profile
        const userProfile = await getUserProfile(currentUserId);
        
        // Create post data
        const postData = {
            authorId: currentUserId,
            authorName: userProfile.displayName,
            authorPhoto: userProfile.photoURL,
            content: content.trim(),
            image: imageData,
            timestamp: serverTimestamp(),
            likes: {},
            likesCount: 0,
            comments: {},
            commentsCount: 0,
            createdAt: Date.now()
        };
        
        // Add post to database
        const postsRef = ref(database, 'posts');
        const newPostRef = push(postsRef);
        await set(newPostRef, postData);
        
        // Add post to user's posts
        const userPostRef = ref(database, `userPosts/${currentUserId}/${newPostRef.key}`);
        await set(userPostRef, true);
        
        console.log('Post created successfully');
        return newPostRef.key;
    } catch (error) {
        console.error('Error creating post:', error);
        throw error;
    }
}

// Get posts for feed (user's posts + friends' posts)
export async function getFeedPosts(limit = 20) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return [];
        }
        
        // Get user's friends
        const friends = await getFriendsList();
        const friendIds = friends.map(friend => friend.uid);
        
        // Include current user in the list
        const userIds = [currentUserId, ...friendIds];
        
        // Get all posts
        const postsRef = ref(database, 'posts');
        const snapshot = await get(postsRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const allPosts = snapshot.val();
        const feedPosts = [];
        
        // Filter posts from user and friends
        Object.keys(allPosts).forEach(postId => {
            const post = allPosts[postId];
            if (userIds.includes(post.authorId)) {
                feedPosts.push({
                    id: postId,
                    ...post
                });
            }
        });
        
        // Sort by timestamp (newest first)
        feedPosts.sort((a, b) => {
            const timeA = a.createdAt || 0;
            const timeB = b.createdAt || 0;
            return timeB - timeA;
        });
        
        // Limit results
        return feedPosts.slice(0, limit);
    } catch (error) {
        console.error('Error getting feed posts:', error);
        return [];
    }
}

// Listen to feed posts
export function listenToFeedPosts(callback, limit = 20) {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) {
        return () => {};
    }
    
    const postsRef = ref(database, 'posts');
    
    const unsubscribe = onValue(postsRef, async (snapshot) => {
        if (snapshot.exists()) {
            // Get user's friends
            const friends = await getFriendsList();
            const friendIds = friends.map(friend => friend.uid);
            const userIds = [currentUserId, ...friendIds];
            
            const allPosts = snapshot.val();
            const feedPosts = [];
            
            // Filter posts from user and friends
            Object.keys(allPosts).forEach(postId => {
                const post = allPosts[postId];
                if (userIds.includes(post.authorId)) {
                    feedPosts.push({
                        id: postId,
                        ...post
                    });
                }
            });
            
            // Sort by timestamp (newest first)
            feedPosts.sort((a, b) => {
                const timeA = a.createdAt || 0;
                const timeB = b.createdAt || 0;
                return timeB - timeA;
            });
            
            // Limit results
            callback(feedPosts.slice(0, limit));
        } else {
            callback([]);
        }
    });
    
    return unsubscribe;
}

// Like/unlike a post
export async function togglePostLike(postId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        const postRef = ref(database, `posts/${postId}`);
        const postSnapshot = await get(postRef);
        
        if (!postSnapshot.exists()) {
            throw new Error('Post not found');
        }
        
        const post = postSnapshot.val();
        const likes = post.likes || {};
        const isLiked = likes[currentUserId] === true;
        
        if (isLiked) {
            // Unlike the post
            await update(postRef, {
                [`likes/${currentUserId}`]: null,
                likesCount: (post.likesCount || 0) - 1
            });
        } else {
            // Like the post
            await update(postRef, {
                [`likes/${currentUserId}`]: true,
                likesCount: (post.likesCount || 0) + 1
            });
            
            // Add notification for post author (if not self)
            if (post.authorId !== currentUserId) {
                const userProfile = await getUserProfile(currentUserId);
                await addNotification(post.authorId, {
                    type: 'post_like',
                    from: currentUserId,
                    message: `${userProfile.displayName} liked your post`,
                    timestamp: Date.now(),
                    postId: postId
                });
            }
        }
        
        console.log(isLiked ? 'Post unliked' : 'Post liked');
        return !isLiked;
    } catch (error) {
        console.error('Error toggling post like:', error);
        throw error;
    }
}

// Add comment to post
export async function addComment(postId, commentText) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        if (!commentText.trim()) {
            throw new Error('Comment cannot be empty');
        }
        
        // Get user profile
        const userProfile = await getUserProfile(currentUserId);
        
        // Create comment data
        const commentData = {
            authorId: currentUserId,
            authorName: userProfile.displayName,
            authorPhoto: userProfile.photoURL,
            text: commentText.trim(),
            timestamp: serverTimestamp(),
            createdAt: Date.now()
        };
        
        // Add comment to post
        const commentsRef = ref(database, `posts/${postId}/comments`);
        const newCommentRef = push(commentsRef);
        await set(newCommentRef, commentData);
        
        // Update comments count
        const postRef = ref(database, `posts/${postId}`);
        const postSnapshot = await get(postRef);
        const post = postSnapshot.val();
        
        await update(postRef, {
            commentsCount: (post.commentsCount || 0) + 1
        });
        
        // Add notification for post author (if not self)
        if (post.authorId !== currentUserId) {
            await addNotification(post.authorId, {
                type: 'post_comment',
                from: currentUserId,
                message: `${userProfile.displayName} commented on your post`,
                timestamp: Date.now(),
                postId: postId
            });
        }
        
        console.log('Comment added successfully');
        return newCommentRef.key;
    } catch (error) {
        console.error('Error adding comment:', error);
        throw error;
    }
}

// Get post comments
export async function getPostComments(postId) {
    try {
        const commentsRef = ref(database, `posts/${postId}/comments`);
        const snapshot = await get(commentsRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const comments = snapshot.val();
        const commentsList = [];
        
        Object.keys(comments).forEach(commentId => {
            commentsList.push({
                id: commentId,
                ...comments[commentId]
            });
        });
        
        // Sort by timestamp (oldest first)
        commentsList.sort((a, b) => {
            const timeA = a.createdAt || 0;
            const timeB = b.createdAt || 0;
            return timeA - timeB;
        });
        
        return commentsList;
    } catch (error) {
        console.error('Error getting post comments:', error);
        return [];
    }
}

// Listen to post comments
export function listenToPostComments(postId, callback) {
    const commentsRef = ref(database, `posts/${postId}/comments`);
    
    const unsubscribe = onValue(commentsRef, (snapshot) => {
        if (snapshot.exists()) {
            const comments = snapshot.val();
            const commentsList = [];
            
            Object.keys(comments).forEach(commentId => {
                commentsList.push({
                    id: commentId,
                    ...comments[commentId]
                });
            });
            
            // Sort by timestamp (oldest first)
            commentsList.sort((a, b) => {
                const timeA = a.createdAt || 0;
                const timeB = b.createdAt || 0;
                return timeA - timeB;
            });
            
            callback(commentsList);
        } else {
            callback([]);
        }
    });
    
    return unsubscribe;
}

// Delete post
export async function deletePost(postId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        // Check if user is the author
        const postRef = ref(database, `posts/${postId}`);
        const postSnapshot = await get(postRef);
        
        if (!postSnapshot.exists()) {
            throw new Error('Post not found');
        }
        
        const post = postSnapshot.val();
        if (post.authorId !== currentUserId) {
            throw new Error('Can only delete your own posts');
        }
        
        // Delete post
        await remove(postRef);
        
        // Remove from user's posts
        const userPostRef = ref(database, `userPosts/${currentUserId}/${postId}`);
        await remove(userPostRef);
        
        console.log('Post deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting post:', error);
        throw error;
    }
}

// Delete comment
export async function deleteComment(postId, commentId) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        // Check if user is the comment author
        const commentRef = ref(database, `posts/${postId}/comments/${commentId}`);
        const commentSnapshot = await get(commentRef);
        
        if (!commentSnapshot.exists()) {
            throw new Error('Comment not found');
        }
        
        const comment = commentSnapshot.val();
        if (comment.authorId !== currentUserId) {
            throw new Error('Can only delete your own comments');
        }
        
        // Delete comment
        await remove(commentRef);
        
        // Update comments count
        const postRef = ref(database, `posts/${postId}`);
        const postSnapshot = await get(postRef);
        const post = postSnapshot.val();
        
        await update(postRef, {
            commentsCount: Math.max((post.commentsCount || 0) - 1, 0)
        });
        
        console.log('Comment deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting comment:', error);
        throw error;
    }
}

// Get user's posts
export async function getUserPosts(userId, limit = 20) {
    try {
        const userPostsRef = ref(database, `userPosts/${userId}`);
        const snapshot = await get(userPostsRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const userPostIds = Object.keys(snapshot.val());
        const posts = [];
        
        // Get post details for each post ID
        for (const postId of userPostIds) {
            const postRef = ref(database, `posts/${postId}`);
            const postSnapshot = await get(postRef);
            
            if (postSnapshot.exists()) {
                posts.push({
                    id: postId,
                    ...postSnapshot.val()
                });
            }
        }
        
        // Sort by timestamp (newest first)
        posts.sort((a, b) => {
            const timeA = a.createdAt || 0;
            const timeB = b.createdAt || 0;
            return timeB - timeA;
        });
        
        return posts.slice(0, limit);
    } catch (error) {
        console.error('Error getting user posts:', error);
        return [];
    }
}

// Search posts
export async function searchPosts(searchTerm, limit = 20) {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            return [];
        }
        
        // Get feed posts first
        const feedPosts = await getFeedPosts(100); // Get more posts for search
        
        // Filter posts by search term
        const filteredPosts = feedPosts.filter(post => 
            post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
            post.authorName.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        return filteredPosts.slice(0, limit);
    } catch (error) {
        console.error('Error searching posts:', error);
        return [];
    }
}

// Get post by ID
export async function getPostById(postId) {
    try {
        const postRef = ref(database, `posts/${postId}`);
        const snapshot = await get(postRef);
        
        if (snapshot.exists()) {
            return {
                id: postId,
                ...snapshot.val()
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error getting post by ID:', error);
        return null;
    }
}

// Check if user liked a post
export async function hasUserLikedPost(postId, userId = null) {
    try {
        const targetUserId = userId || getCurrentUserId();
        if (!targetUserId) {
            return false;
        }
        
        const likeRef = ref(database, `posts/${postId}/likes/${targetUserId}`);
        const snapshot = await get(likeRef);
        
        return snapshot.exists() && snapshot.val() === true;
    } catch (error) {
        console.error('Error checking if user liked post:', error);
        return false;
    }
}

// Get post likes
export async function getPostLikes(postId) {
    try {
        const likesRef = ref(database, `posts/${postId}/likes`);
        const snapshot = await get(likesRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const likes = snapshot.val();
        const likesList = [];
        
        for (const userId in likes) {
            if (likes[userId] === true) {
                const userProfile = await getUserProfile(userId);
                if (userProfile) {
                    likesList.push({
                        uid: userId,
                        ...userProfile
                    });
                }
            }
        }
        
        return likesList;
    } catch (error) {
        console.error('Error getting post likes:', error);
        return [];
    }
}

