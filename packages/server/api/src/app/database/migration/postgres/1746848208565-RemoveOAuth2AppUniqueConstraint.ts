import { MigrationInterface, QueryRunner } from 'typeorm'

export class RemoveOAuth2AppUniqueConstraint1746848208565 implements MigrationInterface {
    name = 'RemoveOAuth2AppUniqueConstraint1746848208565'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the unique index
        await queryRunner.query(`
            DROP INDEX IF EXISTS "idx_oauth_app_platformId_pieceName"
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate the unique index if needed to rollback
        await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_oauth_app_platformId_pieceName" ON "oauth_app" ("platformId", "pieceName")
        `)
    }
} 