"""
Management command to seed financial advisor and client data
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import WealthManager, Client, Holding, Transaction, Section104Pool
from core.services.market_data import MarketDataService
from decimal import Decimal
import random
from datetime import datetime, timedelta

class Command(BaseCommand):
    help = 'Seed financial advisor and client data with real UK securities'

    def add_arguments(self, parser):
        parser.add_argument(
            '--wealth-managers',
            type=int,
            default=2,
            help='Number of financial advisors to create'
        )
        parser.add_argument(
            '--clients-per-manager',
            type=int,
            default=5,
            help='Number of clients per financial advisor'
        )

    def handle(self, *args, **options):
        self.stdout.write('Seeding financial advisor and client data...')
        
        wealth_managers_count = options['wealth_managers']
        clients_per_manager = options['clients_per_manager']
        
        # Get market data service
        market_service = MarketDataService()
        uk_securities = market_service.get_top_uk_securities()
        
        if not uk_securities:
            self.stdout.write(
                self.style.WARNING('No UK securities data available. Using fallback data.')
            )
            uk_securities = [
                {'ticker': 'AZN.L', 'name': 'AstraZeneca', 'sector': 'Pharmaceuticals', 'current_price': 120.50},
                {'ticker': 'SHEL.L', 'name': 'Shell', 'sector': 'Oil & Gas', 'current_price': 25.80},
                {'ticker': 'ULVR.L', 'name': 'Unilever', 'sector': 'Consumer Goods', 'current_price': 45.20},
                {'ticker': 'DGE.L', 'name': 'Diageo', 'sector': 'Beverages', 'current_price': 35.60},
                {'ticker': 'GSK.L', 'name': 'GSK', 'sector': 'Pharmaceuticals', 'current_price': 15.40},
            ]
        
        # Create financial advisors
        wealth_managers = []
        for i in range(wealth_managers_count):
            user = User.objects.create_user(
                username=f'wealth_manager_{i+1}',
                email=f'wm{i+1}@wealthfirm.com',
                password='password123',
                first_name=f'Financial Advisor {i+1}',
                last_name='Smith'
            )
            
            wealth_manager = WealthManager.objects.create(
                user=user,
                firm_name=f'Wealth Firm {i+1}',
                license_number=f'WM{i+1:03d}',
                phone=f'+44 20 7123 {i+1:04d}'
            )
            wealth_managers.append(wealth_manager)
            
            self.stdout.write(f'Created financial advisor: {wealth_manager}')
        
        # Create clients for each financial advisor
        for wm in wealth_managers:
            for i in range(clients_per_manager):
                client = Client.objects.create(
                    wealth_manager=wm,
                    first_name=f'Client {i+1}',
                    last_name=f'Smith',
                    email=f'client{i+1}@{wm.firm_name.lower().replace(" ", "")}.com',
                    phone=f'+44 20 7123 {i+1:04d}',
                    risk_profile=random.choice(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']),
                    total_portfolio_value=Decimal('0.00')
                )
                
                self.stdout.write(f'Created client: {client.full_name}')
                
                # Create holdings for this client
                num_holdings = random.randint(3, 8)
                selected_securities = random.sample(uk_securities, min(num_holdings, len(uk_securities)))
                
                for security in selected_securities:
                    holding = Holding.objects.create(
                        client=client,
                        ticker=security['ticker'],
                        name=security['name'],
                        sector=security['sector'],
                        isin=f"GB00{security['ticker'].replace('.L', '')}0001",
                        sedol=f"{security['ticker'].replace('.L', '')}0001"
                    )
                    
                    # Create transactions for this holding
                    num_transactions = random.randint(2, 5)
                    total_qty = Decimal('0')
                    total_cost = Decimal('0')
                    
                    for j in range(num_transactions):
                        qty = Decimal(str(random.randint(10, 100)))
                        price = Decimal(str(security['current_price'] * random.uniform(0.8, 1.2)))
                        fees = Decimal(str(random.uniform(5, 25)))
                        
                        # Random date within last 2 years
                        days_ago = random.randint(1, 730)
                        trade_date = datetime.now().date() - timedelta(days=days_ago)
                        
                        transaction = Transaction.objects.create(
                            holding=holding,
                            trade_date=trade_date,
                            qty=qty,
                            price=price,
                            fees=fees,
                            side='BUY'
                        )
                        
                        total_qty += qty
                        total_cost += (qty * price) + fees
                    
                    # Create Section 104 pool
                    Section104Pool.objects.create(
                        holding=holding,
                        pooled_qty=total_qty,
                        pooled_cost=total_cost
                    )
                    
                    self.stdout.write(f'  Created holding: {holding.ticker} with {num_transactions} transactions')
                
                # Update client portfolio value
                self._update_client_portfolio_value(client)
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created {len(wealth_managers)} financial advisors '
                f'with {clients_per_manager} clients each'
            )
        )
    
    def _update_client_portfolio_value(self, client: Client) -> None:
        """Update client's total portfolio value"""
        total_value = Decimal('0.00')
        
        for holding in client.holdings.all():
            try:
                pool = holding.section104_pool
                if pool.pooled_qty > 0:
                    from core.services.market_data import MarketDataService
                    market_service = MarketDataService()
                    current_price = market_service.get_current_price(holding.ticker)
                    if current_price:
                        total_value += current_price * pool.pooled_qty
            except:
                continue
        
        client.total_portfolio_value = total_value
        client.save()
