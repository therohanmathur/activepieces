import { MigrationInterface, QueryRunner } from 'typeorm'
import { encryptUtils } from '../../../helper/encryption'
import { apId } from '@activepieces/shared'
import { QueueMode } from '../../../helper/system/system'

export class SeedSlackPieceOAuthApp1717239613261 implements MigrationInterface {
    name = 'SeedSlackPieceOAuthApp1717239613261'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Load encryption key
        await encryptUtils.loadEncryptionKey(QueueMode.MEMORY)

        // Hardcoded Slack OAuth app credentials for @activepieces/piece-slack
        await queryRunner.query(`
            INSERT INTO "oauth_app" ("id", "created", "updated", "pieceName", "platformId", "clientId", "clientSecret")
            VALUES (?, datetime('now'), datetime('now'), '@activepieces/piece-slack', ?, '3866934743111.8953325004789', ?)
        `, [
            apId(),
            'ipVadffiY9gEUn5FfTY9j',
            encryptUtils.encryptString('9aab06a6aeed84fcb145b8ab318af8c6')
        ])
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "oauth_app" WHERE "pieceName" = '@activepieces/piece-slack' AND "platformId" = 'ipVadffiY9gEUn5FfTY9j'
        `)
    }
} 