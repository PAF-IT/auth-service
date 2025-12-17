import { GrantIdentifier } from "@jmondi/oauth2-server";
import { Prisma } from "../../generated/prisma/client.js";

/**
 * Safely parse redirectUris from Prisma JSON field to string array
 */
export function parseRedirectUris(value: Prisma.JsonValue): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

/**
 * Safely parse allowedGrants from Prisma JSON field to GrantIdentifier array
 */
export function parseAllowedGrants(value: Prisma.JsonValue): GrantIdentifier[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is GrantIdentifier => typeof v === "string");
  }
  return [];
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