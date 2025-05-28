import { MigrationInterface, QueryRunner } from 'typeorm'
import { encryptUtils } from '../../../helper/encryption'
import { apId } from '@activepieces/shared'

export class ModifyOAuth2AppEntity1746848208564 implements MigrationInterface {
    name = 'ModifyOAuth2AppEntity1746848208564'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create oauth_app table with all necessary columns and constraints
        await queryRunner.query(`
            CREATE TABLE "oauth_app" (
                "id" character varying(21) NOT NULL,
                "created" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "pieceName" character varying(255) NOT NULL,
                "platformId" character varying(21) NOT NULL,
                "clientId" character varying(255) NOT NULL,
                "clientSecret" text NOT NULL,
                CONSTRAINT "PK_oauth_app" PRIMARY KEY ("id"),
                CONSTRAINT "fk_oauth_app_platform_id" FOREIGN KEY ("platformId") REFERENCES "platform" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `)

        // Create unique index for platformId and pieceName combination
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_oauth_app_platformId_pieceName" ON "oauth_app" ("platformId", "pieceName")
        `)

        // Seed initial Slack OAuth app credentials if platform exists
        const platformId = await queryRunner.query(`
            SELECT id FROM platform LIMIT 1
        `).then(rows => rows[0]?.id)

        if (platformId) {
            await queryRunner.query(`
                INSERT INTO "oauth_app" ("id", "created", "updated", "pieceName", "platformId", "clientId", "clientSecret")
                VALUES (
                    $1,
                    now(),
                    now(),
                    'slack',
                    $2,
                    $3,
                    $4
                )
            `, [
                apId(),
                platformId,
                '3866934743111.8953325004789',
                encryptUtils.encryptString('9aab06a6aeed84fcb145b8ab318af8c6')
            ])
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the table and all its dependencies
        await queryRunner.query(`
            DROP TABLE IF EXISTS "oauth_app"
        `)
    }
} 