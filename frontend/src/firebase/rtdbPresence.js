import { onValue, onDisconnect, ref, set, serverTimestamp } from 'firebase/database';
import { rtdb } from './config';

// Path helper: status/{uid}
const statusRef = (uid) => ref(rtdb, `status/${uid}`);

// Start presence tracking for the given user.
// Uses onDisconnect to flip to offline immediately if the connection drops.
export function startPresence(uid) {
  if (!uid) return () => {};

  // Set the onDisconnect offline write first so it always executes if socket drops
  try {
    onDisconnect(statusRef(uid)).set({
      state: 'offline',
      last_changed: serverTimestamp(),
    });
  } catch (_) {}

  // Mark online immediately
  set(statusRef(uid), {
    state: 'online',
    last_changed: serverTimestamp(),
  }).catch(() => {});

  // Return a minimal stop function; the actual stopPresence is a stronger explicit API
  return () => stopPresence(uid);
}

// Explicitly stop presence for a user (e.g., on logout)
export function stopPresence(uid) {
  if (!uid) return;
  set(statusRef(uid), {
    state: 'offline',
    last_changed: serverTimestamp(),
  }).catch(() => {});
}

// Subscribe to presence for an array of userIds.
// Callback receives a map: { [uid: string]: { isOnline: boolean, lastSeen: number | null } }
export function subscribeToPresence(userIds, callback) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    callback({});
    return () => {};
  }

  const unsubs = [];
  const latest = new Map(); // uid -> { state, last_changed }

  const emit = () => {
    const out = {};
    for (const uid of userIds.map(String)) {
      const data = latest.get(uid);
      const state = data?.state === 'online';
      const lastSeen = typeof data?.last_changed === 'number' ? data.last_changed : null;
      out[uid] = { isOnline: state, lastSeen };
    }
    callback(out);
  };

  for (const uid of userIds.map(String)) {
    const unsubscribe = onValue(statusRef(uid), (snap) => {
      latest.set(uid, snap.val() || null);
      emit();
    });
    unsubs.push(() => unsubscribe());
  }

  return () => {
    unsubs.forEach((u) => {
      try { u(); } catch (_) {}
    });
  };
}
