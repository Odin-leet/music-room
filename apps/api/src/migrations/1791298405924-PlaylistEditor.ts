import { MigrationInterface, QueryRunner } from "typeorm";

export class PlaylistEditor1791298405924 implements MigrationInterface {
    name = 'PlaylistEditor1791298405924'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "playlists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "name" character varying(100) NOT NULL, "description" character varying(500) NOT NULL DEFAULT '', "visibility" character varying(10) NOT NULL, "license" character varying(10) NOT NULL DEFAULT 'open', "inviteCode" character varying(12) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_playlists_license" CHECK ("license" IN ('open', 'invited')), CONSTRAINT "CHK_playlists_visibility" CHECK ("visibility" IN ('public', 'private')), CONSTRAINT "PK_a4597f4189a75d20507f3f7ef0d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_aa5d498a2f045be2fb71ef98d4" ON "playlists"  ("ownerId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4b8d5ebc1a21c82b496d12e9a6" ON "playlists"  ("inviteCode") `);
        await queryRunner.query(`CREATE TABLE "playlist_members" ("playlistId" uuid NOT NULL, "userId" uuid NOT NULL, "role" character varying(10) NOT NULL, "joinedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_playlist_members_role" CHECK ("role" IN ('owner', 'invited', 'guest')), CONSTRAINT "PK_6a014aee3726b7a23cb6bf55989" PRIMARY KEY ("playlistId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3119f4d5cb2785659e2346edbf" ON "playlist_members"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "playlist_tracks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "playlistId" uuid NOT NULL, "position" character varying(255) COLLATE "C" NOT NULL, "provider" character varying(20) NOT NULL, "providerTrackId" character varying(64) NOT NULL, "title" character varying(300) NOT NULL, "artist" character varying(300) NOT NULL, "album" character varying(300) NOT NULL, "coverUrl" character varying(500), "durationSec" integer NOT NULL, "isrc" character varying(20), "addedById" uuid, "addedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0f93b1a2df4de2e5b48c1459617" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_playlist_tracks_song_once" ON "playlist_tracks"  ("playlistId", "provider", "providerTrackId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_playlist_tracks_position" ON "playlist_tracks"  ("playlistId", "position") `);
        await queryRunner.query(`ALTER TABLE "playlists" ADD CONSTRAINT "FK_aa5d498a2f045be2fb71ef98d45" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "playlist_members" ADD CONSTRAINT "FK_f3615c69fc423c61977ac3c2839" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "playlist_members" ADD CONSTRAINT "FK_3119f4d5cb2785659e2346edbf1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "playlist_tracks" ADD CONSTRAINT "FK_502ada93a48b5f9f7d7d2b3f0d7" FOREIGN KEY ("playlistId") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "playlist_tracks" ADD CONSTRAINT "FK_6ef2b8c14e68e60e3c620a9a960" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "playlist_tracks" DROP CONSTRAINT "FK_6ef2b8c14e68e60e3c620a9a960"`);
        await queryRunner.query(`ALTER TABLE "playlist_tracks" DROP CONSTRAINT "FK_502ada93a48b5f9f7d7d2b3f0d7"`);
        await queryRunner.query(`ALTER TABLE "playlist_members" DROP CONSTRAINT "FK_3119f4d5cb2785659e2346edbf1"`);
        await queryRunner.query(`ALTER TABLE "playlist_members" DROP CONSTRAINT "FK_f3615c69fc423c61977ac3c2839"`);
        await queryRunner.query(`ALTER TABLE "playlists" DROP CONSTRAINT "FK_aa5d498a2f045be2fb71ef98d45"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_playlist_tracks_position"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_playlist_tracks_song_once"`);
        await queryRunner.query(`DROP TABLE "playlist_tracks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3119f4d5cb2785659e2346edbf"`);
        await queryRunner.query(`DROP TABLE "playlist_members"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4b8d5ebc1a21c82b496d12e9a6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aa5d498a2f045be2fb71ef98d4"`);
        await queryRunner.query(`DROP TABLE "playlists"`);
    }

}
