import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizedEmailCheck1790693627587 implements MigrationInterface {
    name = 'NormalizedEmailCheck1790693627587'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_users_email_normalized" CHECK ("email" = lower(btrim("email")))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_email_normalized"`);
    }

}
