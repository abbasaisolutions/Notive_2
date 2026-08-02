/**
 * Requires a brand-new account to save at least one memory before it can use
 * the rest of the app. Scoped to accounts created on/after the rollout date so
 * existing accounts with zero entries today are never retroactively gated.
 */

const FIRST_MEMORY_GATE_KEY_PREFIX = 'notive_first_memory_v1';

// Only accounts created on/after this date are subject to the gate.
export const FIRST_MEMORY_GATE_LAUNCH_DATE = new Date('2026-07-26T00:00:00.000Z');

type GateUser = {
    createdAt?: string | null;
};

export function requiresFirstMemoryGate(user: GateUser | null | undefined): boolean {
    if (!user?.createdAt) return false;
    const createdAt = new Date(user.createdAt);
    if (Number.isNaN(createdAt.getTime())) return false;
    return createdAt >= FIRST_MEMORY_GATE_LAUNCH_DATE;
}

const getFirstMemoryGateKey = (userId: string) => `${FIRST_MEMORY_GATE_KEY_PREFIX}_${userId}`;

export function hasSatisfiedFirstMemoryGate(userId: string | null | undefined): boolean {
    if (!userId || typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(getFirstMemoryGateKey(userId)) === 'satisfied';
    } catch {
        return false;
    }
}

export function markFirstMemorySatisfied(userId: string | null | undefined): void {
    if (!userId || typeof window === 'undefined') return;
    try {
        localStorage.setItem(getFirstMemoryGateKey(userId), 'satisfied');
    } catch {
        // Best-effort only — worst case the guard re-checks the backend next time.
    }
}
