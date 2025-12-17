import "dotenv/config";
import {env} from "prisma/config";
import { PrismaClient } from "../generated/prisma/client.js";
import {PrismaMariaDb} from "@prisma/adapter-mariadb";


let adapter : PrismaMariaDb;
let prisma : PrismaClient;

async function main() {
  try {
    const adapterOptions = {
      host: env("DATABASE_HOST") || 'localhost',
      user: env("DATABASE_USER"),
      password: env("DATABASE_PASSWORD"),
      database: env("DATABASE_NAME"),
      port: parseInt(env("DATABASE_PORT") || '3306'),
      connectionLimit: 10
    };

    adapter = new PrismaMariaDb(adapterOptions);
    prisma = new PrismaClient({adapter});

    // Create a test client
    await prisma.oAuthClient.upsert({
      where: {id: "test-client-id"},
      update: {},
      create: {
        id: "test-client-id",
        name: "Test Client",
        secret: "test-client-secret",
        redirectUris: JSON.stringify(["http://localhost:3000/callback"]),
        allowedGrants: JSON.stringify(["custom:magic_link"]),
      },
    });

    // Create a test user
    await prisma.user.upsert({
      where: {email: "test@example.com"},
      update: {},
      create: {
        id: "test-user-id",
        email: "test@example.com",
        passwordHash: "$2a$10$dummyhashfortest", // This is a dummy hash
      },
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });