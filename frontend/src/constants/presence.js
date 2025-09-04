// Centralized presence timing constants
// Adjust these in one place to control presence behavior across the app.

export const HEARTBEAT_MS = 30_000;         // Current user keep-alive interval
export const PRESENCE_TTL_MS = 90_000;      // Consider offline if lastSeen older than this
export const RECOMPUTE_INTERVAL_MS = 15_000; // How often to re-evaluate freshness client-side
