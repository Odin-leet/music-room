import { MigrationInterface, QueryRunner } from "typeorm";

export class FacebookSignIn1791280107658 implements MigrationInterface {
    name = 'FacebookSignIn1791280107658'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "facebookId" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_f9740e1e654a5daddb82c60bd75" UNIQUE ("facebookId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_f9740e1e654a5daddb82c60bd75"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "facebookId"`);
    }

}
