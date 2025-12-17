-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(32) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `idx_user_email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthClient` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `secret` VARCHAR(255) NULL,
    `redirectUris` JSON NOT NULL,
    `allowedGrants` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oauthClient_oauthScope` (
    `clientId` VARCHAR(32) NOT NULL,
    `scopeId` VARCHAR(32) NOT NULL,

    INDEX `idx_oauthclient_oauthscope_clientid`(`clientId`),
    INDEX `idx_oauthclient_oauthscope_scopeid`(`scopeId`),
    PRIMARY KEY (`clientId`, `scopeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthAuthCode` (
    `code` VARCHAR(191) NOT NULL,
    `redirectUri` VARCHAR(191) NULL,
    `codeChallenge` VARCHAR(191) NULL,
    `codeChallengeMethod` ENUM('S256', 'plain') NOT NULL DEFAULT 'plain',
    `expiresAt` DATETIME(3) NOT NULL,
    `userId` VARCHAR(32) NULL,
    `clientId` VARCHAR(32) NOT NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthToken` (
    `accessToken` VARCHAR(191) NOT NULL,
    `accessTokenExpiresAt` DATETIME(3) NOT NULL,
    `refreshToken` VARCHAR(191) NULL,
    `refreshTokenExpiresAt` DATETIME(3) NULL,
    `clientId` VARCHAR(32) NOT NULL,
    `userId` VARCHAR(32) NULL,

    UNIQUE INDEX `OAuthToken_refreshToken_key`(`refreshToken`),
    INDEX `idx_oauthtoken_accesstoken`(`accessToken`),
    INDEX `idx_oauthtoken_refreshtoken`(`refreshToken`),
    PRIMARY KEY (`accessToken`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthScope` (
    `id` VARCHAR(32) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    INDEX `idx_oauthscope_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_OAuthClientToOAuthScope` (
    `A` VARCHAR(32) NOT NULL,
    `B` VARCHAR(32) NOT NULL,

    UNIQUE INDEX `_OAuthClientToOAuthScope_AB_unique`(`A`, `B`),
    INDEX `_OAuthClientToOAuthScope_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_OAuthAuthCodeToOAuthScope` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(32) NOT NULL,

    UNIQUE INDEX `_OAuthAuthCodeToOAuthScope_AB_unique`(`A`, `B`),
    INDEX `_OAuthAuthCodeToOAuthScope_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_OAuthScopeToOAuthToken` (
    `A` VARCHAR(32) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_OAuthScopeToOAuthToken_AB_unique`(`A`, `B`),
    INDEX `_OAuthScopeToOAuthToken_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `oauthClient_oauthScope` ADD CONSTRAINT `oauthClient_oauthScope_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `OAuthClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oauthClient_oauthScope` ADD CONSTRAINT `oauthClient_oauthScope_scopeId_fkey` FOREIGN KEY (`scopeId`) REFERENCES `OAuthScope`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OAuthAuthCode` ADD CONSTRAINT `OAuthAuthCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OAuthAuthCode` ADD CONSTRAINT `OAuthAuthCode_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `OAuthClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OAuthToken` ADD CONSTRAINT `OAuthToken_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `OAuthClient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OAuthToken` ADD CONSTRAINT `OAuthToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_OAuthClientToOAuthScope` ADD CONSTRAINT `_OAuthClientToOAuthScope_A_fkey` FOREIGN KEY (`A`) REFERENCES `OAuthClient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_OAuthClientToOAuthScope` ADD CONSTRAINT `_OAuthClientToOAuthScope_B_fkey` FOREIGN KEY (`B`) REFERENCES `OAuthScope`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_OAuthAuthCodeToOAuthScope` ADD CONSTRAINT `_OAuthAuthCodeToOAuthScope_A_fkey` FOREIGN KEY (`A`) REFERENCES `OAuthAuthCode`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_OAuthAuthCodeToOAuthScope` ADD CONSTRAINT `_OAuthAuthCodeToOAuthScope_B_fkey` FOREIGN KEY (`B`) REFERENCES `OAuthScope`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_OAuthScopeToOAuthToken` ADD CONSTRAINT `_OAuthScopeToOAuthToken_A_fkey` FOREIGN KEY (`A`) REFERENCES `OAuthScope`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_OAuthScopeToOAuthToken` ADD CONSTRAINT `_OAuthScopeToOAuthToken_B_fkey` FOREIGN KEY (`B`) REFERENCES `OAuthToken`(`accessToken`) ON DELETE CASCADE ON UPDATE CASCADE;
