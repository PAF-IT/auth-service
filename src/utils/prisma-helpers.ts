import { GrantIdentifier } from "@jmondi/oauth2-server";
import { Prisma } from "../../generated/prisma/client.js";

// Accept either a real JSON array (the correct shape) or a JSON-encoded
// string (legacy rows from when seed.ts/manage-clients.ts double-encoded).
function coerceArray(value: Prisma.JsonValue): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }
  return [];
}

export function parseJsonStringArray(value: Prisma.JsonValue): string[] {
  return coerceArray(value).filter((v): v is string => typeof v === "string");
}

export function parseAllowedGrants(value: Prisma.JsonValue): GrantIdentifier[] {
  return coerceArray(value).filter((v): v is GrantIdentifier => typeof v === "string");
}

/**
 * Validate that all items in an array are strings
 */
export function validateStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

/**
 * Validate that all items in an array are valid grant identifiers
 */
export function validateGrantArray(value: unknown): value is GrantIdentifier[] {
  const validGrants: GrantIdentifier[] = [
    "authorization_code",
    "client_credentials",
    "refresh_token",
    "password",
    "implicit",
  ];
  return Array.isArray(value) && value.every(item => validGrants.includes(item as GrantIdentifier));
}