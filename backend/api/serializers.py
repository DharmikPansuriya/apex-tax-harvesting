"""
DRF Serializers for TLH UK API
"""

from decimal import Decimal
from rest_framework import serializers
from core.models import (
    WealthManager, Client, Holding, Transaction, Section104Pool, 
    DisposalMatch, CGTReport, CSVUpload, TLHExecution
)


class WealthManagerSerializer(serializers.ModelSerializer):
    """Serializer for WealthManager model"""
    user = serializers.StringRelatedField(read_only=True)
    client_count = serializers.SerializerMethodField()
    
    class Meta:
        model = WealthManager
        fields = ['id', 'user', 'firm_name', 'license_number', 'phone', 'client_count', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_client_count(self, obj):
        return obj.clients.count()


class ClientSerializer(serializers.ModelSerializer):
    """Serializer for Client model"""
    wealth_manager = serializers.StringRelatedField(read_only=True)
    holding_count = serializers.SerializerMethodField()
    total_unrealised_pnl = serializers.SerializerMethodField()
    
    class Meta:
        model = Client
        fields = [
            'id', 'wealth_manager', 'first_name', 'last_name', 'email', 'phone',
            'date_of_birth', 'risk_profile', 'total_portfolio_value', 'holding_count',
            'total_unrealised_pnl', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_holding_count(self, obj):
        return obj.holdings.count()
    
    def get_total_unrealised_pnl(self, obj):
        # Calculate total unrealised P&L for all holdings
        total = Decimal('0.00')
        for holding in obj.holdings.all():
            try:
                pool = holding.section104_pool
                if pool.pooled_qty > 0:
                    # Use market data service to get current price
                    from core.services.market_data import MarketDataService
                    market_service = MarketDataService()
                    current_price = market_service.get_current_price(holding.ticker)
                    if current_price:
                        unrealised_pnl = (Decimal(str(current_price)) - pool.avg_cost) * pool.pooled_qty
                        total += unrealised_pnl
            except:
                continue
        return float(total)


class HoldingSerializer(serializers.ModelSerializer):
    """Serializer for Holding model"""
    section104_pool = serializers.SerializerMethodField()
    current_price = serializers.SerializerMethodField()
    unrealised_pnl = serializers.SerializerMethodField()
    unrealised_pnl_pct = serializers.SerializerMethodField()
    
    class Meta:
        model = Holding
        fields = [
            'id', 'isin', 'sedol', 'ticker', 'name', 'created_at', 'updated_at',
            'section104_pool', 'current_price', 'unrealised_pnl', 'unrealised_pnl_pct'
        ]
    
    def get_section104_pool(self, obj):
        """Get Section 104 pool information"""
        try:
            pool = obj.section104_pool
            return {
                'pooled_qty': pool.pooled_qty,
                'pooled_cost': pool.pooled_cost,
                'avg_cost': pool.avg_cost
            }
        except Section104Pool.DoesNotExist:
            return None
    
    def get_current_price(self, obj):
        """Get current market price from Yahoo Finance"""
        try:
            from core.services.market_data import MarketDataService
            market_service = MarketDataService()
            price = market_service.get_current_price(obj.ticker)
            return float(price) if price else 0.00
        except Exception:
            # If price unavailable, report 0; UI can show 'N/A' as needed
            return 0.00
    
    def get_unrealised_pnl(self, obj):
        """Calculate unrealised P&L"""
        try:
            pool = obj.section104_pool
            if pool.pooled_qty <= 0:
                return 0.00
            
            current_price = self.get_current_price(obj)
            return float((Decimal(str(current_price)) - pool.avg_cost) * pool.pooled_qty)
        except Section104Pool.DoesNotExist:
            return 0.00
    
    def get_unrealised_pnl_pct(self, obj):
        """Calculate unrealised P&L percentage"""
        try:
            pool = obj.section104_pool
            if pool.pooled_qty <= 0 or pool.avg_cost <= 0:
                return 0.00
            
            current_price = self.get_current_price(obj)
            return float(((Decimal(str(current_price)) - pool.avg_cost) / pool.avg_cost) * 100)
        except Section104Pool.DoesNotExist:
            return 0.00


class TransactionSerializer(serializers.ModelSerializer):
    """Serializer for Transaction model"""
    holding_ticker = serializers.CharField(source='holding.ticker', read_only=True)
    holding_name = serializers.CharField(source='holding.name', read_only=True)
    total_value = serializers.DecimalField(max_digits=20, decimal_places=6, read_only=True)
    net_value = serializers.DecimalField(max_digits=20, decimal_places=6, read_only=True)
    # Server-calculated convenience fields
    notional = serializers.SerializerMethodField()
    pl = serializers.SerializerMethodField()
    cost_basis_avg = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'holding', 'holding_ticker', 'holding_name', 'trade_date',
            'qty', 'price', 'fees', 'side', 'account',
            'total_value', 'net_value', 'notional', 'pl', 'cost_basis_avg',
            'created_at'
        ]

    def get_notional(self, obj):
        # Notional = qty * price (same as total_value)
        try:
            return obj.total_value
        except Exception:
            return None

    def get_cost_basis_avg(self, obj):
        # Average cost basis from Section 104 pool at time of serialization
        try:
            pool = obj.holding.section104_pool
            return pool.avg_cost
        except Exception:
            return None

    def get_pl(self, obj):
        # P/L only meaningful for SELL transactions: (sell_price - avg_cost) * qty - fees
        try:
            if obj.side != 'SELL':
                return None
            pool = obj.holding.section104_pool
            if pool is None or pool.avg_cost is None:
                return None
            return (obj.price - pool.avg_cost) * obj.qty - obj.fees
        except Exception:
            return None


class Section104PoolSerializer(serializers.ModelSerializer):
    """Serializer for Section104Pool model"""
    holding_ticker = serializers.CharField(source='holding.ticker', read_only=True)
    holding_name = serializers.CharField(source='holding.name', read_only=True)
    avg_cost = serializers.DecimalField(max_digits=20, decimal_places=6, read_only=True)
    
    class Meta:
        model = Section104Pool
        fields = [
            'id', 'holding', 'holding_ticker', 'holding_name',
            'pooled_qty', 'pooled_cost', 'avg_cost', 'created_at', 'updated_at'
        ]


class DisposalMatchSerializer(serializers.ModelSerializer):
    """Serializer for DisposalMatch model"""
    sell_tx_ticker = serializers.CharField(source='sell_tx.holding.ticker', read_only=True)
    sell_tx_date = serializers.DateField(source='sell_tx.trade_date', read_only=True)
    buy_tx_ticker = serializers.CharField(source='matched_buy_tx.holding.ticker', read_only=True)
    buy_tx_date = serializers.DateField(source='matched_buy_tx.trade_date', read_only=True)
    
    class Meta:
        model = DisposalMatch
        fields = [
            'id', 'sell_tx', 'matched_buy_tx', 'sell_tx_ticker', 'sell_tx_date',
            'buy_tx_ticker', 'buy_tx_date', 'qty_matched', 'disallowed_loss', 'created_at'
        ]


class CGTReportSerializer(serializers.ModelSerializer):
    """Serializer for CGTReport model"""
    csv_url = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    
    class Meta:
        model = CGTReport
        fields = [
            'id', 'user', 'tax_year', 'totals', 'csv_path', 'pdf_path',
            'csv_url', 'pdf_url', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'created_at']
    
    def get_csv_url(self, obj):
        """Get CSV download URL"""
        if obj.csv_path:
            return f"/api/reports/{obj.id}/download_csv/"
        return None
    
    def get_pdf_url(self, obj):
        """Get PDF download URL"""
        if obj.pdf_path:
            return f"/api/reports/{obj.id}/download_pdf/"
        return None


class CSVUploadSerializer(serializers.ModelSerializer):
    """Serializer for CSV upload"""
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    
    class Meta:
        model = CSVUpload
        fields = [
            'id', 'client', 'client_name', 'file', 'filename', 'status', 'error_message',
            'records_processed', 'records_successful', 'records_failed', 'created_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'filename', 'status', 'error_message',
            'records_processed', 'records_successful', 'records_failed'
        ]


class TLHOpportunitySerializer(serializers.Serializer):
    """Serializer for TLH opportunities"""
    holding_id = serializers.CharField()
    ticker = serializers.CharField()
    name = serializers.CharField()
    current_price = serializers.DecimalField(max_digits=20, decimal_places=6)
    avg_cost = serializers.DecimalField(max_digits=20, decimal_places=6)
    unrealised_pnl = serializers.DecimalField(max_digits=20, decimal_places=6)
    unrealised_pnl_pct = serializers.DecimalField(max_digits=20, decimal_places=6)
    pooled_qty = serializers.DecimalField(max_digits=20, decimal_places=6)
    score = serializers.FloatField()
    reason = serializers.CharField()
    constraints = serializers.DictField()
    eligible = serializers.BooleanField()
    
    def to_representation(self, instance):
        """Convert TLH opportunity data to API response"""
        return {
            'holding_id': instance['holding_id'],
            'ticker': instance['ticker'],
            'name': instance['name'],
            'current_price': instance['current_price'],
            'avg_cost': instance['avg_cost'],
            'unrealised_pnl': instance['unrealised_pnl'],
            'unrealised_pnl_pct': instance['unrealised_pnl_pct'],
            'pooled_qty': instance['pooled_qty'],
            'score': instance['score'],
            'reason': instance['reason'],
            'constraints': instance['constraints'],
            'eligible': not instance['constraints']['thirty_day_rule']['blocked']
        }


class TLHExecutionSerializer(serializers.ModelSerializer):
    """Serializer for TLH execution"""
    holding_ticker = serializers.CharField(source='holding.ticker', read_only=True)
    holding_name = serializers.CharField(source='holding.name', read_only=True)
    client_name = serializers.CharField(source='client.full_name', read_only=True)
    
    # Custom serializer fields to format display values
    original_avg_cost_display = serializers.SerializerMethodField()
    sell_price_display = serializers.SerializerMethodField()
    replacement_price_display = serializers.SerializerMethodField()
    original_qty_display = serializers.SerializerMethodField()
    replacement_qty_display = serializers.SerializerMethodField()
    
    # Calculated fields
    realised_loss = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    net_proceeds = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    original_investment = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    sale_proceeds = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    replacement_investment = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    tax_benefit = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    net_loss_after_tax = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)
    
    class Meta:
        model = TLHExecution
        fields = [
            'id', 'client', 'client_name', 'holding', 'holding_ticker', 'holding_name',
            'original_qty', 'original_avg_cost', 'original_unrealised_loss',
            'sell_price', 'sell_fees', 'sell_date',
            'replacement_ticker', 'replacement_name', 'replacement_qty', 
            'replacement_price', 'replacement_fees', 'replacement_date',
            'status', 'notes', 'realised_loss', 'net_proceeds',
            'original_investment', 'sale_proceeds', 'replacement_investment',
            'tax_benefit', 'net_loss_after_tax',
            'original_avg_cost_display', 'sell_price_display', 'replacement_price_display',
            'original_qty_display', 'replacement_qty_display',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'realised_loss', 'net_proceeds',
            'original_investment', 'sale_proceeds', 'replacement_investment',
            'tax_benefit', 'net_loss_after_tax'
        ]
    
    def get_original_avg_cost_display(self, obj):
        """Format original average cost to 2 decimal places"""
        return float(obj.original_avg_cost.quantize(Decimal('0.01')))
    
    def get_sell_price_display(self, obj):
        """Format sell price to 2 decimal places"""
        if obj.sell_price:
            return float(obj.sell_price.quantize(Decimal('0.01')))
        return None
    
    def get_replacement_price_display(self, obj):
        """Format replacement price to 2 decimal places"""
        if obj.replacement_price:
            return float(obj.replacement_price.quantize(Decimal('0.01')))
        return None
    
    def get_original_qty_display(self, obj):
        """Format original quantity to 0 decimal places (whole shares)"""
        return int(obj.original_qty.quantize(Decimal('1')))
    
    def get_replacement_qty_display(self, obj):
        """Format replacement quantity to 0 decimal places (whole shares)"""
        if obj.replacement_qty:
            return int(obj.replacement_qty.quantize(Decimal('1')))
        return None


class TLHExecutionCreateSerializer(serializers.Serializer):
    """Serializer for creating TLH executions"""
    holding_id = serializers.UUIDField()
    sell_price = serializers.DecimalField(max_digits=20, decimal_places=6, required=False)
    sell_fees = serializers.DecimalField(max_digits=20, decimal_places=6, default=Decimal('0.00'))
    replacement_ticker = serializers.CharField(max_length=20, required=False, allow_blank=True)
    replacement_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    replacement_qty = serializers.DecimalField(max_digits=20, decimal_places=6, required=False)
    replacement_price = serializers.DecimalField(max_digits=20, decimal_places=6, required=False)
    replacement_fees = serializers.DecimalField(max_digits=20, decimal_places=6, default=Decimal('0.00'))
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_holding_id(self, value):
        """Validate that the holding exists and belongs to the client"""
        try:
            holding = Holding.objects.get(id=value)
            # Check if holding belongs to the client (will be set in view)
            return value
        except Holding.DoesNotExist:
            raise serializers.ValidationError("Holding not found")
    
    def validate(self, data):
        """Validate the TLH execution data"""
        # If replacement is specified, all replacement fields must be provided
        replacement_fields = ['replacement_ticker', 'replacement_qty', 'replacement_price']
        replacement_provided = any(data.get(field) for field in replacement_fields)
        
        if replacement_provided:
            for field in replacement_fields:
                if not data.get(field):
                    raise serializers.ValidationError(f"{field} is required when specifying a replacement")
        
        return data


class ReplacementSuggestionSerializer(serializers.Serializer):
    """Serializer for replacement security suggestions"""
    ticker = serializers.CharField()
    name = serializers.CharField()
    sector = serializers.CharField()
    current_price = serializers.DecimalField(max_digits=20, decimal_places=6)
    market_cap = serializers.CharField()
    description = serializers.CharField()
