import { 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  listAll
} from 'firebase/storage';
import { storage } from './config';

// Upload file with progress tracking
export const uploadFile = (file, path, onProgress) => {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) {
          onProgress(progress);
        }
      },
      (error) => {
        console.error('Upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            url: downloadURL,
            path: path,
            name: file.name,
            size: file.size,
            type: file.type
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};

// Upload image with compression
export const uploadImage = async (file, roomId, onProgress) => {
  const timestamp = Date.now();
  const path = `chat_images/${roomId}/${timestamp}_${file.name}`;
  return uploadFile(file, path, onProgress);
};

// Upload general file
export const uploadChatFile = async (file, roomId, onProgress) => {
  const timestamp = Date.now();
  const path = `chat_files/${roomId}/${timestamp}_${file.name}`;
  return uploadFile(file, path, onProgress);
};

// Upload profile picture
export const uploadProfilePicture = async (file, userId, onProgress) => {
  const timestamp = Date.now();
  const path = `profile_pictures/${userId}/${timestamp}_${file.name}`;
  return uploadFile(file, path, onProgress);
};


// Validate file type and size
export const validateFile = (file, maxSizeMB = 10, allowedTypes = []) => {
  const errors = [];
  
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    errors.push(`File size must be less than ${maxSizeMB}MB`);
  }
  
  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Common file type groups
export const FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};
