import { MigrationInterface, QueryRunner } from "typeorm";

export class TrackVote1791286115043 implements MigrationInterface {
    name = 'TrackVote1791286115043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "name" character varying(100) NOT NULL, "description" character varying(500) NOT NULL DEFAULT '', "visibility" character varying(10) NOT NULL, "license" character varying(10) NOT NULL DEFAULT 'open', "inviteCode" character varying(12) NOT NULL, "geoLat" double precision, "geoLng" double precision, "geoRadiusM" integer, "startsAt" TIMESTAMP WITH TIME ZONE, "endsAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_events_time_window" CHECK ("startsAt" < "endsAt"), CONSTRAINT "CHK_events_geo_ranges" CHECK ("geoLat" BETWEEN -90 AND 90 AND "geoLng" BETWEEN -180 AND 180 AND "geoRadiusM" > 0), CONSTRAINT "CHK_events_geo_fields" CHECK (("license" = 'geo') = ("geoLat" IS NOT NULL AND "geoLng" IS NOT NULL AND "geoRadiusM" IS NOT NULL AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL)), CONSTRAINT "CHK_events_license" CHECK ("license" IN ('open', 'invited', 'geo')), CONSTRAINT "CHK_events_visibility" CHECK ("visibility" IN ('public', 'private')), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_72bbe49600962f125177d7d6b6" ON "events"  ("ownerId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1648e6a93a1015c06b5c817ac3" ON "events"  ("inviteCode") `);
        await queryRunner.query(`CREATE TABLE "event_members" ("eventId" uuid NOT NULL, "userId" uuid NOT NULL, "role" character varying(10) NOT NULL, "joinedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_event_members_role" CHECK ("role" IN ('owner', 'invited', 'guest')), CONSTRAINT "PK_721d4e10a987fd7af9a796d7dcc" PRIMARY KEY ("eventId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dcefa9d7cc919f8612d4a0242c" ON "event_members"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "event_tracks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventId" uuid NOT NULL, "provider" character varying(20) NOT NULL, "providerTrackId" character varying(64) NOT NULL, "title" character varying(300) NOT NULL, "artist" character varying(300) NOT NULL, "album" character varying(300) NOT NULL, "coverUrl" character varying(500), "durationSec" integer NOT NULL, "isrc" character varying(20), "suggestedById" uuid, "suggestedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "score" integer NOT NULL DEFAULT '0', "status" character varying(10) NOT NULL DEFAULT 'queued', CONSTRAINT "CHK_event_tracks_score" CHECK ("score" >= 0), CONSTRAINT "CHK_event_tracks_status" CHECK ("status" IN ('queued', 'playing', 'played')), CONSTRAINT "PK_435213dded512f012867c2f943a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_event_tracks_ranking" ON "event_tracks"  ("eventId", "status", "score", "suggestedAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_event_tracks_queued_once" ON "event_tracks"  ("eventId", "provider", "providerTrackId") WHERE "status" = 'queued'`);
        await queryRunner.query(`CREATE TABLE "votes" ("eventTrackId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_03ebee97c8eb4342d2f8cd60781" PRIMARY KEY ("eventTrackId", "userId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5169384e31d0989699a318f3ca" ON "votes"  ("userId") `);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_72bbe49600962f125177d7d6b68" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_members" ADD CONSTRAINT "FK_37c13d44805876650e348b8af02" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_members" ADD CONSTRAINT "FK_dcefa9d7cc919f8612d4a0242cf" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_tracks" ADD CONSTRAINT "FK_7ebed83a78cc76ac30267dcfa4c" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_tracks" ADD CONSTRAINT "FK_047d00df2c6ff35512b9419b18d" FOREIGN KEY ("suggestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_cfbbcdd6f13b4e419109b2368da" FOREIGN KEY ("eventTrackId") REFERENCES "event_tracks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_5169384e31d0989699a318f3ca4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_5169384e31d0989699a318f3ca4"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_cfbbcdd6f13b4e419109b2368da"`);
        await queryRunner.query(`ALTER TABLE "event_tracks" DROP CONSTRAINT "FK_047d00df2c6ff35512b9419b18d"`);
        await queryRunner.query(`ALTER TABLE "event_tracks" DROP CONSTRAINT "FK_7ebed83a78cc76ac30267dcfa4c"`);
        await queryRunner.query(`ALTER TABLE "event_members" DROP CONSTRAINT "FK_dcefa9d7cc919f8612d4a0242cf"`);
        await queryRunner.query(`ALTER TABLE "event_members" DROP CONSTRAINT "FK_37c13d44805876650e348b8af02"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_72bbe49600962f125177d7d6b68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5169384e31d0989699a318f3ca"`);
        await queryRunner.query(`DROP TABLE "votes"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_event_tracks_queued_once"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_event_tracks_ranking"`);
        await queryRunner.query(`DROP TABLE "event_tracks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dcefa9d7cc919f8612d4a0242c"`);
        await queryRunner.query(`DROP TABLE "event_members"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1648e6a93a1015c06b5c817ac3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_72bbe49600962f125177d7d6b6"`);
        await queryRunner.query(`DROP TABLE "events"`);
    }

}
