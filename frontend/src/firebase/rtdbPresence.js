import { onValue, onDisconnect, ref, set, serverTimestamp } from 'firebase/database';
import { rtdb } from './config';

// Path helper: status/{uid}
const statusRef = (uid) => ref(rtdb, `status/${uid}`);
// We trust RTDB presence directly. No TTL freshness window is applied.

// Start presence tracking for the given user.
// Uses onDisconnect to flip to offline immediately if the connection drops.
export function startPresence(uid) {
  if (!uid) return () => {};

  // Use connection status to ensure onDisconnect is registered after a connection is established
  const connectedRef = ref(rtdb, '.info/connected');
  // Create a per-tab session key
  const sessionId = `${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const sessionRef = ref(rtdb, `status/${uid}/connections/${sessionId}`);

  const unsubscribe = onValue(connectedRef, (snap) => {
    const isConnected = snap.val() === true;
    if (!isConnected) return; // wait until we have a connection

    try {
      // Remove only this tab's session on unexpected disconnect
      onDisconnect(sessionRef).remove();
      if (process.env.NODE_ENV !== 'production') console.info('[presence] onDisconnect(remove session) registered', { uid, sessionId });
    } catch (e) { if (process.env.NODE_ENV !== 'production') console.warn('[presence] onDisconnect registration failed', e); }

    // Mark this session as connected
    set(sessionRef, {
      connected_at: serverTimestamp(),
    }).then(() => {
      if (process.env.NODE_ENV !== 'production') console.info('[presence] session connected', { uid, sessionId });
    }).catch((e) => { if (process.env.NODE_ENV !== 'production') console.warn('[presence] session connect write FAILED', e); });

    // Optional: update legacy aggregate fields; UI no longer depends on these
    try { set(ref(rtdb, `status/${uid}/state`), 'online'); } catch (_) {}
    try { set(ref(rtdb, `status/${uid}/last_changed`), serverTimestamp()); } catch (_) {}
  });

  // Return a stop function that also detaches the connected listener
  return () => {
    try { unsubscribe(); } catch (_) {}
    // Cancel any pending onDisconnect for this session and remove only this session key
    try { onDisconnect(sessionRef).cancel(); } catch (_) {}
    try { set(sessionRef, null); } catch (_) {}
  };
}

// Explicitly stop presence for a user (e.g., on logout)
export function stopPresence(uid) {
  // In the multi-session model, the returned stopper from startPresence() removes this tab's session.
  // We avoid forcing a global offline state here to not knock other active sessions offline.
  return Promise.resolve();
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
      const lastSeen = typeof data?.last_changed === 'number' ? data.last_changed : null;
      // Multi-session: online if there is at least one active connection child
      const connections = data?.connections && typeof data.connections === 'object' ? Object.keys(data.connections) : [];
      const state = Array.isArray(connections) && connections.length > 0;
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
