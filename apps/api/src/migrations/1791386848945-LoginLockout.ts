import { MigrationInterface, QueryRunner } from "typeorm";

export class LoginLockout1791386848945 implements MigrationInterface {
    name = 'LoginLockout1791386848945'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "failedLoginCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "lockedUntil" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lockedUntil"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "failedLoginCount"`);
    }

}
