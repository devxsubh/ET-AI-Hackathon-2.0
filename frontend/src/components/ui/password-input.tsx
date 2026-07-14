"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type"
>;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={revealed ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setRevealed((value) => !value)}
        className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
        aria-label={revealed ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {revealed ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
