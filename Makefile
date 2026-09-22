SHELL := /bin/bash
ENV_FILE := .env

.PHONY: help env install scaffold-api scaffold-mobile \
        db-up db-down db-logs db-shell \
        dev dev-api dev-mobile build test lint clean

help:
	@echo "Music Room — make targets"
	@echo ""
	@echo "  First-time setup, in order:"
	@echo "    make env             Create .env from .env.example"
	@echo "    make scaffold-api    Generate apps/api with the NestJS CLI (once)"
	@echo "    make scaffold-mobile Generate apps/mobile with Expo (once)"
	@echo "    make install         Install all workspace dependencies"
	@echo "    make db-up           Start Postgres via Docker Compose"
	@echo ""
	@echo "  Day to day:"
	@echo "    make dev-api         Run the NestJS API in watch mode"
	@echo "    make dev-mobile      Run the Expo dev server"
	@echo "    make dev             Run API + Expo together"
	@echo "    make build           Build every workspace"
	@echo "    make test            Run every workspace's tests"
	@echo "    make lint            Lint every workspace"
	@echo "    make db-logs         Tail Postgres logs"
	@echo "    make db-shell        Open a psql shell in the running container"
	@echo "    make db-down         Stop and remove the Postgres container"
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
	docker compose up -d postgres
	@echo "Postgres starting — run 'make db-logs' to watch it become healthy."

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

db-shell:
	docker compose exec postgres psql -U $${DB_USER:-music_room} -d $${DB_NAME:-music_room_dev}

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

clean:
	rm -rf node_modules apps/*/node_modules apps/*/dist apps/*/.expo packages/*/node_modules
