// Small CLI for managing OAuthClient rows from outside the running app.
// Usage:
//   pnpm run client list
//   pnpm run client get <id>
//   pnpm run client upsert --id <id> --secret <secret> --name <name> \
//       --redirect <uri> [--redirect <uri> ...] [--grant <grant> ...]
//   pnpm run client delete <id>
//
// Run against the same MariaDB the app uses (MYSQL_* env vars). For a deployed
// cluster: `kubectl exec deploy/auth-service -- pnpm run client ...`.
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function die(msg: string): never {
  console.error(msg);
  process.exit(2);
}

function parseFlags(argv: string[]): {flags: Record<string, string[]>, positional: string[]} {
  const flags: Record<string, string[]> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[++i];
      if (val === undefined) die(`missing value for --${key}`);
      (flags[key] ??= []).push(val);
    } else {
      positional.push(a);
    }
  }
  return {flags, positional};
}

function one(flags: Record<string, string[]>, name: string): string {
  const v = flags[name];
  if (!v || v.length !== 1) die(`--${name} is required (exactly one value)`);
  return v[0];
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command) die("usage: client <list|get|upsert|delete> [args]");

  const adapter = new PrismaMariaDb({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB_NAME,
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    connectionLimit: 2,
  });
  const prisma = new PrismaClient({adapter});

  try {
    switch (command) {
      case "list": {
        const rows = await prisma.oAuthClient.findMany({
          select: {id: true, name: true, redirectUris: true, allowedGrants: true},
        });
        console.log(JSON.stringify(rows, null, 2));
        break;
      }
      case "get": {
        const [id] = rest;
        if (!id) die("usage: client get <id>");
        const row = await prisma.oAuthClient.findUnique({where: {id}});
        if (!row) die(`no client with id=${id}`);
        console.log(JSON.stringify(row, null, 2));
        break;
      }
      case "upsert": {
        const {flags} = parseFlags(rest);
        const id = one(flags, "id");
        const secret = one(flags, "secret");
        const name = one(flags, "name");
        const redirectUris = flags["redirect"] ?? die("at least one --redirect is required");
        const allowedGrants = flags["grant"] ?? ["custom:magic_link"];
        await prisma.oAuthClient.upsert({
          where: {id},
          update: {
            name, secret,
            redirectUris,
            allowedGrants,
          },
          create: {
            id, name, secret,
            redirectUris,
            allowedGrants,
          },
        });
        console.log(`upserted OAuthClient id=${id}`);
        break;
      }
      case "delete": {
        const [id] = rest;
        if (!id) die("usage: client delete <id>");
        await prisma.oAuthClient.delete({where: {id}});
        console.log(`deleted OAuthClient id=${id}`);
        break;
      }
      default:
        die(`unknown command: ${command}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
