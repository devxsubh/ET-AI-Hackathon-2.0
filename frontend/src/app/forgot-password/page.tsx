"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/lib/authApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await forgotPassword(email.trim());
      setMessage(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset email",
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
          <h1 className="text-2xl font-serif mb-2">Reset password</h1>
          <p className="text-sm text-gray-600 mb-6">
            Enter your account email and we&apos;ll send a reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            {message && (
              <div className="text-green-700 text-sm bg-green-50 p-3 rounded">
                {message}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-gray-900 text-white"
            >
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>

          <Link
            href="/login"
            className="inline-block mt-4 text-sm text-blue-600 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
