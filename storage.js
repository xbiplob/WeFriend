// Firebase Storage imports
import { 
    ref as storageRef, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject,
    uploadBytesResumable,
    getMetadata
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js';

import { storage } from './firebase-config.js';
import { getCurrentUserId } from './auth.js';

// Upload image to Firebase Storage
export async function uploadImage(file, folder = 'images') {
    try {
        const currentUserId = getCurrentUserId();
        if (!currentUserId) {
            throw new Error('User not authenticated');
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }
        
        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new Error('File size must be less than 5MB');
        }
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2);
        const fileExtension = file.name.split('.').pop();
        const fileName = `${timestamp}_${randomString}.${fileExtension}`;
        
        // Create storage reference
        const imageRef = storageRef(storage, `${folder}/${currentUserId}/${fileName}`);
        
        // Upload file
        const snapshot = await uploadBytes(imageRef, file);
        
        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        console.log('Image uploaded successfully:', downloadURL);
        
        return {
            url: downloadURL,
            path: snapshot.ref.fullPath,
            name: fileName,
            size: file.size,
            type: file.type
        };
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

// Upload image with progress tracking
export function uploadImageWithProgress(file, folder = 'images', onProgress) {
    return new Promise((resolve, reject) => {
        try {
            const currentUserId = getCurrentUserId();
            if (!currentUserId) {
                reject(new Error('User not authenticated'));
                return;
            }
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                reject(new Error('File must be an image'));
                return;
            }
            
            // Validate file size (max 5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                reject(new Error('File size must be less than 5MB'));
                return;
            }
            
            // Generate unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2);
            const fileExtension = file.name.split('.').pop();
            const fileName = `${timestamp}_${randomString}.${fileExtension}`;
            
            // Create storage reference
            const imageRef = storageRef(storage, `${folder}/${currentUserId}/${fileName}`);
            
            // Create upload task
            const uploadTask = uploadBytesResumable(imageRef, file);
            
            // Listen for state changes, errors, and completion
            uploadTask.on('state_changed',
                (snapshot) => {
                    // Progress tracking
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) {
                        onProgress(progress);
                    }
                },
                (error) => {
                    // Handle errors
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    // Upload completed successfully
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        
                        resolve({
                            url: downloadURL,
                            path: uploadTask.snapshot.ref.fullPath,
                            name: fileName,
                            size: file.size,
                            type: file.type
                        });
                    } catch (error) {
                        reject(error);
                    }
                }
            );
        } catch (error) {
            reject(error);
        }
    });
}

// Delete image from Firebase Storage
export async function deleteImage(imagePath) {
    try {
        const imageRef = storageRef(storage, imagePath);
        await deleteObject(imageRef);
        
        console.log('Image deleted successfully');
        return true;
    } catch (error) {
        console.error('Error deleting image:', error);
        throw error;
    }
}

// Get image metadata
export async function getImageMetadata(imagePath) {
    try {
        const imageRef = storageRef(storage, imagePath);
        const metadata = await getMetadata(imageRef);
        
        return metadata;
    } catch (error) {
        console.error('Error getting image metadata:', error);
        throw error;
    }
}

// Resize image before upload (client-side)
export function resizeImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            
            // Set canvas dimensions
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress image
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(resolve, file.type, quality);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Upload profile picture
export async function uploadProfilePicture(file) {
    try {
        // Resize image before upload
        const resizedFile = await resizeImage(file, 400, 400, 0.9);
        
        // Upload to profile-pictures folder
        const result = await uploadImage(resizedFile, 'profile-pictures');
        
        console.log('Profile picture uploaded successfully');
        return result;
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        throw error;
    }
}

// Upload post image
export async function uploadPostImage(file) {
    try {
        // Resize image before upload
        const resizedFile = await resizeImage(file, 1200, 1200, 0.8);
        
        // Upload to post-images folder
        const result = await uploadImage(resizedFile, 'post-images');
        
        console.log('Post image uploaded successfully');
        return result;
    } catch (error) {
        console.error('Error uploading post image:', error);
        throw error;
    }
}

// Generate thumbnail
export function generateThumbnail(file, width = 200, height = 200) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            canvas.width = width;
            canvas.height = height;
            
            // Calculate crop dimensions to maintain aspect ratio
            const aspectRatio = img.width / img.height;
            const targetAspectRatio = width / height;
            
            let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;
            
            if (aspectRatio > targetAspectRatio) {
                // Image is wider than target
                sourceWidth = img.height * targetAspectRatio;
                sourceX = (img.width - sourceWidth) / 2;
            } else {
                // Image is taller than target
                sourceHeight = img.width / targetAspectRatio;
                sourceY = (img.height - sourceHeight) / 2;
            }
            
            ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
            
            canvas.toBlob(resolve, 'image/jpeg', 0.8);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Validate image file
export function validateImageFile(file) {
    const errors = [];
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        errors.push('File must be an image');
    }
    
    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        errors.push('File size must be less than 5MB');
    }
    
    // Check supported formats
    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedFormats.includes(file.type)) {
        errors.push('Supported formats: JPEG, PNG, GIF, WebP');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// Get file size in human readable format
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

