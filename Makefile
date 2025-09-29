.PHONY: up up-bg down seed seed-wealth-managers seed-detailed-clients test report clean build build-bg logs shell db reset

# Start all services
up:
	docker-compose up

# Start all services in background
up-bg:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# Seed the database with dummy portfolio data
seed:
	docker-compose exec backend python manage.py makemigrations
	docker-compose exec backend python manage.py migrate
	docker-compose exec backend python manage.py load_dummy_portfolio

# Seed financial advisor and client data
seed-wealth-managers:
	docker-compose exec backend python manage.py makemigrations
	docker-compose exec backend python manage.py migrate
	docker-compose exec backend python manage.py seed_wealth_manager_data

# Seed detailed clients with 2-year portfolio data
seed-detailed-clients:
	docker-compose exec backend python manage.py makemigrations
	docker-compose exec backend python manage.py migrate
	docker-compose exec backend python manage.py seed_detailed_clients

# Run tests
test:
	docker-compose exec backend pytest

# Generate CGT report
report:
	curl -X POST "http://localhost:8000/api/reports/cgt?tax_year=2024-25"

# Clean up containers and volumes
clean:
	docker-compose down -v
	docker system prune -f

# Build and start services
build:
	docker-compose up --build

# Build and start services in background
build-bg:
	docker-compose up --build -d

# View logs
logs:
	docker-compose logs -f

# Access backend shell
shell:
	docker-compose exec backend python manage.py shell

# Access database
db:
	docker-compose exec postgres psql -U tlh -d tlh

# Reset database (remove volumes and restart)
reset:
	docker-compose down -v
	docker-compose up --build
