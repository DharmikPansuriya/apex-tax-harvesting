# TLH UK - Tax Loss Harvesting Application

A UK-compliant Tax Loss Harvesting (TLH) web application built with Django REST Framework and Next.js.

## Features

- **UK CGT Compliance**: Implements Section 104 pooling and 30-day rule (bed & breakfasting)
- **Tax Loss Harvesting**: AI/ML-powered candidate ranking and opportunity identification
- **CGT Reporting**: HMRC-style reports with PDF and CSV export
- **Real-time Portfolio Tracking**: Monitor holdings, transactions, and compliance status
- **Modern Web Interface**: Responsive design with Tailwind CSS

## Tech Stack

### Backend

- **Django 4.2** with Django REST Framework
- **PostgreSQL** database
- **Python 3.11** with precise decimal handling
- **ReportLab** for PDF generation
- **Pandas** for data processing

### Frontend

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **TanStack Query** for data fetching
- **Lucide React** for icons

### Infrastructure

- **Docker Compose** for development
- **Makefile** for common tasks
- **Pytest** for testing

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Make (optional, for convenience commands)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd tlh-uk
```

### 2. Start Services

```bash
make up
# or
docker-compose up -d
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Admin Panel**: http://localhost:8000/admin

### 4. Load Sample Data

```bash
make seed
# or
docker-compose exec backend python manage.py load_dummy_portfolio

# Seed financial advisor and client data
make seed-wealth-managers
# or
docker-compose exec backend python manage.py seed_wealth_manager_data

# Seed detailed clients with 2-year portfolio data
make seed-detailed-clients
# or
docker-compose exec backend python manage.py seed_detailed_clients
```

## Development Commands

```bash
# Start all services (foreground)
make up

# Start all services (background)
make up-bg

# Stop all services
make down

# Build and start services
make build

# Build and start services (background)
make build-bg

# Seed database with dummy portfolio
make seed

# Seed financial advisor and client data
make seed-wealth-managers

# Seed detailed clients with 2-year portfolio data
make seed-detailed-clients

# Run tests
make test

# Generate CGT report
make report

# View logs
make logs

# Access backend shell
make shell

# Access database
make db

# Reset database (remove volumes and restart)
make reset

# Clean up
make clean
```

## Project Structure

```
tlh-uk/
├── backend/                 # Django backend
│   ├── tlh_uk/             # Django project
│   ├── core/               # Core models and services
│   │   ├── models.py       # Django models
│   │   └── services/       # Compliance engine and reporting
│   ├── api/                # DRF API
│   │   ├── serializers.py  # API serializers
│   │   ├── viewsets.py     # API viewsets
│   │   └── urls.py         # URL routing
│   ├── ai/                 # AI/ML helpers
│   │   └── ranker.py       # TLH candidate ranking
│   ├── tests/              # Test suite
│   └── requirements.txt    # Python dependencies
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # App Router pages
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   ├── lib/           # Utilities
│   │   └── types/         # TypeScript types
│   └── package.json       # Node dependencies
├── data/                   # Sample data
│   └── dummy_portfolio_uk.csv
├── docker/                 # Docker configuration
├── docker-compose.yml      # Service orchestration
├── Makefile               # Development commands
└── README.md              # This file
```

## Features

### Financial Advisor Dashboard

- **Multi-client management**: Manage up to 10 clients per financial advisor
- **Real-time market data**: Yahoo Finance integration for live prices
- **Portfolio overview**: Comprehensive client portfolio tracking
- **TLH opportunities**: AI-ranked candidates with compliance constraints
- **Client comparison**: Side-by-side analysis for decision making

### Tax Loss Harvesting

- **UK CGT compliance**: Section 104 pooling and 30-day rule enforcement
- **AI-powered ranking**: Intelligent TLH candidate prioritization
- **Real-time calculations**: Live unrealised P&L tracking
- **Compliance engine**: Automated UK CGT rules with audit trail

### Reporting & Analytics

- **CGT reports**: HMRC-style reports with PDF/CSV export
- **30-day watchlist**: Holdings blocked by bed & breakfasting rule
- **Portfolio tracking**: Real-time holdings and Section 104 pool status
- **CSV upload**: Bulk client holdings import functionality

### Professional Features

- **User authentication**: JWT-based secure financial advisor access
- **Biometric authentication**: WebAuthn support for enhanced security
- **Client management**: Complete client lifecycle management
- **Market data integration**: Top 50 UK securities with real-time prices
- **Professional UI**: Enterprise-grade interface for financial advisors
- **Protected routes**: Secure access to all application features

## UK CGT Rules Implementation

### Section 104 Pooling

- All shares of the same class are pooled together
- Disposals are costed at average cost from the pool
- Pool is updated on every buy/sell transaction

### 30-Day Rule (Bed & Breakfasting)

- If you sell and repurchase the same security within 30 days
- The sale is matched with the subsequent buy(s) first
- The matched quantity's loss is disallowed
- Remaining quantity uses Section 104 pool for cost basis

### Annual Exempt Amount

- £3,000 for 2024/25 tax year
- Applied to net gains after loss carry-forward
- Clearly shown in CGT reports

### Loss Carry-Forward

- Realised capital losses can be carried forward
- Offset against future capital gains
- Maintained in reporting system

## API Endpoints

### Holdings

- `GET /api/holdings/` - List all holdings
- `GET /api/holdings/{id}/` - Get specific holding

### Transactions

- `GET /api/transactions/` - List all transactions
- `GET /api/transactions/?holding={id}` - Filter by holding

### Section 104 Pools

- `GET /api/section104-pools/` - List all pools
- `GET /api/section104-pools/?non_zero=true` - Filter non-zero pools

### TLH Opportunities

- `GET /api/tlh/opportunities/` - Get ranked TLH candidates

### CGT Reports

- `GET /api/reports/` - List all reports
- `POST /api/tlh/opportunities/generate_report/?tax_year=2024-25` - Generate report
- `GET /api/reports/{id}/download_csv/` - Download CSV
- `GET /api/reports/{id}/download_pdf/` - Download PDF

## Testing

Run the test suite:

```bash
make test
# or
docker-compose exec backend pytest
```

Test coverage includes:

- UK CGT compliance engine
- Section 104 pooling calculations
- 30-day rule matching
- API endpoints
- Model validation
- Integration tests

## Sample Data

The application includes a comprehensive dummy portfolio (`data/dummy_portfolio_uk.csv`) that demonstrates:

- Section 104 pooling with multiple purchases
- 30-day rule triggering with repurchase
- Loss realization and disallowance
- Annual Exempt Amount application
- Loss carry-forward scenarios

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or issues, please open a GitHub issue or contact the development team.
