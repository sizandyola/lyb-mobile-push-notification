-- CreateTable
CREATE TABLE `ErrorLog` (
    `id` VARCHAR(191) NOT NULL,
    `tokenId` VARCHAR(191) NULL,
    `platform` VARCHAR(191) NULL,
    `errorType` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `stackTrace` TEXT NULL,
    `context` JSON NULL,
    `appVersion` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ErrorLog_errorType_idx`(`errorType`),
    INDEX `ErrorLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
