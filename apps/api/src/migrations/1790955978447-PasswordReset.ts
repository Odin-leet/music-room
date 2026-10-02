import { MigrationInterface, QueryRunner } from "typeorm";

export class PasswordReset1790955978447 implements MigrationInterface {
    name = 'PasswordReset1790955978447'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "password_reset_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "codeHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_9c30b1d4c6199fd152c128dbd3" UNIQUE ("userId"), CONSTRAINT "PK_f3a88f7bc4536c53f2b277a0b56" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "password_reset_codes" ADD CONSTRAINT "FK_9c30b1d4c6199fd152c128dbd37" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "password_reset_codes" DROP CONSTRAINT "FK_9c30b1d4c6199fd152c128dbd37"`);
        await queryRunner.query(`DROP TABLE "password_reset_codes"`);
    }

}
