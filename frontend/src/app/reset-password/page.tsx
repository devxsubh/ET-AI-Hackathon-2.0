"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/lib/authApi";
import {
  PASSWORD_REQUIREMENTS,
  validatePasswordClient,
} from "@/lib/passwordPolicy";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing reset token. Request a new link from the sign-in page.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    const passwordError = validatePasswordClient(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset password",
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
        <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
          <SiteLogo size="md" className="md:text-4xl" asLink />
        </div>
        <div className="w-full max-w-md text-center bg-white border border-gray-200 rounded-2xl p-8">
          <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Password updated</h1>
          <p className="text-gray-600">Redirecting to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
      <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
        <SiteLogo size="md" className="md:text-4xl" asLink />
      </div>
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-4">
          <h1 className="text-2xl font-serif mb-2">Choose a new password</h1>
          <p className="text-sm text-gray-600 mb-6">
            Enter a new password for your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                New password
              </label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm password
              </label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <p className="text-xs text-gray-500">{PASSWORD_REQUIREMENTS}</p>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-gray-900 text-white"
            >
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>

          <Link
            href="/forgot-password"
            className="inline-block mt-4 text-sm text-blue-600 hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
