import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatTime(date) {
  if (!date) return '';

  // Support Firestore Timestamp objects
  let messageDate;
  try {
    if (typeof date?.toDate === 'function') {
      messageDate = date.toDate();
    } else if (typeof date === 'object' && 'seconds' in date && typeof date.seconds === 'number') {
      messageDate = new Date(date.seconds * 1000);
    } else {
      messageDate = new Date(date);
    }
  } catch (_) {
    return '';
  }

  if (isNaN(messageDate?.getTime?.())) return '';

  // Always show only time (no weekday/date)
  return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getInitials(name) {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}


export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
