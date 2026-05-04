.PHONY: help up down build logs backend frontend db-migrate db-upgrade test lint

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---- Docker ----
up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

build: ## Build all containers
	docker compose build

logs: ## Tail logs for all services
	docker compose logs -f

# ---- Development ----
backend: ## Run backend locally (no Docker)
	cd backend && uvicorn app.main:app --reload --port 8000

frontend: ## Run frontend locally (no Docker)
	cd frontend && npm run dev

# ---- Database ----
db-migrate: ## Create a new migration (usage: make db-migrate msg="add users table")
	cd backend && alembic revision --autogenerate -m "$(msg)"

db-upgrade: ## Apply all migrations
	cd backend && alembic upgrade head

# ---- Quality ----
test: ## Run all tests
	cd backend && pytest -v --cov=app
	cd frontend && npm test

lint: ## Lint all code
	cd backend && ruff check . && mypy app
	cd frontend && npm run lint
