-- CreateTable
CREATE TABLE `PushToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `deviceInfo` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PushToken_token_key`(`token`),
    INDEX `PushToken_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationLog` (
    `id` VARCHAR(191) NOT NULL,
    `tokenId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `data` JSON NULL,
    `status` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NULL,
    `receiptId` VARCHAR(191) NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,

    INDEX `NotificationLog_status_idx`(`status`),
    INDEX `NotificationLog_sentAt_idx`(`sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
