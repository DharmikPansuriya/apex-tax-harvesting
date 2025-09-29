"""
Tests for Django models
"""

import pytest
from decimal import Decimal
from datetime import date
from django.test import TestCase
from django.core.exceptions import ValidationError

from core.models import Holding, Transaction, Section104Pool, DisposalMatch, CGTReport


class HoldingModelTestCase(TestCase):
    """Test cases for Holding model"""
    
    def test_holding_creation(self):
        """Test basic holding creation"""
        holding = Holding.objects.create(
            isin='GB00ABC00001',
            sedol='0000001',
            ticker='ABC',
            name='ABC Corporation'
        )
        
        self.assertEqual(holding.isin, 'GB00ABC00001')
        self.assertEqual(holding.sedol, '0000001')
        self.assertEqual(holding.ticker, 'ABC')
        self.assertEqual(holding.name, 'ABC Corporation')
        self.assertIsNotNone(holding.id)
        self.assertIsNotNone(holding.created_at)
        self.assertIsNotNone(holding.updated_at)
    
    def test_holding_str_representation(self):
        """Test string representation of holding"""
        holding = Holding.objects.create(
            isin='GB00ABC00001',
            sedol='0000001',
            ticker='ABC',
            name='ABC Corporation'
        )
        
        expected = "ABC (ABC Corporation)"
        self.assertEqual(str(holding), expected)
    
    def test_holding_unique_constraint(self):
        """Test unique constraint on isin and sedol"""
        Holding.objects.create(
            isin='GB00ABC00001',
            sedol='0000001',
            ticker='ABC',
            name='ABC Corporation'
        )
        
        # Should raise IntegrityError for duplicate
        with self.assertRaises(Exception):
            Holding.objects.create(
                isin='GB00ABC00001',
                sedol='0000001',
                ticker='ABC2',
                name='ABC Corporation 2'
            )


class TransactionModelTestCase(TestCase):
    """Test cases for Transaction model"""
    
    def setUp(self):
        """Set up test data"""
        self.holding = Holding.objects.create(
            isin='GB00ABC00001',
            sedol='0000001',
            ticker='ABC',
            name='ABC Corporation'
        )
    
    def test_transaction_creation(self):
        """Test basic transaction creation"""
        transaction = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            fees=Decimal('1.00'),
            side='BUY'
        )
        
        self.assertEqual(transaction.holding, self.holding)
        self.assertEqual(transaction.trade_date, date(2024, 1, 10))
        self.assertEqual(transaction.qty, Decimal('100'))
        self.assertEqual(transaction.price, Decimal('10.00'))
        self.assertEqual(transaction.fees, Decimal('1.00'))
        self.assertEqual(transaction.side, 'BUY')
        self.assertIsNotNone(transaction.id)
        self.assertIsNotNone(transaction.created_at)
    
    def test_transaction_str_representation(self):
        """Test string representation of transaction"""
        transaction = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            fees=Decimal('1.00'),
            side='BUY'
        )
        
        expected = "BUY 100 ABC @ 10.00 on 2024-01-10"
        self.assertEqual(str(transaction), expected)
    
    def test_transaction_total_value(self):
        """Test total value calculation"""
        transaction = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            fees=Decimal('1.00'),
            side='BUY'
        )
        
        expected_total = Decimal('100') * Decimal('10.00')
        self.assertEqual(transaction.total_value, expected_total)
    
    def test_transaction_net_value_buy(self):
        """Test net value calculation for buy transaction"""
        transaction = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            fees=Decimal('1.00'),
            side='BUY'
        )
        
        expected_net = Decimal('100') * Decimal('10.00') + Decimal('1.00')
        self.assertEqual(transaction.net_value, expected_net)
    
    def test_transaction_net_value_sell(self):
        """Test net value calculation for sell transaction"""
        transaction = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            fees=Decimal('1.00'),
            side='SELL'
        )
        
        expected_net = Decimal('100') * Decimal('10.00') - Decimal('1.00')
        self.assertEqual(transaction.net_value, expected_net)
    
    def test_transaction_side_choices(self):
        """Test transaction side choices"""
        # Valid choices
        buy_transaction = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            side='BUY'
        )
        
        sell_transaction = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 1, 10),
            qty=Decimal('100'),
            price=Decimal('10.00'),
            side='SELL'
        )
        
        self.assertEqual(buy_transaction.side, 'BUY')
        self.assertEqual(sell_transaction.side, 'SELL')


class Section104PoolModelTestCase(TestCase):
    """Test cases for Section104Pool model"""
    
    def setUp(self):
        """Set up test data"""
        self.holding = Holding.objects.create(
            isin='GB00ABC00001',
            sedol='0000001',
            ticker='ABC',
            name='ABC Corporation'
        )
    
    def test_section104_pool_creation(self):
        """Test basic Section 104 pool creation"""
        pool = Section104Pool.objects.create(
            holding=self.holding,
            pooled_qty=Decimal('100'),
            pooled_cost=Decimal('1000.00')
        )
        
        self.assertEqual(pool.holding, self.holding)
        self.assertEqual(pool.pooled_qty, Decimal('100'))
        self.assertEqual(pool.pooled_cost, Decimal('1000.00'))
        self.assertIsNotNone(pool.id)
        self.assertIsNotNone(pool.created_at)
        self.assertIsNotNone(pool.updated_at)
    
    def test_section104_pool_str_representation(self):
        """Test string representation of Section 104 pool"""
        pool = Section104Pool.objects.create(
            holding=self.holding,
            pooled_qty=Decimal('100'),
            pooled_cost=Decimal('1000.00')
        )
        
        expected = "Section 104 Pool for ABC: 100 @ 10.00"
        self.assertEqual(str(pool), expected)
    
    def test_section104_pool_avg_cost(self):
        """Test average cost calculation"""
        pool = Section104Pool.objects.create(
            holding=self.holding,
            pooled_qty=Decimal('100'),
            pooled_cost=Decimal('1000.00')
        )
        
        expected_avg_cost = Decimal('1000.00') / Decimal('100')
        self.assertEqual(pool.avg_cost, expected_avg_cost)
    
    def test_section104_pool_avg_cost_zero_qty(self):
        """Test average cost calculation with zero quantity"""
        pool = Section104Pool.objects.create(
            holding=self.holding,
            pooled_qty=Decimal('0'),
            pooled_cost=Decimal('0.00')
        )
        
        self.assertEqual(pool.avg_cost, Decimal('0.00'))
    
    def test_section104_pool_add_purchase(self):
        """Test adding purchase to pool"""
        pool = Section104Pool.objects.create(
            holding=self.holding,
            pooled_qty=Decimal('100'),
            pooled_cost=Decimal('1000.00')
        )
        
        pool.add_purchase(Decimal('50'), Decimal('12.00'), Decimal('2.00'))
        
        self.assertEqual(pool.pooled_qty, Decimal('150'))
        self.assertEqual(pool.pooled_cost, Decimal('1602.00'))  # 1000 + (50*12) + 2
    
    def test_section104_pool_remove_disposal(self):
        """Test removing disposal from pool"""
        pool = Section104Pool.objects.create(
            holding=self.holding,
            pooled_qty=Decimal('100'),
            pooled_cost=Decimal('1000.00')
        )
        
        avg_cost = pool.remove_disposal(Decimal('30'))
        
        self.assertEqual(pool.pooled_qty, Decimal('70'))
        self.assertEqual(pool.pooled_cost, Decimal('700.00'))  # 1000 - (30*10)
        self.assertEqual(avg_cost, Decimal('10.00'))
    
    def test_section104_pool_remove_disposal_insufficient(self):
        """Test removing disposal with insufficient quantity"""
        pool = Section104Pool.objects.create(
            holding=self.holding,
            pooled_qty=Decimal('100'),
            pooled_cost=Decimal('1000.00')
        )
        
        with self.assertRaises(ValueError):
            pool.remove_disposal(Decimal('150'))


class DisposalMatchModelTestCase(TestCase):
    """Test cases for DisposalMatch model"""
    
    def setUp(self):
        """Set up test data"""
        self.holding = Holding.objects.create(
            isin='GB00ABC00001',
            sedol='0000001',
            ticker='ABC',
            name='ABC Corporation'
        )
        
        self.sell_tx = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 10),
            qty=Decimal('50'),
            price=Decimal('12.00'),
            side='SELL'
        )
        
        self.buy_tx = Transaction.objects.create(
            holding=self.holding,
            trade_date=date(2024, 3, 20),
            qty=Decimal('50'),
            price=Decimal('12.50'),
            side='BUY'
        )
    
    def test_disposal_match_creation(self):
        """Test basic disposal match creation"""
        match = DisposalMatch.objects.create(
            sell_tx=self.sell_tx,
            matched_buy_tx=self.buy_tx,
            qty_matched=Decimal('50'),
            disallowed_loss=Decimal('25.00')
        )
        
        self.assertEqual(match.sell_tx, self.sell_tx)
        self.assertEqual(match.matched_buy_tx, self.buy_tx)
        self.assertEqual(match.qty_matched, Decimal('50'))
        self.assertEqual(match.disallowed_loss, Decimal('25.00'))
        self.assertIsNotNone(match.id)
        self.assertIsNotNone(match.created_at)
    
    def test_disposal_match_str_representation(self):
        """Test string representation of disposal match"""
        match = DisposalMatch.objects.create(
            sell_tx=self.sell_tx,
            matched_buy_tx=self.buy_tx,
            qty_matched=Decimal('50'),
            disallowed_loss=Decimal('25.00')
        )
        
        expected = "Match: 50 ABC (Disallowed: £25.00)"
        self.assertEqual(str(match), expected)


class CGTReportModelTestCase(TestCase):
    """Test cases for CGTReport model"""
    
    def test_cgt_report_creation(self):
        """Test basic CGT report creation"""
        totals = {
            'total_disposals': 5,
            'total_proceeds': 1000.00,
            'total_cost': 800.00,
            'gross_gains': 200.00,
            'gross_losses': 0.00,
            'disallowed_losses': 50.00,
            'net_gains': 200.00,
            'annual_exempt_amount': 3000.00,
            'taxable_gains': 0.00,
            'carry_forward_losses': 0.00
        }
        
        report = CGTReport.objects.create(
            tax_year='2024-25',
            totals=totals,
            csv_path='/reports/2024-25/cgt_report.csv',
            pdf_path='/reports/2024-25/cgt_report.pdf'
        )
        
        self.assertEqual(report.tax_year, '2024-25')
        self.assertEqual(report.totals, totals)
        self.assertEqual(report.csv_path, '/reports/2024-25/cgt_report.csv')
        self.assertEqual(report.pdf_path, '/reports/2024-25/cgt_report.pdf')
        self.assertIsNotNone(report.id)
        self.assertIsNotNone(report.created_at)
    
    def test_cgt_report_str_representation(self):
        """Test string representation of CGT report"""
        totals = {
            'total_disposals': 5,
            'total_proceeds': 1000.00,
            'total_cost': 800.00,
            'gross_gains': 200.00,
            'gross_losses': 0.00,
            'disallowed_losses': 50.00,
            'net_gains': 200.00,
            'annual_exempt_amount': 3000.00,
            'taxable_gains': 0.00,
            'carry_forward_losses': 0.00
        }
        
        report = CGTReport.objects.create(
            tax_year='2024-25',
            totals=totals
        )
        
        expected = f"CGT Report 2024-25 ({report.created_at.strftime('%Y-%m-%d')})"
        self.assertEqual(str(report), expected)
