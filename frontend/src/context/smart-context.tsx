'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ActivityType = 'coding' | 'exercise' | 'reading' | 'meeting' | 'traveling' | 'relaxing' | 'unknown';

interface ContextState {
    activity: ActivityType;
    location: string | null;
    weather: string | null;
    lastActive: Date;
    setActivity: (activity: ActivityType) => void;
    simulateEvent: (event: string) => void;
}

const SmartContext = createContext<ContextState | undefined>(undefined);

export function SmartProvider({ children }: { children: ReactNode }) {
    const [activity, setActivity] = useState<ActivityType>('unknown');
    const [location, setLocation] = useState<string | null>(null);
    const [weather, setWeather] = useState<string | null>(null);
    const [lastActive, setLastActive] = useState<Date>(new Date());

    // Simulate context detection (e.g., based on time of day)
    useEffect(() => {
        const detectContext = () => {
            const hour = new Date().getHours();
            if (hour >= 9 && hour <= 17) {
                // setActivity('working'); // 'working' not in type, let's use 'coding' or 'meeting'
            }
        };

        detectContext();

        // In a real app, we'd use Geolocation API and maybe some other sensors
        // navigator.geolocation.getCurrentPosition(...)
    }, []);

    const simulateEvent = (event: string) => {
        // This function will be used to trigger prompts manually for demo
        window.dispatchEvent(new CustomEvent('smart-prompt', { detail: { message: event } }));
    };

    return (
        <SmartContext.Provider value={{ activity, location, weather, lastActive, setActivity, simulateEvent }}>
            {children}
        </SmartContext.Provider>
    );
}

export function useSmartContext() {
    const context = useContext(SmartContext);
    if (context === undefined) {
        throw new Error('useSmartContext must be used within a SmartProvider');
    }
    return context;
}
