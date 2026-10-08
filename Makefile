SHELL := /bin/bash
ENV_FILE := .env

.PHONY: help env install scaffold-api scaffold-mobile \
        db-up db-down db-logs db-shell \
        migrate migration-generate migration-revert \
        dev dev-api dev-mobile build test lint load-test clean

help:
	@echo "Music Room — make targets"
	@echo ""
	@echo "  First-time setup, in order:"
	@echo "    make env             Create .env from .env.example"
	@echo "    make scaffold-api    Generate apps/api with the NestJS CLI (once)"
	@echo "    make scaffold-mobile Generate apps/mobile with Expo (once)"
	@echo "    make install         Install all workspace dependencies"
	@echo "    make db-up           Start Postgres + Mailpit (dev mail) via Docker Compose"
	@echo ""
	@echo "  Day to day:"
	@echo "    make dev-api         Run the NestJS API in watch mode"
	@echo "    make dev-mobile      Run the Expo dev server"
	@echo "    make dev             Run API + Expo together"
	@echo "    make build           Build every workspace"
	@echo "    make test            Run every workspace's tests"
	@echo "    make load-test       k6 capacity ramp on a separate API + DB (see loadtests/README.md)"
	@echo "    make lint            Lint every workspace"
	@echo "    make db-logs         Tail Postgres logs"
	@echo "    make db-shell        Open a psql shell in the running container"
	@echo "    make db-down         Stop and remove the Postgres + Mailpit containers"
	@echo "    make migrate         Apply every pending migration"
	@echo "    make migration-generate name=AddPlaylist   Generate a migration from entity changes"
	@echo "    make migration-revert                       Undo the last-applied migration"
	@echo "    make clean           Remove node_modules, build output, Expo cache"

env:
	@test -f $(ENV_FILE) || cp .env.example $(ENV_FILE)
	@echo ".env ready — fill in real secrets before running the API."

# --- one-time scaffolding (run these locally, not in CI) ---
# Generates apps/api with the Nest CLI. Safe to skip once apps/api exists.
scaffold-api:
	cd apps && npx @nestjs/cli@latest new api --package-manager npm --skip-git

# Generates apps/mobile with Expo. Safe to skip once apps/mobile exists.
scaffold-mobile:
	cd apps && npx create-expo-app@latest mobile --template blank-typescript

install: env
	npm install

# --- database ---
db-up:
	docker compose up -d postgres mailpit
	@echo "Postgres starting — run 'make db-logs' to watch it become healthy."
	@echo "Mailpit (dev email inbox): http://localhost:8025"

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

db-shell:
	docker compose exec postgres psql -U $${DB_USER:-music_room} -d $${DB_NAME:-music_room_dev}

# --- schema (TypeORM migrations — the schema's source of truth, not `synchronize`) ---
migrate:
	cd apps/api && npm run typeorm -- migration:run -d src/data-source.ts

# Diffs the entities against the current DB schema and writes a new
# migration file under apps/api/src/migrations. Review the generated SQL
# before running `make migrate` — it's a strong first draft, not gospel.
migration-generate:
	cd apps/api && npm run typeorm -- migration:generate -d src/data-source.ts src/migrations/$(name)

migration-revert:
	cd apps/api && npm run typeorm -- migration:revert -d src/data-source.ts

# --- app processes ---
dev-api:
	npm run start:dev --workspace=apps/api

dev-mobile:
	npm run start --workspace=apps/mobile

dev:
	npx concurrently -n API,MOBILE -c blue,green \
		"npm run start:dev --workspace=apps/api" \
		"npm run start --workspace=apps/mobile"

build:
	npm run build --workspaces --if-present

test:
	npm test --workspaces --if-present

lint:
	npm run lint --workspaces --if-present

# k6 load test (brief V.7). Needs Docker running and k6 (brew install k6).
# Uses its own database and an API on port 3100: dev data is not touched.
load-test:
	node loadtests/run.mjs ramp

clean:
	rm -rf node_modules apps/*/node_modules apps/*/dist apps/*/.expo packages/*/node_modules
