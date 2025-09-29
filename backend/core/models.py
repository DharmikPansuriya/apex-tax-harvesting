import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator


class UserProfile(models.Model):
    """User profile for different client types"""
    CLIENT_TYPE_CHOICES = [
        ('individual', 'Individual Investor'),
        ('wealth_manager', 'Financial Advisor'),
        ('financial_advisor', 'Financial Advisor'),
        ('institution', 'Institution'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    client_type = models.CharField(max_length=20, choices=CLIENT_TYPE_CHOICES, default='individual')
    firm_name = models.CharField(max_length=255, blank=True, null=True)
    license_number = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        if self.firm_name:
            return f"{self.user.get_full_name()} - {self.firm_name}"
        return f"{self.user.get_full_name()} ({self.get_client_type_display()})"
    
    @property
    def is_wealth_manager(self):
        return self.client_type in ['wealth_manager', 'financial_advisor']

# Keep WealthManager for backward compatibility
class WealthManager(models.Model):
    """Financial Advisor profile"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='wealth_manager')
    firm_name = models.CharField(max_length=255)
    license_number = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.firm_name}"


class Client(models.Model):
    """Client managed by financial advisor or individual investor"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wealth_manager = models.ForeignKey(WealthManager, on_delete=models.CASCADE, related_name='clients', null=True, blank=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    risk_profile = models.CharField(
        max_length=20,
        choices=[
            ('CONSERVATIVE', 'Conservative'),
            ('MODERATE', 'Moderate'),
            ('AGGRESSIVE', 'Aggressive'),
        ],
        default='MODERATE'
    )
    total_portfolio_value = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['last_name', 'first_name']
    
    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class Holding(models.Model):
    """Represents a security holding in the portfolio"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='holdings', null=True, blank=True)
    isin = models.CharField(max_length=20, help_text="International Securities Identification Number")
    sedol = models.CharField(max_length=20, null=True, blank=True, help_text="Stock Exchange Daily Official List")
    ticker = models.CharField(max_length=20, help_text="Stock ticker symbol")
    name = models.CharField(max_length=200, help_text="Security name")
    sector = models.CharField(max_length=100, blank=True, help_text="Business sector")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['ticker']

    def __str__(self):
        client_name = self.client.full_name if self.client else "No Client"
        return f"{self.ticker} ({self.name}) - {client_name}"


class Transaction(models.Model):
    """Represents a buy/sell transaction"""
    SIDE_CHOICES = [
        ('BUY', 'Buy'),
        ('SELL', 'Sell'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    holding = models.ForeignKey(Holding, on_delete=models.CASCADE, related_name='transactions')
    trade_date = models.DateField(help_text="Date of the transaction")
    qty = models.DecimalField(
        max_digits=20, 
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0.000001'))],
        help_text="Quantity of shares"
    )
    price = models.DecimalField(
        max_digits=20, 
        decimal_places=6,
        validators=[MinValueValidator(Decimal('0.000001'))],
        help_text="Price per share"
    )
    fees = models.DecimalField(
        max_digits=20, 
        decimal_places=6,
        default=Decimal('0.00'),
        help_text="Transaction fees"
    )
    side = models.CharField(max_length=4, choices=SIDE_CHOICES)
    account = models.CharField(max_length=50, default='GIA', help_text="Account type")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['trade_date', 'created_at']

    def __str__(self):
        return f"{self.side} {self.qty} {self.holding.ticker} @ {self.price} on {self.trade_date}"

    @property
    def total_value(self):
        """Total value of the transaction (qty * price)"""
        return self.qty * self.price

    @property
    def net_value(self):
        """Net value including fees"""
        if self.side == 'BUY':
            return self.total_value + self.fees
        else:
            return self.total_value - self.fees


class Section104Pool(models.Model):
    """Section 104 pool for each holding (UK CGT rule)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    holding = models.OneToOneField(Holding, on_delete=models.CASCADE, related_name='section104_pool')
    pooled_qty = models.DecimalField(
        max_digits=20, 
        decimal_places=6,
        default=Decimal('0.00'),
        help_text="Total quantity in the pool"
    )
    pooled_cost = models.DecimalField(
        max_digits=20, 
        decimal_places=6,
        default=Decimal('0.00'),
        help_text="Total cost basis in the pool"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['holding__ticker']

    def __str__(self):
        return f"Section 104 Pool for {self.holding.ticker}: {self.pooled_qty} @ {self.avg_cost}"

    @property
    def avg_cost(self):
        """Average cost per share in the pool"""
        if self.pooled_qty > 0:
            return self.pooled_cost / self.pooled_qty
        return Decimal('0.00')

    def add_purchase(self, qty, price, fees=Decimal('0.00')):
        """Add a purchase to the pool"""
        self.pooled_qty += qty
        self.pooled_cost += (qty * price) + fees
        self.save()

    def remove_disposal(self, qty):
        """Remove a disposal from the pool using average cost"""
        if qty > self.pooled_qty:
            raise ValueError("Cannot dispose more than available in pool")
        
        avg_cost = self.avg_cost
        self.pooled_qty -= qty
        self.pooled_cost -= qty * avg_cost
        self.save()
        return avg_cost


class DisposalMatch(models.Model):
    """Audit trail for 30-day rule matching (bed & breakfasting)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sell_tx = models.ForeignKey(
        Transaction, 
        on_delete=models.CASCADE, 
        related_name='disposal_matches',
        help_text="The sell transaction"
    )
    matched_buy_tx = models.ForeignKey(
        Transaction, 
        on_delete=models.CASCADE, 
        related_name='buy_matches',
        help_text="The matched buy transaction"
    )
    qty_matched = models.DecimalField(
        max_digits=20, 
        decimal_places=6,
        help_text="Quantity matched between sell and buy"
    )
    disallowed_loss = models.DecimalField(
        max_digits=20, 
        decimal_places=6,
        default=Decimal('0.00'),
        help_text="Loss amount that is disallowed due to 30-day rule"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sell_tx__trade_date', 'created_at']

    def __str__(self):
        return f"Match: {self.qty_matched} {self.sell_tx.holding.ticker} (Disallowed: £{self.disallowed_loss})"


class CGTReport(models.Model):
    """Capital Gains Tax report for a tax year"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tax_year = models.CharField(max_length=7, help_text="Tax year (e.g., 2024-25)")
    totals = models.JSONField(help_text="Report totals and calculations")
    pdf_path = models.CharField(max_length=500, null=True, blank=True, help_text="Path to PDF file")
    csv_path = models.CharField(max_length=500, null=True, blank=True, help_text="Path to CSV file")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"CGT Report {self.tax_year} ({self.created_at.strftime('%Y-%m-%d')})"


class PriceSnapshot(models.Model):
    """Daily close snapshot per ticker to reduce external price calls."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticker = models.CharField(max_length=20, db_index=True)
    date = models.DateField(db_index=True)
    close = models.DecimalField(max_digits=20, decimal_places=6)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('ticker', 'date')
        ordering = ['-date', 'ticker']

    def __str__(self):
        return f"{self.ticker} @ {self.close} on {self.date}"


class CSVUpload(models.Model):
    """CSV upload for client holdings"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='csv_uploads')
    file = models.FileField(upload_to='csv_uploads/', null=True, blank=True)
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, blank=True)  # Keep for backward compatibility
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('PROCESSING', 'Processing'),
            ('COMPLETED', 'Completed'),
            ('FAILED', 'Failed'),
        ],
        default='PENDING'
    )
    error_message = models.TextField(blank=True)
    records_processed = models.IntegerField(default=0)
    records_successful = models.IntegerField(default=0)
    records_failed = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def save(self, *args, **kwargs):
        # Auto-populate filename from file if not provided
        if self.file and not self.filename:
            self.filename = self.file.name
        # Auto-populate file_path from file if not provided
        if self.file and not self.file_path:
            self.file_path = self.file.path
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.filename} - {self.client.full_name} ({self.status})"