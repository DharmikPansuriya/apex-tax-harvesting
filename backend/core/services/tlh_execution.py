"""
TLH Execution Service

Handles the execution of Tax Loss Harvesting trades, including:
- Creating TLH execution records
- Executing sell transactions
- Suggesting replacement securities
- Managing the complete TLH workflow
"""

from decimal import Decimal
import logging
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple
from django.db import transaction
from django.core.exceptions import ValidationError

from core.models import (
    Client, Holding, Transaction, Section104Pool, 
    TLHExecution, DisposalMatch
)
from core.services.compliance import ComplianceEngine
from core.services.market_data import MarketDataService


class TLHExecutionService:
    """Service for executing Tax Loss Harvesting trades"""
    
    def __init__(self):
        self.compliance_engine = ComplianceEngine()
        self.market_service = MarketDataService()
    
    def create_tlh_execution(
        self, 
        client: Client, 
        holding: Holding, 
        sell_price: Optional[Decimal] = None,
        sell_fees: Decimal = Decimal('0.00'),
        replacement_ticker: Optional[str] = None,
        replacement_name: Optional[str] = None,
        replacement_qty: Optional[Decimal] = None,
        replacement_price: Optional[Decimal] = None,
        replacement_fees: Decimal = Decimal('0.00'),
        notes: str = ""
    ) -> TLHExecution:
        """
        Create a new TLH execution record
        
        Args:
            client: The client executing the TLH
            holding: The holding to harvest losses from
            sell_price: Price to sell at (if None, uses current market price)
            sell_fees: Fees for the sell transaction
            replacement_ticker: Ticker for replacement security
            replacement_name: Name for replacement security
            replacement_qty: Quantity for replacement security
            replacement_price: Price for replacement security
            replacement_fees: Fees for replacement transaction
            notes: Additional notes
            
        Returns:
            TLHExecution object
        """
        # Validate holding belongs to client
        if holding.client != client:
            raise ValidationError("Holding does not belong to the specified client")
        
        # Get current position details
        try:
            pool = holding.section104_pool
            if pool.pooled_qty <= 0:
                raise ValidationError("No shares available for TLH execution")
        except Section104Pool.DoesNotExist:
            raise ValidationError("No Section 104 pool found for this holding")
        
        # Calculate unrealised loss
        # Use explicit None check so Decimal('0.00') does not evaluate as missing
        current_price = (
            sell_price if sell_price is not None else self.market_service.get_current_price(holding.ticker)
        )

        # Debug logging before validation to ensure visibility
        print(f"current_price: {current_price}")
        print(f"pool.avg_cost: {pool.avg_cost}")
        print(f"pool.pooled_qty: {pool.pooled_qty}")

        if current_price is None:
            raise ValidationError("Unable to get current market price")

        unrealised_loss = (pool.avg_cost - current_price) * pool.pooled_qty
        print(f"unrealised_loss: {unrealised_loss}")
        
        # Only allow TLH if there's an unrealised loss
        # With unrealised_loss = (avg_cost - current_price) * qty,
        # a loss yields a POSITIVE value. Block only when <= 0 (no loss or a gain).
        if unrealised_loss <= 0:
            raise ValidationError("No unrealised loss available for harvesting")
        
        # Check 30-day rule compliance
        thirty_day_check = self._check_thirty_day_compliance(holding)
        if thirty_day_check['blocked']:
            raise ValidationError(f"TLH blocked by 30-day rule: {thirty_day_check['message']}")
        
        # Create TLH execution record
        tlh_execution = TLHExecution.objects.create(
            client=client,
            holding=holding,
            original_qty=pool.pooled_qty,
            original_avg_cost=pool.avg_cost,
            original_unrealised_loss=unrealised_loss,
            sell_price=current_price,
            sell_fees=sell_fees,
            sell_date=date.today(),
            replacement_ticker=replacement_ticker or "",
            replacement_name=replacement_name or "",
            replacement_qty=replacement_qty,
            replacement_price=replacement_price,
            replacement_fees=replacement_fees,
            notes=notes,
            status='PENDING'
        )
        
        return tlh_execution
    
    def execute_tlh(self, tlh_execution: TLHExecution) -> Dict:
        """
        Execute a TLH trade by creating the necessary transactions
        
        Args:
            tlh_execution: The TLH execution to process
            
        Returns:
            Dict with execution results
        """
        try:
            with transaction.atomic():
                # Create sell transaction
                sell_tx = Transaction.objects.create(
                    holding=tlh_execution.holding,
                    trade_date=tlh_execution.sell_date,
                    qty=tlh_execution.original_qty,
                    price=tlh_execution.sell_price,
                    fees=tlh_execution.sell_fees,
                    side='SELL',
                    account='GIA'
                )
                
                # Create replacement transaction if specified
                replacement_tx = None
                if (tlh_execution.replacement_ticker and 
                    tlh_execution.replacement_qty and 
                    tlh_execution.replacement_price):
                    
                    # Create or get replacement holding
                    replacement_holding, created = Holding.objects.get_or_create(
                        client=tlh_execution.client,
                        ticker=tlh_execution.replacement_ticker,
                        defaults={
                            'name': tlh_execution.replacement_name,
                            'isin': self._generate_isin(tlh_execution.replacement_ticker),
                            'sedol': self._generate_sedol(tlh_execution.replacement_ticker)
                        }
                    )
                    
                    # Create buy transaction for replacement
                    replacement_tx = Transaction.objects.create(
                        holding=replacement_holding,
                        trade_date=tlh_execution.replacement_date or tlh_execution.sell_date,
                        qty=tlh_execution.replacement_qty,
                        price=tlh_execution.replacement_price,
                        fees=tlh_execution.replacement_fees,
                        side='BUY',
                        account='GIA'
                    )
                
                # Update TLH execution status
                tlh_execution.status = 'EXECUTED'
                tlh_execution.save()
                
                # Process compliance for both holdings
                self.compliance_engine.process_transactions_for_holding(tlh_execution.holding)
                if replacement_tx:
                    self.compliance_engine.process_transactions_for_holding(replacement_tx.holding)
                
                return {
                    'status': 'success',
                    'tlh_execution_id': str(tlh_execution.id),
                    'sell_transaction_id': str(sell_tx.id),
                    'replacement_transaction_id': str(replacement_tx.id) if replacement_tx else None,
                    'realised_loss': float(tlh_execution.realised_loss),
                    'net_proceeds': float(tlh_execution.net_proceeds)
                }
                
        except Exception as e:
            tlh_execution.status = 'FAILED'
            tlh_execution.notes = f"Execution failed: {str(e)}"
            tlh_execution.save()
            raise ValidationError(f"TLH execution failed: {str(e)}")
    
    def suggest_replacements(self, holding: Holding, limit: int = 5) -> List[Dict]:
        """
        Suggest replacement securities for TLH
        
        Args:
            holding: The holding being harvested
            limit: Maximum number of suggestions
            
        Returns:
            List of replacement suggestions
        """
        # Get UK securities from market data service
        uk_securities = self.market_service.get_top_uk_securities()
        
        # Filter out the same security and similar ones
        suggestions = []
        for security in uk_securities:
            if (security['ticker'] != holding.ticker and 
                security.get('sector') != holding.sector):  # Different sector to avoid wash sale
                
                current_price = self.market_service.get_current_price(security['ticker'])
                if current_price:
                    suggestions.append({
                        'ticker': security['ticker'],
                        'name': security['name'],
                        'sector': security.get('sector', 'Unknown'),
                        'current_price': float(current_price),
                        'market_cap': security.get('market_cap', 'Unknown'),
                        'description': f"Similar exposure in {security.get('sector', 'different sector')}"
                    })
        
        return suggestions[:limit]
    
    def _check_thirty_day_compliance(self, holding: Holding) -> Dict:
        """Check if holding is compliant with 30-day rule"""
        thirty_days_ago = datetime.now().date() - timedelta(days=30)
        
        recent_sales = Transaction.objects.filter(
            holding=holding,
            side='SELL',
            trade_date__gte=thirty_days_ago
        ).order_by('-trade_date')
        
        if recent_sales.exists():
            latest_sale = recent_sales.first()
            days_since_sale = (datetime.now().date() - latest_sale.trade_date).days
            return {
                'blocked': True,
                'days_remaining': 30 - days_since_sale,
                'last_sale_date': latest_sale.trade_date,
                'message': f"Within 30 days of prior sell — harvesting blocked for {30 - days_since_sale} more days"
            }
        
        return {'blocked': False}
    
    def _generate_isin(self, ticker: str) -> str:
        """Generate a mock ISIN for a ticker"""
        return f"GB00{ticker.replace('.L', '')}0001"
    
    def _generate_sedol(self, ticker: str) -> str:
        """Generate a mock SEDOL for a ticker"""
        return f"{ticker.replace('.L', '')}0001"
    
    def get_tlh_executions(self, client: Client, status: Optional[str] = None) -> List[TLHExecution]:
        """
        Get TLH executions for a client
        
        Args:
            client: The client
            status: Optional status filter
            
        Returns:
            List of TLH executions
        """
        queryset = TLHExecution.objects.filter(client=client)
        if status:
            queryset = queryset.filter(status=status)
        return queryset.order_by('-created_at')
    
    def cancel_tlh_execution(self, tlh_execution: TLHExecution) -> bool:
        """
        Cancel a pending TLH execution
        
        Args:
            tlh_execution: The TLH execution to cancel
            
        Returns:
            True if successful
        """
        if tlh_execution.status != 'PENDING':
            raise ValidationError("Only pending TLH executions can be cancelled")
        
        tlh_execution.status = 'CANCELLED'
        tlh_execution.save()
        return True


# Global TLH execution service instance
tlh_execution_service = TLHExecutionService()
