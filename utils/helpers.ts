import crypto from "crypto";

/**
 * Generate a random organization code in format: org-xxx-xxx-xxx
 */
export function generateOrgCode(): string {
  const generateSegment = () => {
    return Math.random().toString(36).substring(2, 5);
  };

  return `org-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
}

/**
 * Generate a random password with mix of uppercase, lowercase, numbers, and special characters
 */
export function generateRandomPassword(length: number = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";

  const all = uppercase + lowercase + numbers + special;

  let password = "";
  // Ensure at least one character from each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requires: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
 */
export function isStrongPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate JWT Secret if not provided
 */
export function getJWTSecret(): string {
  return process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
}

/**
 * Get JWT expiration time
 */
export function getJWTExpiration(): string {
  return process.env.JWT_EXPIRATION || "7d";
}

/**
 * Format date to ISO string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse CSV line (simple implementation)
 */
export function parseCSVLine(line: string): string[] {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Sanitize user input to prevent injection
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove angle brackets
    .substring(0, 255); // Limit length
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: string, requiredRole: string | string[]): boolean {
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(userRole);
}

/**
 * Generate random ID
 */
export function generateRandomId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Convert country name to ISO code (basic mapping)
 */
export function getCountryCode(countryName: string): string | null {
  const countryMap: Record<string, string> = {
    India: "IN",
    "United States": "US",
    "United Kingdom": "UK",
    Canada: "CA",
    Australia: "AU",
    Ghana: "GH",
    Kenya: "KE",
    Nigeria: "NG",
    Uganda: "UG",
    Tanzania: "TZ",
    Rwanda: "RW",
    "South Africa": "ZA",
  };

  return countryMap[countryName] || null;
}

/**
 * Delay execution (for testing/scheduling)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (obj instanceof Array) return obj.map((item) => deepClone(item)) as any;
  if (obj instanceof Object) {
    const cloned = {} as T;
    for (const key in obj) {
      cloned[key] = deepClone(obj[key]);
    }
    return cloned;
  }
  return obj;
}

/**
 * Check if value is empty
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Get environment variable safely
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value || defaultValue || "";
}

/**
 * Convert seconds to milliseconds
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Convert milliseconds to seconds
 */
export function msToSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}
