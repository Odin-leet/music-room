import { MigrationInterface, QueryRunner } from "typeorm";

export class UserProfile1791369407140 implements MigrationInterface {
    name = 'UserProfile1791369407140'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "friendships" ("userAId" uuid NOT NULL, "userBId" uuid NOT NULL, "requesterId" uuid NOT NULL, "status" character varying(10) NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "acceptedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_friendships_status" CHECK ("status" IN ('pending', 'accepted')), CONSTRAINT "CHK_friendships_requester" CHECK ("requesterId" IN ("userAId", "userBId")), CONSTRAINT "CHK_friendships_order" CHECK ("userAId" < "userBId"), CONSTRAINT "PK_929b33c240a0f0052be3212994c" PRIMARY KEY ("userAId", "userBId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d97fe9be0d3006abbd2b5ba1e4" ON "friendships"  ("userBId") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "bio" character varying(300) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "users" ADD "realName" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "city" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "phone" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "birthDate" date`);
        await queryRunner.query(`ALTER TABLE "users" ADD "musicGenres" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "musicArtists" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "musicVisibility" character varying(10) NOT NULL DEFAULT 'friends'`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_users_music_artists" CHECK (cardinality("musicArtists") <= 10)`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_users_music_genres" CHECK ("musicGenres" <@ ARRAY['pop', 'rap', 'rock', 'dance', 'rnb', 'alternative', 'electro', 'folk', 'reggae', 'jazz', 'classical', 'metal', 'soul', 'blues', 'latin', 'african', 'asian', 'indian', 'brazilian', 'soundtracks', 'kids']::text[])`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "CHK_users_music_visibility" CHECK ("musicVisibility" IN ('public', 'friends', 'private'))`);
        await queryRunner.query(`ALTER TABLE "friendships" ADD CONSTRAINT "FK_4165b4ca6399b10555ab08de234" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friendships" ADD CONSTRAINT "FK_d97fe9be0d3006abbd2b5ba1e40" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "friendships" ADD CONSTRAINT "FK_4f47ed519abe1ced044af260420" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "friendships" DROP CONSTRAINT "FK_4f47ed519abe1ced044af260420"`);
        await queryRunner.query(`ALTER TABLE "friendships" DROP CONSTRAINT "FK_d97fe9be0d3006abbd2b5ba1e40"`);
        await queryRunner.query(`ALTER TABLE "friendships" DROP CONSTRAINT "FK_4165b4ca6399b10555ab08de234"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_music_visibility"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_music_genres"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_music_artists"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "musicVisibility"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "musicArtists"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "musicGenres"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "birthDate"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "realName"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d97fe9be0d3006abbd2b5ba1e4"`);
        await queryRunner.query(`DROP TABLE "friendships"`);
    }

}
