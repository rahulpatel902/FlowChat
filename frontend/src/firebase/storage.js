import api from '../services/api';

// Helper to POST a file to a given upload endpoint with optional extra form fields
const postFile = async (url, file, extraFields = {}, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  Object.entries(extraFields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });

  const response = await api.post(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      const progress = (event.loaded / event.total) * 100;
      onProgress(progress);
    },
  });

  return response.data; // expected shape: { url, public_id }
};

// Upload image (chat image)
export const uploadImage = async (file, roomId, onProgress) => {
  return postFile('/chat/uploads/chat-image/', file, { room_id: roomId }, onProgress);
};

// Upload general chat file
export const uploadChatFile = async (file, roomId, onProgress) => {
  return postFile('/chat/uploads/chat-file/', file, { room_id: roomId }, onProgress);
};

// Upload profile picture
export const uploadProfilePicture = async (file, userId, onProgress) => {
  // userId is not strictly needed by backend (it uses current user), but we keep signature the same
  return postFile('/chat/uploads/profile-picture/', file, {}, onProgress);
};

// Upload group avatar
export const uploadGroupAvatar = async (file, roomId, onProgress) => {
  return postFile('/chat/uploads/group-avatar/', file, { room_id: roomId }, onProgress);
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
  IMAGES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};
