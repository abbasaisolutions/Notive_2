/**
 * Location Context Service
 *
 * Captures device location when writing entries (opt-in).
 * Uses Capacitor Geolocation plugin on mobile, browser API on web.
 * Reverse geocodes via Nominatim (OpenStreetMap, free, no API key).
 */

import { Geolocation } from '@capacitor/geolocation';

export type EntryLocation = {
    lat: number;
    lng: number;
    name: string;
};

const GEOCODE_CACHE = new Map<string, string>();
const GEOCODE_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

/**
 * Check if location permissions are available.
 */
export async function checkLocationPermission(): Promise<boolean> {
    try {
        const status = await Geolocation.checkPermissions();
        return status.location === 'granted' || status.coarseLocation === 'granted';
    } catch {
        return false;
    }
}

/**
 * Request location permission from the user.
 */
export async function requestLocationPermission(): Promise<boolean> {
    try {
        const status = await Geolocation.requestPermissions();
        return status.location === 'granted' || status.coarseLocation === 'granted';
    } catch {
        return false;
    }
}

/**
 * Get current location with reverse geocoding.
 * Returns null if permission denied or unavailable.
 */
export async function captureEntryLocation(): Promise<EntryLocation | null> {
    try {
        const hasPermission = await checkLocationPermission();
        if (!hasPermission) return null;

        const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false, // coarse is fine, saves battery
            timeout: 5000,
        });

        const { latitude, longitude } = position.coords;
        const name = await reverseGeocode(latitude, longitude);

        return { lat: latitude, lng: longitude, name };
    } catch {
        return null;
    }
}

/**
 * Reverse geocode coordinates to a place name using Nominatim (free).
 * Returns a human-readable place name like "Home", "Library", "Downtown".
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
    // Round to ~100m precision for cache key
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;

    const cached = GEOCODE_CACHE.get(cacheKey);
    if (cached) return cached;

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
            {
                headers: { 'User-Agent': 'Notive/1.0 (journal app)' },
            }
        );

        if (!response.ok) return 'Unknown location';

        const data = await response.json();
        const name = extractPlaceName(data);

        GEOCODE_CACHE.set(cacheKey, name);
        // Auto-expire cache
        setTimeout(() => GEOCODE_CACHE.delete(cacheKey), GEOCODE_CACHE_TTL);

        return name;
    } catch {
        return 'Unknown location';
    }
}

/**
 * Extract a concise, meaningful place name from Nominatim response.
 * Priority: amenity > building > neighbourhood > suburb > city
 */
function extractPlaceName(data: {
    address?: {
        amenity?: string;
        building?: string;
        shop?: string;
        leisure?: string;
        office?: string;
        school?: string;
        university?: string;
        library?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
    };
    display_name?: string;
}): string {
    const addr = data.address;
    if (!addr) return data.display_name?.split(',')[0] ?? 'Unknown location';

    // Specific places first
    const specific =
        addr.amenity || addr.building || addr.shop || addr.leisure ||
        addr.office || addr.school || addr.university || addr.library;
    if (specific) return specific;

    // Neighbourhood / area
    if (addr.neighbourhood) return addr.neighbourhood;
    if (addr.suburb) return addr.suburb;

    // City level
    return addr.city || addr.town || addr.village || addr.county || 'Unknown location';
}

/**
 * Location preference key in localStorage.
 */
const LOCATION_PREF_KEY = 'notive_location_enabled';

export function isLocationTrackingEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(LOCATION_PREF_KEY) === 'true';
}

export function setLocationTrackingEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCATION_PREF_KEY, String(enabled));
}
