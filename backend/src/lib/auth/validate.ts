const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PASSWORD_RULES = [
  {
    test: (p: string) => p.length >= 12,
    message: "Password must be at least 12 characters",
  },
  {
    test: (p: string) => /[a-z]/.test(p),
    message: "Password must include a lowercase letter",
  },
  {
    test: (p: string) => /[A-Z]/.test(p),
    message: "Password must include an uppercase letter",
  },
  {
    test: (p: string) => /[0-9]/.test(p),
    message: "Password must include a number",
  },
  {
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
    message: "Password must include a special character",
  },
] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) {
    return "A valid email address is required";
  }
  if (!EMAIL_RE.test(normalized)) {
    return "A valid email address is required";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) return rule.message;
  }
  return null;
}
