import { MigrationInterface, QueryRunner } from "typeorm";

export class GoogleSignIn1791213009603 implements MigrationInterface {
    name = 'GoogleSignIn1791213009603'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "oauth_login_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "codeHash" character varying NOT NULL, "userId" uuid NOT NULL, "codeChallenge" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5a471ae0868ffd786fcfa09f6cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1c1f8782e8aa2683bc31917195" ON "oauth_login_codes"  ("codeHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_2cbbfbbed34db0d24432e70430" ON "oauth_login_codes"  ("userId") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "googleId" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId")`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "oauth_login_codes" ADD CONSTRAINT "FK_2cbbfbbed34db0d24432e70430c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "oauth_login_codes" DROP CONSTRAINT "FK_2cbbfbbed34db0d24432e70430c"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_f382af58ab36057334fb262efd5"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "googleId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2cbbfbbed34db0d24432e70430"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c1f8782e8aa2683bc31917195"`);
        await queryRunner.query(`DROP TABLE "oauth_login_codes"`);
    }

}
