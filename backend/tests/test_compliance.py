"""
Tests for UK CGT compliance engine
"""

import pytest
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.db import transaction

from core.models import Holding, Transaction, Section104Pool, DisposalMatch
from core.services.compliance import compliance_engine


class ComplianceEngineTestCase(TestCase):
    """Test cases for UK CGT compliance engine"""
    
    def setUp(self):
        """Set up test data"""
        self.holding = Holding.objects.create(
            isin='GB00ABC00001',
            sedol='0000001',
            ticker='ABC',
            name='ABC Corporation'
        )
        
        self.holding2 = Holding.objects.create(
            isin='GB00XYZ00002',
            sedol='0000002',
            ticker='XYZ',
            name='XYZ Corporation'
        )
    
    def test_section_104_pooling_basic(self):
        """Test basic Section 104 pooling functionality"""
        # Create purchases
        buy1 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            fees=Decimal('1.00'),
            side='BUY'
        )
        
        buy2 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 2, 5),
            qty=Decimal('100'),
            price=Decimal('20.00'),
            fees=Decimal('1.00'),
            side='BUY'
        )
        
        # Process transactions
        result = compliance_engine.process_transactions_for_holding(self.holding)
        pool = result['pool']
        
        # Check pool state
        self.assertEqual(pool.pooled_qty, Decimal('200'))
        self.assertEqual(pool.pooled_cost, Decimal('3002.00'))  # (100*10+1) + (100*20+1)
        self.assertEqual(pool.avg_cost, Decimal('15.01'))  # 3002/200
    
    def test_section_104_disposal(self):
        """Test Section 104 disposal calculation"""
        # Set up pool with known state
        pool = Section104Pool.objects.create(
            holding=self.holding,
            pooled_qty=Decimal('200'),
            pooled_cost=Decimal('3000.00')
        )
        
        # Create disposal
        sell = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('50'),
            price=Decimal('12.00'),
            fees=Decimal('1.00'),
            side='SELL'
        )
        
        # Process disposal
        result = compliance_engine._process_disposal(sell, pool)
        disposal = result['disposal']
        
        # Check disposal calculation
        self.assertEqual(disposal['section104_qty'], Decimal('50'))
        self.assertEqual(disposal['section104_avg_cost'], Decimal('15.00'))
        self.assertEqual(disposal['section104_gain_loss'], Decimal('-150.00'))  # (12-15)*50
        
        # Check pool updated
        pool.refresh_from_db()
        self.assertEqual(pool.pooled_qty, Decimal('150'))
        self.assertEqual(pool.pooled_cost, Decimal('2250.00'))
    
    def test_thirty_day_rule_matching(self):
        """Test 30-day rule matching"""
        # Create initial purchase
        buy1 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            side='BUY'
        )
        
        # Create disposal
        sell = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('50'),
            price=Decimal('12.00'),
            side='SELL'
        )
        
        # Create repurchase within 30 days
        buy2 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 20),
            qty=Decimal('50'),
            price=Decimal('12.50'),
            side='BUY'
        )
        
        # Process transactions
        result = compliance_engine.process_transactions_for_holding(self.holding)
        
        # Check that 30-day match was created
        matches = result['matches']
        self.assertEqual(len(matches), 1)
        
        match = matches[0]
        self.assertEqual(match.sell_tx, sell)
        self.assertEqual(match.matched_buy_tx, buy2)
        self.assertEqual(match.qty_matched, Decimal('50'))
        self.assertEqual(match.disallowed_loss, Decimal('25.00'))  # (12-12.50)*50
    
    def test_thirty_day_rule_no_match(self):
        """Test 30-day rule when no repurchase within 30 days"""
        # Create initial purchase
        buy1 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            side='BUY'
        )
        
        # Create disposal
        sell = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('50'),
            price=Decimal('12.00'),
            side='SELL'
        )
        
        # Create repurchase after 30 days
        buy2 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 4, 15),  # 36 days later
            qty=Decimal('50'),
            price=Decimal('12.50'),
            side='BUY'
        )
        
        # Process transactions
        result = compliance_engine.process_transactions_for_holding(self.holding)
        
        # Check that no 30-day match was created
        matches = result['matches']
        self.assertEqual(len(matches), 0)
        
        # Check disposal uses Section 104 pool
        disposals = result['disposals']
        self.assertEqual(len(disposals), 1)
        disposal = disposals[0]
        self.assertEqual(disposal['section104_qty'], Decimal('50'))
        self.assertEqual(disposal['disallowed_loss'], Decimal('0.00'))
    
    def test_same_day_matching(self):
        """Test same-day same-security matching"""
        # Create same-day transactions
        buy = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            side='BUY'
        )
        
        sell = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('50'),
            price=Decimal('12.00'),
            side='SELL'
        )
        
        # Process transactions
        result = compliance_engine.process_transactions_for_holding(self.holding)
        
        # Check that same-day match was found
        disposals = result['disposals']
        self.assertEqual(len(disposals), 1)
        disposal = disposals[0]
        
        # Check that 50 shares were matched same-day
        self.assertEqual(disposal['matched_qty'], Decimal('50'))
        self.assertEqual(disposal['section104_qty'], Decimal('0'))
        
        # Check pool state (only unmatched purchase)
        pool = result['pool']
        self.assertEqual(pool.pooled_qty, Decimal('50'))
    
    def test_complex_scenario(self):
        """Test complex scenario with multiple rules"""
        # Create initial purchases
        buy1 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            side='BUY'
        )
        
        buy2 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 2, 5),
            qty=Decimal('100'),
            price=Decimal('20.00'),
            side='BUY'
        )
        
        # Create disposal
        sell = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('75'),
            price=Decimal('12.00'),
            side='SELL'
        )
        
        # Create repurchase within 30 days
        buy3 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 20),
            qty=Decimal('50'),
            price=Decimal('12.50'),
            side='BUY'
        )
        
        # Process transactions
        result = compliance_engine.process_transactions_for_holding(self.holding)
        
        # Check 30-day match
        matches = result['matches']
        self.assertEqual(len(matches), 1)
        match = matches[0]
        self.assertEqual(match.qty_matched, Decimal('50'))
        self.assertEqual(match.disallowed_loss, Decimal('25.00'))
        
        # Check disposal
        disposals = result['disposals']
        self.assertEqual(len(disposals), 1)
        disposal = disposals[0]
        
        # 50 shares matched, 25 shares from Section 104 pool
        self.assertEqual(disposal['matched_qty'], Decimal('50'))
        self.assertEqual(disposal['section104_qty'], Decimal('25'))
        self.assertEqual(disposal['disallowed_loss'], Decimal('25.00'))
        
        # Check pool state
        pool = result['pool']
        self.assertEqual(pool.pooled_qty, Decimal('125'))  # 200 - 25 (Section 104 portion)
    
    def test_annual_exempt_amount_calculation(self):
        """Test Annual Exempt Amount application"""
        # Create multiple disposals with gains and losses
        buy1 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            side='BUY'
        )
        
        buy2 = Transaction.objects.create(
            holding=self.holding2,
            trade_date=date(2024, 1, 15),
            qty=Decimal('100'),
            price=Decimal('50.00'),
            side='BUY'
        )
        
        # Create disposal with loss
        sell1 = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('50'),
            price=Decimal('8.00'),
            side='SELL'
        )
        
        # Create disposal with gain
        sell2 = Transaction.objects.create(
            holding=self.holding2,
            trade_date=date(2024, 3, 15),
            qty=Decimal('50'),
            price=Decimal('60.00'),
            side='SELL'
        )
        
        # Process transactions
        result1 = compliance_engine.process_transactions_for_holding(self.holding)
        result2 = compliance_engine.process_transactions_for_holding(self.holding2)
        
        # Check individual disposals
        disposal1 = result1['disposals'][0]
        disposal2 = result2['disposals'][0]
        
        # First disposal: loss of £100 (8-10)*50
        self.assertEqual(disposal1['total_gain_loss'], Decimal('-100.00'))
        
        # Second disposal: gain of £500 (60-50)*50
        self.assertEqual(disposal2['total_gain_loss'], Decimal('500.00'))
        
        # Net gain: £400, after AEA: £100 taxable
        # This would be calculated in the reporting service
    
    def test_loss_carry_forward(self):
        """Test loss carry-forward calculation"""
        # Create purchase
        buy = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            side='BUY'
        )
        
        # Create disposal with large loss
        sell = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('100'),
            price=Decimal('5.00'),
            side='SELL'
        )
        
        # Process transactions
        result = compliance_engine.process_transactions_for_holding(self.holding)
        
        # Check disposal
        disposal = result['disposals'][0]
        self.assertEqual(disposal['total_gain_loss'], Decimal('-500.00'))
        
        # This loss would be carried forward to offset future gains
        # The carry-forward calculation is handled in the reporting service
    
    def test_edge_cases(self):
        """Test edge cases and error conditions"""
        # Test disposal of more than available in pool
        pool = Section104Pool.objects.create(
            holding=self.holding,
            pooled_qty=Decimal('100'),
            pooled_cost=Decimal('1000.00')
        )
        
        sell = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('150'),  # More than available
            price=Decimal('12.00'),
            side='SELL'
        )
        
        # This should raise an error
        with self.assertRaises(ValueError):
            compliance_engine._process_disposal(sell, pool)
        
        # Test zero quantity disposal
        sell_zero = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('0'),
            price=Decimal('12.00'),
            side='SELL'
        )
        
        result = compliance_engine._process_disposal(sell_zero, pool)
        disposal = result['disposal']
        self.assertEqual(disposal['total_gain_loss'], Decimal('0.00'))
    
    def test_precision_handling(self):
        """Test decimal precision handling"""
        # Create purchase with precise decimal values
        buy = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100.123456'),
            price=Decimal('10.123456'),
            fees=Decimal('1.123456'),
            side='BUY'
        )
        
        # Process transaction
        result = compliance_engine.process_transactions_for_holding(self.holding)
        pool = result['pool']
        
        # Check precision is maintained
        expected_cost = Decimal('100.123456') * Decimal('10.123456') + Decimal('1.123456')
        self.assertEqual(pool.pooled_cost, expected_cost)
        self.assertEqual(pool.avg_cost, expected_cost / Decimal('100.123456'))


class ComplianceEngineIntegrationTestCase(TestCase):
    """Integration tests for compliance engine with dummy portfolio"""
    
    def test_dummy_portfolio_compliance(self):
        """Test compliance engine with dummy portfolio data"""
        # This test would load the dummy portfolio and verify compliance calculations
        # For now, we'll test the key scenarios from the dummy data
        
        # Create ABC holding
        abc_holding = Holding.objects.create(
            isin='GB00ABC00001',
            sedol='0000001',
            ticker='ABC',
            name='ABC Corporation'
        )
        
        # Create transactions from dummy portfolio
        transactions = [
            # 2024-01-10: BUY 100 @ £10.00
            Transaction.objects.create(
                holding=abc_holding,
                trade_date=date(2024, 1, 10),
                qty=Decimal('100'),
                price=Decimal('10.00'),
                fees=Decimal('1.00'),
                side='BUY'
            ),
            # 2024-02-05: BUY 100 @ £20.00
            Transaction.objects.create(
                holding=abc_holding,
                trade_date=date(2024, 2, 5),
                qty=Decimal('100'),
                price=Decimal('20.00'),
                fees=Decimal('1.00'),
                side='BUY'
            ),
            # 2024-03-10: SELL 50 @ £12.00
            Transaction.objects.create(
                holding=abc_holding,
                trade_date=date(2024, 3, 10),
                qty=Decimal('50'),
                price=Decimal('12.00'),
                fees=Decimal('1.00'),
                side='SELL'
            ),
            # 2024-03-20: BUY 50 @ £12.50 (within 30 days)
            Transaction.objects.create(
                holding=abc_holding,
                trade_date=date(2024, 3, 20),
                qty=Decimal('50'),
                price=Decimal('12.50'),
                fees=Decimal('1.00'),
                side='BUY'
            ),
        ]
        
        # Process transactions
        result = compliance_engine.process_transactions_for_holding(abc_holding)
        
        # Verify Section 104 pool state
        pool = result['pool']
        self.assertEqual(pool.pooled_qty, Decimal('150'))  # 200 - 50 (Section 104 portion)
        self.assertEqual(pool.avg_cost, Decimal('15.01'))  # (100*10+1 + 100*20+1) / 200
        
        # Verify 30-day match
        matches = result['matches']
        self.assertEqual(len(matches), 1)
        match = matches[0]
        self.assertEqual(match.qty_matched, Decimal('50'))
        self.assertEqual(match.disallowed_loss, Decimal('25.00'))  # (12-12.50)*50
        
        # Verify disposal
        disposals = result['disposals']
        self.assertEqual(len(disposals), 1)
        disposal = disposals[0]
        self.assertEqual(disposal['matched_qty'], Decimal('50'))
        self.assertEqual(disposal['section104_qty'], Decimal('0'))  # All matched
        self.assertEqual(disposal['disallowed_loss'], Decimal('25.00'))
