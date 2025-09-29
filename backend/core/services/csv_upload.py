"""
CSV Upload Service for Client Holdings
"""

import csv
import os
from decimal import Decimal, InvalidOperation
from datetime import datetime
from typing import Dict, List, Tuple
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from core.models import Client, Holding, Transaction, CSVUpload
from core.services.market_data import MarketDataService
import logging

logger = logging.getLogger(__name__)

class CSVUploadService:
    """Service for processing CSV uploads of client holdings"""
    
    def __init__(self):
        self.market_service = MarketDataService()
    
    def process_csv_upload(self, csv_upload: CSVUpload) -> Dict:
        """Process a CSV upload and create holdings/transactions"""
        try:
            csv_upload.status = 'PROCESSING'
            csv_upload.save()
            
            # Read CSV file from uploaded file
            uploaded_file = csv_upload.file
            uploaded_file.seek(0)  # Reset file pointer to beginning
            
            # Decode the file content
            import io
            content = uploaded_file.read().decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(content))
            rows = list(csv_reader)
            
            csv_upload.records_processed = len(rows)
            csv_upload.save()
            
            successful = 0
            failed = 0
            errors = []
            
            for row_num, row in enumerate(rows, 1):
                try:
                    self._process_row(csv_upload.client, row)
                    successful += 1
                except Exception as e:
                    failed += 1
                    error_msg = f"Row {row_num}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(f"Error processing row {row_num}: {str(e)}")
            
            # Recompute portfolio value once at the end to reduce market data calls
            try:
                self._update_client_portfolio_value(csv_upload.client)
            except Exception as e:
                logger.warning(f"Portfolio value recompute failed: {e}")
            
            csv_upload.records_successful = successful
            csv_upload.records_failed = failed
            csv_upload.error_message = '\n'.join(errors) if errors else ''
            csv_upload.status = 'COMPLETED' if failed == 0 else 'FAILED'
            csv_upload.save()
            
            return {
                'status': csv_upload.status,
                'records_processed': csv_upload.records_processed,
                'records_successful': csv_upload.records_successful,
                'records_failed': csv_upload.records_failed,
                'error_message': csv_upload.error_message
            }
            
        except Exception as e:
            csv_upload.status = 'FAILED'
            csv_upload.error_message = str(e)
            csv_upload.save()
            logger.error(f"Error processing CSV upload {csv_upload.id}: {str(e)}")
            return {
                'status': 'FAILED',
                'error': str(e)
            }
    
    def _process_row(self, client: Client, row: Dict) -> None:
        """Process a single row from the CSV"""
        # Expected CSV format:
        # ticker,name,sector,quantity,avg_cost,trade_date,side,fees
        
        ticker = row.get('ticker', '').strip().upper()
        name = row.get('name', '').strip()
        sector = row.get('sector', '').strip()
        quantity = self._parse_decimal(row.get('quantity', '0'))
        avg_cost = self._parse_decimal(row.get('avg_cost', '0'))
        trade_date = self._parse_date(row.get('trade_date', ''))
        side = row.get('side', 'BUY').strip().upper()
        fees = self._parse_decimal(row.get('fees', '0'))
        
        if not ticker or not name:
            raise ValueError("Ticker and name are required")
        
        if side not in ['BUY', 'SELL']:
            raise ValueError("Side must be BUY or SELL")
        
        # Get or create holding
        holding, created = Holding.objects.get_or_create(
            client=client,
            ticker=ticker,
            defaults={
                'name': name,
                'sector': sector,
                'isin': self._generate_isin(ticker),
                'sedol': self._generate_sedol(ticker)
            }
        )
        
        if not created:
            # Update name and sector if they've changed
            if holding.name != name:
                holding.name = name
            if holding.sector != sector:
                holding.sector = sector
            holding.save()
        
        # Create transaction
        _ = Transaction.objects.create(
            holding=holding,
            trade_date=trade_date,
            qty=quantity,
            price=avg_cost,
            fees=fees,
            side=side
        )
        
        # Maintain Section 104 pool for the holding
        from core.models import Section104Pool
        pool, _ = Section104Pool.objects.get_or_create(holding=holding)
        if side == 'BUY':
            pool.add_purchase(quantity, avg_cost, fees)
        else:
            pool.remove_disposal(quantity)
        
        # Defer portfolio value recompute to after all rows are processed
    
    def _parse_decimal(self, value: str) -> Decimal:
        """Parse a string value to Decimal"""
        if not value or value.strip() == '':
            return Decimal('0.00')
        
        try:
            # Remove currency symbols and commas
            cleaned = value.replace('£', '').replace('$', '').replace(',', '').strip()
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            raise ValueError(f"Invalid decimal value: {value}")
    
    def _parse_date(self, value: str) -> datetime.date:
        """Parse a string value to date"""
        if not value or value.strip() == '':
            return datetime.now().date()
        
        # Try different date formats
        date_formats = [
            '%Y-%m-%d',
            '%d/%m/%Y',
            '%m/%d/%Y',
            '%d-%m-%Y',
            '%Y/%m/%d'
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                continue
        
        raise ValueError(f"Invalid date format: {value}")
    
    def _generate_isin(self, ticker: str) -> str:
        """Generate a mock ISIN for the ticker"""
        # In a real application, this would be looked up from a database
        return f"GB00{ticker}0001"
    
    def _generate_sedol(self, ticker: str) -> str:
        """Generate a mock SEDOL for the ticker"""
        # In a real application, this would be looked up from a database
        return f"{ticker}0001"
    
    def _update_client_portfolio_value(self, client: Client) -> None:
        """Update client's total portfolio value"""
        total_value = Decimal('0.00')
        
        for holding in client.holdings.all():
            try:
                pool = holding.section104_pool
                if pool.pooled_qty > 0:
                    current_price = self.market_service.get_current_price(holding.ticker)
                    if current_price:
                        total_value += current_price * pool.pooled_qty
            except:
                continue
        
        client.total_portfolio_value = total_value
        client.save()
    
    def validate_csv_format(self, file_path: str) -> Tuple[bool, List[str]]:
        """Validate CSV format before processing"""
        errors = []
        
        try:
            with open(file_path, 'r') as file:
                reader = csv.DictReader(file)
                headers = reader.fieldnames
                
                required_headers = ['ticker', 'name', 'quantity', 'avg_cost']
                missing_headers = [h for h in required_headers if h not in headers]
                
                if missing_headers:
                    errors.append(f"Missing required headers: {', '.join(missing_headers)}")
                
                # Check first few rows for data validation
                for i, row in enumerate(reader):
                    if i >= 5:  # Only check first 5 rows
                        break
                    
                    if not row.get('ticker', '').strip():
                        errors.append(f"Row {i+2}: Ticker is required")
                    
                    if not row.get('name', '').strip():
                        errors.append(f"Row {i+2}: Name is required")
                    
                    try:
                        self._parse_decimal(row.get('quantity', '0'))
                    except ValueError as e:
                        errors.append(f"Row {i+2}: {str(e)}")
                    
                    try:
                        self._parse_decimal(row.get('avg_cost', '0'))
                    except ValueError as e:
                        errors.append(f"Row {i+2}: {str(e)}")
                    
                    try:
                        self._parse_date(row.get('trade_date', ''))
                    except ValueError as e:
                        errors.append(f"Row {i+2}: {str(e)}")
                
        except Exception as e:
            errors.append(f"Error reading CSV file: {str(e)}")
        
        return len(errors) == 0, errors
