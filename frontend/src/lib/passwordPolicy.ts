export const PASSWORD_REQUIREMENTS =
  "At least 12 characters with uppercase, lowercase, a number, and a special character.";

export function validatePasswordClient(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include a number";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a special character";
  }
  return null;
}
