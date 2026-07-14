"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push("/");
        }
    }, [isAuthenticated, authLoading, router]);

    if (authLoading) {
        return (
            <div className="h-dvh bg-white flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <header className="mx-auto flex h-16 w-full max-w-2xl shrink-0 items-end px-6 pb-2 md:h-24 md:pb-4">
                <h1 className="text-4xl font-medium font-eb-garamond">
                    Settings
                </h1>
            </header>

            <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-10 pt-4 md:pt-6">
                {children}
            </main>
        </div>
    );
}
