"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resendVerificationEmail, signIn } from "@/lib/authApi";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";

export default function LoginPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading, refreshUser } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsVerification, setNeedsVerification] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMessage, setResendMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setNeedsVerification(false);
        setResendMessage(null);

        try {
            await signIn(email, password);
            await refreshUser();
            router.push("/assistant");
        } catch (err: unknown) {
            const message =
                err instanceof Error
                    ? err.message
                    : "An error occurred during login";
            setError(message);
            setNeedsVerification(
                message.toLowerCase().includes("email not verified"),
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-4">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-left text-2xl font-serif">
                            Log In
                        </h2>
                        <div className="bg-gray-100 p-1 rounded-md flex text-xs font-medium">
                            <span className="text-gray-600 px-3 py-1 bg-white rounded-sm shadow-sm">
                                Log in
                            </span>
                            <Link
                                href="/signup"
                                className="px-3 py-1 text-gray-500 hover:text-gray-900"
                            >
                                Sign up
                            </Link>
                        </div>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Password
                                </label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <PasswordInput
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                className="w-full"
                            />
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm bg-red-50 p-3 rounded space-y-2">
                                <p>{error}</p>
                                {needsVerification && (
                                    <button
                                        type="button"
                                        disabled={resendLoading || !email.trim()}
                                        onClick={async () => {
                                            setResendLoading(true);
                                            setResendMessage(null);
                                            try {
                                                const result =
                                                    await resendVerificationEmail(
                                                        email.trim(),
                                                    );
                                                setResendMessage(result.message);
                                            } catch (resendErr) {
                                                setResendMessage(
                                                    resendErr instanceof Error
                                                        ? resendErr.message
                                                        : "Failed to resend email",
                                                );
                                            } finally {
                                                setResendLoading(false);
                                            }
                                        }}
                                        className="text-blue-700 underline disabled:opacity-50"
                                    >
                                        {resendLoading
                                            ? "Sending verification email…"
                                            : "Resend verification email"}
                                    </button>
                                )}
                                {resendMessage && (
                                    <p className="text-gray-700">{resendMessage}</p>
                                )}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-5 bg-black hover:bg-gray-900 text-white"
                        >
                            {loading ? "Logging in..." : "Log in"}
                        </Button>
                    </form>
                </div>
                <p className="text-center text-xs text-gray-500 leading-relaxed px-2">
                    Authentication is required. Cap-table and screening data is
                    scoped to your account and must not be shared outside your
                    organisation.
                </p>
            </div>
        </div>
    );
}
