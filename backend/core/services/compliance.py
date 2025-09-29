"""
UK CGT Compliance Engine

Implements Section 104 pooling and 30-day rule (bed & breakfasting) for UK Capital Gains Tax.
"""

from decimal import Decimal
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from django.db import transaction
from django.conf import settings

from core.models import Holding, Transaction, Section104Pool, DisposalMatch


class ComplianceEngine:
    """UK CGT compliance engine implementing Section 104 pooling and 30-day rule"""
    
    def __init__(self):
        self.thirty_day_days = getattr(settings, 'UK_30_DAY_RULE_DAYS', 30)
    
    def process_transactions_for_holding(self, holding: Holding) -> Dict:
        """
        Process all transactions for a holding and apply UK CGT rules.
        
        Returns:
            Dict with pool_updates, disposals, and matches
        """
        # Get all transactions for the holding, ordered by date
        transactions = Transaction.objects.filter(holding=holding).order_by('trade_date', 'created_at')
        
        # Get or create Section 104 pool
        pool, created = Section104Pool.objects.get_or_create(holding=holding)
        
        disposals = []
        matches = []
        
        for tx in transactions:
            if tx.side == 'BUY':
                # Add purchase to Section 104 pool
                pool.add_purchase(tx.qty, tx.price, tx.fees)
            elif tx.side == 'SELL':
                # Process disposal
                disposal_result = self._process_disposal(tx, pool)
                disposals.append(disposal_result['disposal'])
                matches.extend(disposal_result['matches'])
        
        return {
            'pool': pool,
            'disposals': disposals,
            'matches': matches
        }
    
    def _process_disposal(self, sell_tx: Transaction, pool: Section104Pool) -> Dict:
        """
        Process a disposal transaction applying UK CGT rules.
        
        Order of operations:
        1. Same-day same-security matching (if any)
        2. 30-day rule matching
        3. Section 104 pool for remainder
        """
        remaining_qty = sell_tx.qty
        disposal_matches = []
        disposal_info = {
            'transaction': sell_tx,
            'total_qty': sell_tx.qty,
            'matched_qty': Decimal('0.00'),
            'section104_qty': Decimal('0.00'),
            'total_gain_loss': Decimal('0.00'),
            'disallowed_loss': Decimal('0.00'),
            'matches': []
        }
        
        # Step 1: Check for same-day same-security matching
        same_day_matches = self._find_same_day_matches(sell_tx)
        for match in same_day_matches:
            if remaining_qty <= 0:
                break
            
            match_qty = min(remaining_qty, match['qty'])
            match_gain_loss = self._calculate_gain_loss(
                sell_tx.price, match['price'], match_qty
            )
            
            # Same-day matches are not subject to 30-day rule
            disposal_matches.append({
                'buy_tx': match['transaction'],
                'qty': match_qty,
                'gain_loss': match_gain_loss,
                'disallowed': False
            })
            
            disposal_info['matches'].append({
                'type': 'same_day',
                'buy_tx': match['transaction'],
                'qty': match_qty,
                'gain_loss': match_gain_loss
            })
            
            remaining_qty -= match_qty
            disposal_info['matched_qty'] += match_qty
        
        # Step 2: Apply 30-day rule for remaining quantity
        if remaining_qty > 0:
            thirty_day_matches = self._find_thirty_day_matches(sell_tx)
            for match in thirty_day_matches:
                if remaining_qty <= 0:
                    break
                
                match_qty = min(remaining_qty, match['qty'])
                match_gain_loss = self._calculate_gain_loss(
                    sell_tx.price, match['price'], match_qty
                )
                
                # 30-day rule: if it's a loss, it's disallowed
                disallowed_loss = Decimal('0.00')
                if match_gain_loss < 0:
                    disallowed_loss = abs(match_gain_loss)
                
                # Create DisposalMatch record
                disposal_match = DisposalMatch.objects.create(
                    sell_tx=sell_tx,
                    matched_buy_tx=match['transaction'],
                    qty_matched=match_qty,
                    disallowed_loss=disallowed_loss
                )
                
                disposal_matches.append({
                    'buy_tx': match['transaction'],
                    'qty': match_qty,
                    'gain_loss': match_gain_loss,
                    'disallowed': disallowed_loss > 0
                })
                
                disposal_info['matches'].append({
                    'type': 'thirty_day',
                    'buy_tx': match['transaction'],
                    'qty': match_qty,
                    'gain_loss': match_gain_loss,
                    'disallowed_loss': disallowed_loss
                })
                
                remaining_qty -= match_qty
                disposal_info['matched_qty'] += match_qty
                disposal_info['disallowed_loss'] += disallowed_loss
        
        # Step 3: Apply Section 104 pool for remaining quantity
        if remaining_qty > 0:
            if remaining_qty > pool.pooled_qty:
                raise ValueError(f"Insufficient shares in Section 104 pool for disposal")
            
            avg_cost = pool.remove_disposal(remaining_qty)
            section104_gain_loss = self._calculate_gain_loss(
                sell_tx.price, avg_cost, remaining_qty
            )
            
            disposal_info['section104_qty'] = remaining_qty
            disposal_info['section104_avg_cost'] = avg_cost
            disposal_info['section104_gain_loss'] = section104_gain_loss
        
        # Calculate total gain/loss
        total_gain_loss = sum(match['gain_loss'] for match in disposal_matches)
        if 'section104_gain_loss' in disposal_info:
            total_gain_loss += disposal_info['section104_gain_loss']
        
        disposal_info['total_gain_loss'] = total_gain_loss
        
        return {
            'disposal': disposal_info,
            'matches': disposal_matches
        }
    
    def _find_same_day_matches(self, sell_tx: Transaction) -> List[Dict]:
        """Find same-day same-security purchases for matching"""
        same_day_buys = Transaction.objects.filter(
            holding=sell_tx.holding,
            side='BUY',
            trade_date=sell_tx.trade_date
        ).exclude(id=sell_tx.id).order_by('created_at')
        
        matches = []
        for buy_tx in same_day_buys:
            matches.append({
                'transaction': buy_tx,
                'qty': buy_tx.qty,
                'price': buy_tx.price
            })
        
        return matches
    
    def _find_thirty_day_matches(self, sell_tx: Transaction) -> List[Dict]:
        """Find purchases within 30 days after the sale for 30-day rule matching"""
        thirty_days_later = sell_tx.trade_date + timedelta(days=self.thirty_day_days)
        
        thirty_day_buys = Transaction.objects.filter(
            holding=sell_tx.holding,
            side='BUY',
            trade_date__gt=sell_tx.trade_date,
            trade_date__lte=thirty_days_later
        ).order_by('trade_date', 'created_at')
        
        matches = []
        for buy_tx in thirty_day_buys:
            matches.append({
                'transaction': buy_tx,
                'qty': buy_tx.qty,
                'price': buy_tx.price
            })
        
        return matches
    
    def _calculate_gain_loss(self, sell_price: Decimal, buy_price: Decimal, qty: Decimal) -> Decimal:
        """Calculate gain/loss for a matched quantity"""
        return (sell_price - buy_price) * qty
    
    def apply_section_104(self, transactions_for_holding: List[Transaction]) -> Tuple[Section104Pool, List[Dict]]:
        """
        Apply Section 104 pooling to transactions for a holding.
        
        Returns:
            Tuple of (pool_updates, disposals)
        """
        if not transactions_for_holding:
            return None, []
        
        holding = transactions_for_holding[0].holding
        result = self.process_transactions_for_holding(holding)
        
        return result['pool'], result['disposals']
    
    def match_30_day(self, sell_tx: Transaction, subsequent_buys_within_30d: List[Transaction]) -> List[DisposalMatch]:
        """
        Match a sell transaction with subsequent buys within 30 days.
        
        Returns:
            List of DisposalMatch objects
        """
        matches = []
        remaining_qty = sell_tx.qty
        
        for buy_tx in subsequent_buys_within_30d:
            if remaining_qty <= 0:
                break
            
            match_qty = min(remaining_qty, buy_tx.qty)
            match_gain_loss = self._calculate_gain_loss(sell_tx.price, buy_tx.price, match_qty)
            
            # Calculate disallowed loss (if it's a loss)
            disallowed_loss = Decimal('0.00')
            if match_gain_loss < 0:
                disallowed_loss = abs(match_gain_loss)
            
            disposal_match = DisposalMatch.objects.create(
                sell_tx=sell_tx,
                matched_buy_tx=buy_tx,
                qty_matched=match_qty,
                disallowed_loss=disallowed_loss
            )
            
            matches.append(disposal_match)
            remaining_qty -= match_qty
        
        return matches
    
    def compute_disposal_gain_loss(self, sell_tx: Transaction, section104_avg_cost: Decimal, matched_quantities: List[Dict]) -> Decimal:
        """
        Compute total gain/loss for a disposal.
        
        Args:
            sell_tx: The sell transaction
            section104_avg_cost: Average cost from Section 104 pool
            matched_quantities: List of matched quantities with their costs
            
        Returns:
            Total gain/loss
        """
        total_gain_loss = Decimal('0.00')
        
        # Add gain/loss from matched quantities
        for match in matched_quantities:
            match_gain_loss = self._calculate_gain_loss(
                sell_tx.price, match['cost'], match['qty']
            )
            total_gain_loss += match_gain_loss
        
        # Add gain/loss from Section 104 pool (remaining quantity)
        remaining_qty = sell_tx.qty - sum(match['qty'] for match in matched_quantities)
        if remaining_qty > 0:
            section104_gain_loss = self._calculate_gain_loss(
                sell_tx.price, section104_avg_cost, remaining_qty
            )
            total_gain_loss += section104_gain_loss
        
        return total_gain_loss


# Global compliance engine instance
compliance_engine = ComplianceEngine()
