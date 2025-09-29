"""
Management command to load dummy portfolio data from CSV file.
"""

import csv
import os
from decimal import Decimal
from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.conf import settings

from core.models import Holding, Transaction, WealthManager, Client, Section104Pool, DisposalMatch
from core.services.compliance import ComplianceEngine


class Command(BaseCommand):
    help = 'Load dummy portfolio data from CSV file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='data/dummy_portfolio_uk.csv',
            help='Path to CSV file (relative to project root)'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before loading'
        )

    def handle(self, *args, **options):
        file_path = options['file']
        clear_data = options['clear']
        
        # Resolve file path
        if not os.path.isabs(file_path):
            file_path = os.path.join(settings.BASE_DIR, file_path)
        
        if not os.path.exists(file_path):
            raise CommandError(f'CSV file not found: {file_path}')
        
        self.stdout.write(f'Loading portfolio data from: {file_path}')
        
        # Create a default financial advisor and client if they don't exist
        from django.contrib.auth.models import User
        
        user, user_created = User.objects.get_or_create(
            username='default_wm',
            defaults={
                'email': 'default@example.com',
                'password': 'defaultpass',
                'first_name': 'Default',
                'last_name': 'Financial Advisor'
            }
        )
        if user_created:
            user.set_password('defaultpass')
            user.save()
        
        wealth_manager, wm_created = WealthManager.objects.get_or_create(
            user=user,
            defaults={
                'firm_name': 'Default Financial Advisory',
                'license_number': 'DEFAULT001'
            }
        )
        
        client, created = Client.objects.get_or_create(
            wealth_manager=wealth_manager,
            first_name='Default',
            last_name='Client',
            defaults={
                'email': 'default.client@example.com',
                'risk_profile': 'MODERATE'
            }
        )
        
        if clear_data:
            self.stdout.write('Clearing existing data...')
            Transaction.objects.all().delete()
            Holding.objects.all().delete()
        
        try:
            with transaction.atomic():
                self._load_portfolio_data(file_path)
                self._process_compliance()
                
            self.stdout.write(
                self.style.SUCCESS('Successfully loaded portfolio data')
            )
            
        except Exception as e:
            raise CommandError(f'Error loading portfolio data: {str(e)}')

    def _load_portfolio_data(self, file_path):
        """Load portfolio data from CSV file"""
        holdings_created = {}
        transactions_created = 0
        
        # Get the default client
        client = Client.objects.filter(wealth_manager__user__username='default_wm').first()
        
        with open(file_path, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 for header
                # Skip comment lines
                if row.get('trade_date', '').strip().startswith('#'):
                    continue
                
                # Skip empty rows
                if not row.get('trade_date', '').strip():
                    continue
                
                try:
                    # Parse row data
                    trade_date = datetime.strptime(row['trade_date'].strip(), '%Y-%m-%d').date()
                    ticker = row['ticker'].strip()
                    isin = row['isin'].strip()
                    sedol = row['sedol'].strip() if row['sedol'].strip() else None
                    side = row['side'].strip().upper()
                    qty = Decimal(row['qty'].strip())
                    price = Decimal(row['price'].strip())
                    fees = Decimal(row['fees'].strip())
                    account = row['account'].strip()
                    
                    # Get or create holding
                    holding_key = (isin, sedol)
                    if holding_key not in holdings_created:
                        holding, created = Holding.objects.get_or_create(
                            client=client,
                            isin=isin,
                            sedol=sedol,
                            defaults={
                                'ticker': ticker,
                                'name': f"{ticker} Corporation"  # Default name
                            }
                        )
                        holdings_created[holding_key] = holding
                        
                        if created:
                            self.stdout.write(f'Created holding: {ticker} ({isin})')
                    else:
                        holding = holdings_created[holding_key]
                    
                    # Create transaction
                    transaction = Transaction.objects.create(
                        holding=holding,
                        trade_date=trade_date,
                        qty=qty,
                        price=price,
                        fees=fees,
                        side=side,
                        account=account
                    )
                    
                    transactions_created += 1
                    
                    self.stdout.write(
                        f'Created transaction: {side} {qty} {ticker} @ {price} on {trade_date}'
                    )
                    
                except Exception as e:
                    raise CommandError(f'Error processing row {row_num}: {str(e)}')
        
        self.stdout.write(f'Created {len(holdings_created)} holdings and {transactions_created} transactions')

    def _process_compliance(self):
        """Process all holdings through compliance engine"""
        self.stdout.write('Processing compliance rules...')
        
        compliance_engine = ComplianceEngine()
        holdings = Holding.objects.all()
        for holding in holdings:
            self.stdout.write(f'Processing compliance for {holding.ticker}...')
            
            try:
                result = compliance_engine.process_transactions_for_holding(holding)
                
                # Log pool state
                pool = result['pool']
                self.stdout.write(
                    f'  Section 104 Pool: {pool.pooled_qty} shares @ £{pool.avg_cost:.2f} avg cost'
                )
                
                # Log disposals
                for disposal in result['disposals']:
                    self.stdout.write(
                        f'  Disposal: {disposal["total_gain_loss"]:+.2f} gain/loss'
                    )
                    if disposal.get('disallowed_loss', 0) > 0:
                        self.stdout.write(
                            f'    Disallowed loss (30-day rule): £{disposal["disallowed_loss"]:.2f}'
                        )
                
                # Log matches
                for match in result['matches']:
                    if hasattr(match, 'qty_matched'):
                        self.stdout.write(
                            f'  30-day match: {match.qty_matched} shares, '
                            f'disallowed loss: £{match.disallowed_loss:.2f}'
                        )
                    else:
                        self.stdout.write(
                            f'  30-day match: {match.get("qty", 0)} shares, '
                            f'disallowed loss: £{match.get("disallowed_loss", 0):.2f}'
                        )
                    
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'Error processing {holding.ticker}: {str(e)}')
                )
        
        self.stdout.write('Compliance processing completed')
