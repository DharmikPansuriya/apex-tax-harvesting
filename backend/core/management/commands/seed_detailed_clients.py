"""
Management command to seed detailed client data with 2-year portfolio spread
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import WealthManager, Client, Holding, Transaction, Section104Pool
from core.services.market_data import MarketDataService
from decimal import Decimal
import random
from datetime import datetime, timedelta

class Command(BaseCommand):
    help = 'Seed detailed client data with 2-year portfolio spread'

    def add_arguments(self, parser):
        parser.add_argument(
            '--wealth-manager-username',
            type=str,
            default='wealth_manager_1',
            help='Username of the financial advisor to assign clients to'
        )

    def handle(self, *args, **options):
        self.stdout.write('Seeding detailed client data...')
        
        wealth_manager_username = options['wealth_manager_username']
        
        try:
            user = User.objects.get(username=wealth_manager_username)
            wealth_manager = user.wealth_manager
        except (User.DoesNotExist, WealthManager.DoesNotExist):
            self.stdout.write(
                self.style.ERROR(f'Financial advisor {wealth_manager_username} not found')
            )
            return
        
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
                {'ticker': 'BP.L', 'name': 'BP', 'sector': 'Oil & Gas', 'current_price': 28.90},
                {'ticker': 'VOD.L', 'name': 'Vodafone', 'sector': 'Telecommunications', 'current_price': 12.30},
                {'ticker': 'BT-A.L', 'name': 'BT Group', 'sector': 'Telecommunications', 'current_price': 8.75},
                {'ticker': 'BARC.L', 'name': 'Barclays', 'sector': 'Banking', 'current_price': 18.40},
                {'ticker': 'LLOY.L', 'name': 'Lloyds Banking Group', 'sector': 'Banking', 'current_price': 15.20},
            ]
        
        # Detailed client data
        clients_data = [
            {
                'first_name': 'James',
                'last_name': 'Mitchell',
                'email': 'james.mitchell@email.com',
                'phone': '+44 20 7123 0001',
                'risk_profile': 'AGGRESSIVE',
                'portfolio_value': 250000,
                'holdings_count': 8,
                'description': 'Tech entrepreneur with high risk tolerance'
            },
            {
                'first_name': 'Sarah',
                'last_name': 'Thompson',
                'email': 'sarah.thompson@email.com',
                'phone': '+44 20 7123 0002',
                'risk_profile': 'MODERATE',
                'portfolio_value': 180000,
                'holdings_count': 6,
                'description': 'Senior executive seeking balanced growth'
            },
            {
                'first_name': 'Robert',
                'last_name': 'Williams',
                'email': 'robert.williams@email.com',
                'phone': '+44 20 7123 0003',
                'risk_profile': 'CONSERVATIVE',
                'portfolio_value': 320000,
                'holdings_count': 5,
                'description': 'Retired professional focused on capital preservation'
            },
            {
                'first_name': 'Emma',
                'last_name': 'Davis',
                'email': 'emma.davis@email.com',
                'phone': '+44 20 7123 0004',
                'risk_profile': 'MODERATE',
                'portfolio_value': 150000,
                'holdings_count': 7,
                'description': 'Young professional building long-term wealth'
            },
            {
                'first_name': 'Michael',
                'last_name': 'Brown',
                'email': 'michael.brown@email.com',
                'phone': '+44 20 7123 0005',
                'risk_profile': 'AGGRESSIVE',
                'portfolio_value': 280000,
                'holdings_count': 9,
                'description': 'Investment banker with sophisticated portfolio'
            }
        ]
        
        # Create clients
        for i, client_data in enumerate(clients_data):
            client = Client.objects.create(
                wealth_manager=wealth_manager,
                first_name=client_data['first_name'],
                last_name=client_data['last_name'],
                email=client_data['email'],
                phone=client_data['phone'],
                risk_profile=client_data['risk_profile'],
                total_portfolio_value=Decimal('0.00')
            )
            
            self.stdout.write(f'Created client: {client.full_name} ({client_data["description"]})')
            
            # Create holdings for this client
            num_holdings = client_data['holdings_count']
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
                
                # Create transactions over the last 2 years
                self._create_transaction_history(holding, security, client_data['risk_profile'])
                
                self.stdout.write(f'  Created holding: {holding.ticker} with transaction history')
            
            # Update client portfolio value
            self._update_client_portfolio_value(client)
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created {len(clients_data)} detailed clients with 2-year portfolio data'
            )
        )
    
    def _create_transaction_history(self, holding, security, risk_profile):
        """Create realistic transaction history over 2 years"""
        start_date = datetime.now().date() - timedelta(days=730)  # 2 years ago
        current_date = datetime.now().date()
        
        # Base transaction frequency based on risk profile
        if risk_profile == 'AGGRESSIVE':
            base_frequency = 45  # days between transactions
            volatility_factor = 0.3
        elif risk_profile == 'MODERATE':
            base_frequency = 60
            volatility_factor = 0.2
        else:  # CONSERVATIVE
            base_frequency = 90
            volatility_factor = 0.1
        
        # Generate transactions
        current_date_iter = start_date
        total_qty = Decimal('0')
        total_cost = Decimal('0')
        
        while current_date_iter <= current_date:
            # Skip weekends
            if current_date_iter.weekday() >= 5:
                current_date_iter += timedelta(days=1)
                continue
            
            # Determine if we should create a transaction
            if random.random() < 0.3:  # 30% chance of transaction on any given day
                # Determine transaction type
                if total_qty == 0 or random.random() < 0.7:  # 70% chance of buy if no holdings
                    side = 'BUY'
                else:
                    side = 'SELL'
                
                # Calculate quantity and price
                if side == 'BUY':
                    qty = Decimal(str(random.randint(50, 500)))
                    # Price with some volatility
                    base_price = Decimal(str(security['current_price']))
                    volatility = base_price * Decimal(str(random.uniform(-volatility_factor, volatility_factor)))
                    price = base_price + volatility
                else:
                    # Sell up to 80% of holdings
                    max_sell = total_qty * Decimal('0.8')
                    qty = Decimal(str(random.randint(10, int(max_sell))))
                    base_price = Decimal(str(security['current_price']))
                    volatility = base_price * Decimal(str(random.uniform(-volatility_factor, volatility_factor)))
                    price = base_price + volatility
                
                # Fees
                fees = Decimal(str(random.uniform(5, 25)))
                
                # Create transaction
                transaction = Transaction.objects.create(
                    holding=holding,
                    trade_date=current_date_iter,
                    qty=qty,
                    price=price,
                    fees=fees,
                    side=side
                )
                
                # Update totals
                if side == 'BUY':
                    total_qty += qty
                    total_cost += (qty * price) + fees
                else:
                    total_qty -= qty
                    total_cost -= (qty * price) + fees
                
                # Ensure we don't go negative
                if total_qty < 0:
                    total_qty = Decimal('0')
                    total_cost = Decimal('0')
            
            # Move to next potential transaction date
            days_to_next = base_frequency + random.randint(-15, 15)
            current_date_iter += timedelta(days=days_to_next)
        
        # Create Section 104 pool
        if total_qty > 0:
            Section104Pool.objects.create(
                holding=holding,
                pooled_qty=total_qty,
                pooled_cost=total_cost
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
