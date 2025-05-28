import { MigrationInterface, QueryRunner } from 'typeorm'
import { encryptUtils } from '../../../helper/encryption'
import { apId } from '@activepieces/shared'

export class AddOAuth2AppEntiity1699221414907 implements MigrationInterface {
    name = 'AddOAuth2AppEntiity1699221414907'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "oauth_app" (
                "id" varchar(21) NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "pieceName" varchar NOT NULL,
                "platformId" varchar(21) NOT NULL,
                "clientId" varchar NOT NULL,
                "clientSecret" text NOT NULL,
                CONSTRAINT "PK_3256b97c0a3ee2d67240805dca4" PRIMARY KEY ("id")
            )
        `)
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_oauth_app_platformId_pieceName" ON "oauth_app" ("platformId", "pieceName")
        `)
        await queryRunner.query(`
            CREATE TABLE "temporary_oauth_app" (
                "id" varchar(21) NOT NULL,
                "created" datetime NOT NULL DEFAULT (datetime('now')),
                "updated" datetime NOT NULL DEFAULT (datetime('now')),
                "pieceName" varchar NOT NULL,
                "platformId" varchar(21) NOT NULL,
                "clientId" varchar NOT NULL,
                "clientSecret" text NOT NULL,
                CONSTRAINT "PK_3256b97c0a3ee2d67240805dca4" PRIMARY KEY ("id"),
                CONSTRAINT "fk_oauth_app_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)
        await queryRunner.query(`
            INSERT INTO "temporary_oauth_app"("id", "created", "updated", "pieceName", "platformId", "clientId", "clientSecret")
            SELECT "id", "created", "updated", "pieceName", "platformId", "clientId", "clientSecret"
            FROM "oauth_app"
        `)
        await queryRunner.query(`
            DROP TABLE "oauth_app"
        `)
        await queryRunner.query(`
            ALTER TABLE "temporary_oauth_app" RENAME TO "oauth_app"
        `)

        // Hardcoded Slack OAuth app credentials
        await queryRunner.query(`
            INSERT INTO "oauth_app" ("id", "created", "updated", "pieceName", "platformId", "clientId", "clientSecret")
            VALUES (?, datetime('now'), datetime('now'), 'slack', ?, '3866934743111.8953325004789', ?)
        `, [
            apId(),
            'ipVadffiY9gEUn5FfTY9j',
            encryptUtils.encryptString('9aab06a6aeed84fcb145b8ab318af8c6')
        ])
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "oauth_app"
        `)
    }
} 