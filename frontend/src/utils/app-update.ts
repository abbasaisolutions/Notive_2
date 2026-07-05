export interface AppUpdateConfig {
    minimumVersion?: string;
    updateUrl?: string;
    packageName?: string;
}

export interface AppUpdatePolicyResponse {
    android?: AppUpdateConfig;
}

const parseVersion = (value?: string | null): number[] => {
    if (!value) return [];

    return value
        .split('.')
        .map((part) => Number.parseInt(part, 10))
        .filter((part) => Number.isFinite(part));
};

export const compareVersions = (left?: string | null, right?: string | null): number => {
    const leftParts = parseVersion(left);
    const rightParts = parseVersion(right);
    const maxLength = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftValue = leftParts[index] ?? 0;
        const rightValue = rightParts[index] ?? 0;

        if (leftValue > rightValue) return 1;
        if (leftValue < rightValue) return -1;
    }

    return 0;
};

export const shouldPromptForUpdate = (
    installedVersion?: string | null,
    config?: AppUpdateConfig,
): boolean => {
    const minimumVersion = config?.minimumVersion?.trim();
    if (!minimumVersion) return false;

    return compareVersions(installedVersion, minimumVersion) < 0;
};

export const getPlayStoreUpdateUrl = (config?: AppUpdateConfig): string => {
    if (config?.updateUrl) return config.updateUrl;

    const packageName = config?.packageName?.trim();
    if (!packageName) return 'https://play.google.com/store/apps/details?id=com.notive.app';

    return `https://play.google.com/store/apps/details?id=${packageName}`;
};

export const getPlayStoreIntentUrl = (config?: AppUpdateConfig): string => {
    const packageName = config?.packageName?.trim();
    if (!packageName) return 'market://details?id=com.notive.app';

    return `market://details?id=${packageName}`;
};

export const fetchAndroidUpdateConfig = async (apiUrl: string): Promise<AppUpdateConfig | null> => {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/app-update`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
    });

    if (!response.ok) return null;

    const data = await response.json() as AppUpdatePolicyResponse;
    return data.android ?? null;
};
