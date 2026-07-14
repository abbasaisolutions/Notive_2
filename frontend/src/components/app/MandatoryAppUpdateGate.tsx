'use client';

import { useEffect, useMemo, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { motion } from 'framer-motion';
import packageJson from '../../../package.json';
import { isNativeCapacitorPlatform } from '@/utils/sso';
import { getApiUrl } from '@/constants/config';
import {
    fetchAndroidUpdateConfig,
    getPlayStoreIntentUrl,
    getPlayStoreUpdateUrl,
    shouldPromptForUpdate,
    type AppUpdateConfig,
} from '@/utils/app-update';

interface MandatoryAppUpdateGateProps {
    installedVersion?: string;
    minimumVersion?: string;
    updateUrl?: string;
    packageName?: string;
}

const DEFAULT_MINIMUM_VERSION = process.env.NEXT_PUBLIC_MINIMUM_APP_VERSION || '1.0.0';
const DEFAULT_PACKAGE_NAME = process.env.NEXT_PUBLIC_PLAY_STORE_PACKAGE_NAME || 'com.notive.app';
const UPDATE_POLICY_REFRESH_MS = 6 * 60 * 60 * 1000;

export default function MandatoryAppUpdateGate({
    installedVersion = packageJson.version,
    minimumVersion = DEFAULT_MINIMUM_VERSION,
    updateUrl,
    packageName = DEFAULT_PACKAGE_NAME,
}: MandatoryAppUpdateGateProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLaunching, setIsLaunching] = useState(false);
    const [resolvedVersion, setResolvedVersion] = useState(installedVersion ?? packageJson.version);
    const [updateConfig, setUpdateConfig] = useState<AppUpdateConfig>({
        minimumVersion,
        updateUrl,
        packageName,
    });

    useEffect(() => {
        let isCancelled = false;

        const resolveInstalledVersion = async () => {
            if (!isNativeCapacitorPlatform()) {
                if (!isCancelled) {
                    setResolvedVersion(installedVersion ?? packageJson.version);
                }
                return;
            }

            try {
                const appInfo = await CapacitorApp.getInfo();
                if (!isCancelled) {
                    setResolvedVersion(appInfo.version || installedVersion || packageJson.version);
                }
            } catch {
                if (!isCancelled) {
                    setResolvedVersion(installedVersion ?? packageJson.version);
                }
            }
        };

        void resolveInstalledVersion();

        return () => {
            isCancelled = true;
        };
    }, [installedVersion]);

    useEffect(() => {
        setUpdateConfig({
            minimumVersion,
            updateUrl,
            packageName,
        });
    }, [minimumVersion, packageName, updateUrl]);

    useEffect(() => {
        if (!isNativeCapacitorPlatform()) return;

        let isCancelled = false;

        const loadLiveUpdatePolicy = async () => {
            try {
                const liveConfig = await fetchAndroidUpdateConfig(getApiUrl());
                if (!isCancelled && liveConfig) {
                    setUpdateConfig({
                        minimumVersion: liveConfig.minimumVersion || minimumVersion,
                        updateUrl: liveConfig.updateUrl || updateUrl,
                        packageName: liveConfig.packageName || packageName,
                    });
                }
            } catch {
                // The bundled minimum version remains the offline fallback.
            }
        };

        void loadLiveUpdatePolicy();
        const intervalId = window.setInterval(loadLiveUpdatePolicy, UPDATE_POLICY_REFRESH_MS);
        let removeAppStateListener: (() => void) | undefined;

        void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
            if (isActive) void loadLiveUpdatePolicy();
        }).then((listener) => {
            removeAppStateListener = () => {
                void listener.remove();
            };
        });

        return () => {
            isCancelled = true;
            window.clearInterval(intervalId);
            removeAppStateListener?.();
        };
    }, [minimumVersion, packageName, updateUrl]);

    const shouldShow = useMemo(() => {
        if (!isNativeCapacitorPlatform()) return false;
        return shouldPromptForUpdate(resolvedVersion, updateConfig);
    }, [resolvedVersion, updateConfig]);

    useEffect(() => {
        setIsOpen(shouldShow);
    }, [shouldShow]);

    const handleUpdate = async () => {
        setIsLaunching(true);
        const storeUrl = getPlayStoreUpdateUrl(updateConfig);
        const intentUrl = getPlayStoreIntentUrl(updateConfig);

        try {
            if (typeof window !== 'undefined') {
                window.location.assign(intentUrl);
                window.setTimeout(() => {
                    if (document.visibilityState !== 'hidden') {
                        window.location.assign(storeUrl);
                    }
                }, 900);
            }
        } catch {
            if (typeof window !== 'undefined') {
                window.location.assign(storeUrl);
            }
        } finally {
            setIsLaunching(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(20,18,16,0.72)] px-4 py-6">
            <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-md rounded-card-175 border border-[rgba(122,112,98,0.2)] bg-[rgb(248,244,237)] p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[rgb(var(--brand))]">
                            Update required
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[rgb(39,35,31)]">
                            A newer version of Notive is ready
                        </h2>
                    </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-[rgb(76,70,62)]">
                    This version is no longer supported. Update now to keep using Notive with the latest fixes and the smoothest experience.
                </p>

                <div className="mt-6 rounded-card-125 border border-[rgba(122,112,98,0.16)] bg-white/70 p-4">
                    <p className="text-sm font-semibold text-[rgb(39,35,31)]">What happens next</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-[rgb(76,70,62)]">
                        <li>• You’ll be taken to the Play Store to install the latest version.</li>
                        <li>• The update is required before you can continue using the app.</li>
                    </ul>
                </div>

                <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={isLaunching}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-card-120 bg-[rgb(var(--brand))] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isLaunching ? 'Opening Play Store…' : 'Update now'}
                </button>
            </motion.div>
        </div>
    );
}
