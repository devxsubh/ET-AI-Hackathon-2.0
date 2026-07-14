"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    type ReactNode,
} from "react";
import { useSidebar } from "@/app/contexts/SidebarContext";
import {
    createTourDriver,
    hasCompletedTour,
    markTourCompleted,
} from "@/lib/onboardingTour";
import type { Driver } from "driver.js";
import "driver.js/dist/driver.css";

interface OnboardingTourContextValue {
    startTour: (opts?: { force?: boolean }) => void;
}

const OnboardingTourContext =
    createContext<OnboardingTourContextValue | null>(null);

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
    const { setSidebarOpen } = useSidebar();
    const driverRef = useRef<Driver | null>(null);
    const startedRef = useRef(false);

    const startTour = useCallback(
        (opts?: { force?: boolean }) => {
            if (!opts?.force && hasCompletedTour()) return;

            setSidebarOpen(true);

            window.setTimeout(() => {
                driverRef.current?.destroy();
                const tour = createTourDriver({
                    onComplete: markTourCompleted,
                });
                driverRef.current = tour;
                tour.drive();
            }, 450);
        },
        [setSidebarOpen],
    );

    useEffect(() => {
        if (startedRef.current || hasCompletedTour()) return;
        startedRef.current = true;

        const timer = window.setTimeout(() => startTour(), 900);
        return () => window.clearTimeout(timer);
    }, [startTour]);

    useEffect(() => {
        return () => {
            driverRef.current?.destroy();
        };
    }, []);

    return (
        <OnboardingTourContext.Provider value={{ startTour }}>
            {children}
        </OnboardingTourContext.Provider>
    );
}

export function useOnboardingTour(): OnboardingTourContextValue {
    const ctx = useContext(OnboardingTourContext);
    if (!ctx) {
        throw new Error(
            "useOnboardingTour must be used within OnboardingTourProvider",
        );
    }
    return ctx;
}
