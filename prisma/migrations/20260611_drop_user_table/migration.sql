-- Drop the auth-service-owned `User` table. Member lookups now come from the
-- `members` table owned by paf-admin (read-only, no Prisma migration manages it).
-- OAuthAuthCode.userId and OAuthToken.userId stay as VARCHAR(32) with no FK,
-- holding a stringified member id.

-- DropForeignKey
ALTER TABLE `OAuthAuthCode` DROP FOREIGN KEY `OAuthAuthCode_userId_fkey`;

-- DropForeignKey
ALTER TABLE `OAuthToken` DROP FOREIGN KEY `OAuthToken_userId_fkey`;

-- DropTable
DROP TABLE `User`;
