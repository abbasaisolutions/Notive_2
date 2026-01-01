// Centralized application configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Performance settings
export const DEBOUNCE_DELAY = 500;
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Display settings
export const MAX_ENTRY_PREVIEW_LENGTH = 100;
export const DEFAULT_ENTRIES_PER_PAGE = 20;
export const MAX_RECENT_ENTRIES = 6;
export const MAX_TOP_THEMES = 5;
export const MAX_GRATITUDE_ITEMS = 5;

// Date settings
export const MS_PER_DAY = 86400000; // 24 * 60 * 60 * 1000

// Gamification
export const XP_PER_ENTRY = 10;
export const XP_PER_STREAK_DAY = 5;
export const STREAK_GOAL = 7;
