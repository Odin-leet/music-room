import { MigrationInterface, QueryRunner } from "typeorm";

export class OnePlayingTrack1791294302713 implements MigrationInterface {
    name = 'OnePlayingTrack1791294302713'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_event_tracks_one_playing" ON "event_tracks"  ("eventId") WHERE "status" = 'playing'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_event_tracks_one_playing"`);
    }

}
