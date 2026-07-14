"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Mail } from "lucide-react";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resendVerificationEmail, verifyEmail } from "@/lib/authApi";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [status, setStatus] = useState<"pending" | "success" | "error">(
    token ? "pending" : "error",
  );
  const [message, setMessage] = useState(
    token ? "" : "Missing verification token.",
  );
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await verifyEmail(token);
        if (cancelled) return;
        setStatus("success");
        setMessage(result.message);
        setTimeout(() => router.replace("/login"), 2500);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "Verification failed",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendLoading(true);
    setResendMessage(null);
    try {
      const result = await resendVerificationEmail(resendEmail.trim());
      setResendMessage(result.message);
    } catch (err) {
      setResendMessage(
        err instanceof Error ? err.message : "Failed to resend email",
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
      <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
        <SiteLogo size="md" className="md:text-4xl" asLink />
      </div>
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm text-center">
          {status === "pending" && (
            <>
              <Mail className="h-8 w-8 text-gray-500 mx-auto mb-4" />
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Verifying email…
              </h1>
              <p className="text-gray-600">Please wait a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-4" />
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Email verified
              </h1>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500 mt-3">
                Redirecting to sign in…
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Verification link invalid
              </h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <form onSubmit={handleResend} className="space-y-3 text-left">
                <label
                  htmlFor="resendEmail"
                  className="block text-sm font-medium text-gray-700"
                >
                  Resend verification email
                </label>
                <Input
                  id="resendEmail"
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
                {resendMessage && (
                  <p className="text-sm text-gray-600">{resendMessage}</p>
                )}
                <Button
                  type="submit"
                  disabled={resendLoading}
                  className="w-full bg-black hover:bg-gray-900 text-white"
                >
                  {resendLoading ? "Sending…" : "Resend verification email"}
                </Button>
              </form>
              <Link
                href="/login"
                className="inline-block mt-4 text-sm text-blue-600 hover:underline"
              >
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
