export type NativeBackHandler = () => boolean | Promise<boolean>;

declare global {
    interface Window {
        __NOTIVE_NATIVE_BACK_HANDLER__?: NativeBackHandler;
    }
}

export const getNativeBackHandler = (): NativeBackHandler | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.__NOTIVE_NATIVE_BACK_HANDLER__ || null;
};

export const setNativeBackHandler = (handler: NativeBackHandler | null) => {
    if (typeof window === 'undefined') {
        return;
    }

    if (handler) {
        window.__NOTIVE_NATIVE_BACK_HANDLER__ = handler;
        return;
    }

    delete window.__NOTIVE_NATIVE_BACK_HANDLER__;
};
