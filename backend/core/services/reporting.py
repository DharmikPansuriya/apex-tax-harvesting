"""
CGT Report Generator

Generates HMRC-style Capital Gains Tax reports with PDF and CSV export.
"""

import csv
import os
from decimal import Decimal
from datetime import datetime
from typing import Dict, List, Any
from django.conf import settings
from django.db.models import Q, Sum
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

from core.models import Holding, Transaction, Section104Pool, DisposalMatch, CGTReport
from core.services.compliance import compliance_engine


class CGTReportGenerator:
    """Generates CGT reports for UK tax compliance"""
    
    def __init__(self):
        self.aea_2024_25 = getattr(settings, 'UK_ANNUAL_EXEMPT_AMOUNT_2024_25', 3000)
        self.reports_dir = getattr(settings, 'REPORTS_DIR', 'reports')
        
        # Ensure reports directory exists
        os.makedirs(self.reports_dir, exist_ok=True)
    
    def generate_report(self, tax_year: str) -> CGTReport:
        """
        Generate a complete CGT report for the specified tax year.
        
        Args:
            tax_year: Tax year in format "2024-25"
            
        Returns:
            CGTReport object with file paths
        """
        # Parse tax year
        start_year = int(tax_year.split('-')[0])
        end_year = start_year + 1
        
        # Date range for the tax year (6 April to 5 April)
        start_date = datetime(start_year, 4, 6).date()
        end_date = datetime(end_year, 4, 5).date()
        
        # Get all disposals in the tax year
        disposals = self._get_disposals_in_period(start_date, end_date)
        
        # Calculate totals
        totals = self._calculate_totals(disposals)
        
        # Convert Decimal values to float for JSON serialization
        totals = self._convert_decimals_to_float(totals)
        
        # Generate files
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        csv_filename = f"cgt_report_{tax_year}_{timestamp}.csv"
        pdf_filename = f"cgt_report_{tax_year}_{timestamp}.pdf"
        
        csv_path = os.path.join(self.reports_dir, csv_filename)
        pdf_path = os.path.join(self.reports_dir, pdf_filename)
        
        # Generate CSV
        self._generate_csv(csv_path, disposals, totals, tax_year)
        
        # Generate PDF
        self._generate_pdf(pdf_path, disposals, totals, tax_year)
        
        # Create CGTReport record
        cgt_report = CGTReport.objects.create(
            tax_year=tax_year,
            totals=totals,
            csv_path=csv_path,
            pdf_path=pdf_path
        )
        
        return cgt_report
    
    def _convert_decimals_to_float(self, data):
        """Convert Decimal values to float for JSON serialization"""
        if isinstance(data, dict):
            return {key: self._convert_decimals_to_float(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self._convert_decimals_to_float(item) for item in data]
        elif isinstance(data, Decimal):
            return float(data)
        else:
            return data
    
    def _get_disposals_in_period(self, start_date, end_date) -> List[Dict]:
        """Get all disposals in the specified period with compliance calculations"""
        sell_transactions = Transaction.objects.filter(
            side='SELL',
            trade_date__gte=start_date,
            trade_date__lte=end_date
        ).order_by('trade_date', 'holding__ticker')
        
        disposals = []
        for sell_tx in sell_transactions:
            # Get the holding's Section 104 pool
            try:
                pool = sell_tx.holding.section104_pool
            except Section104Pool.DoesNotExist:
                pool = None
            
            # Get 30-day matches for this disposal
            matches = DisposalMatch.objects.filter(sell_tx=sell_tx)
            
            # Calculate disposal details
            disposal_info = self._calculate_disposal_details(sell_tx, pool, matches)
            disposals.append(disposal_info)
        
        return disposals
    
    def _calculate_disposal_details(self, sell_tx: Transaction, pool: Section104Pool, matches: List[DisposalMatch]) -> Dict:
        """Calculate detailed disposal information"""
        disposal = {
            'transaction': sell_tx,
            'holding': sell_tx.holding,
            'disposal_date': sell_tx.trade_date,
            'qty': sell_tx.qty,
            'disposal_price': sell_tx.price,
            'disposal_proceeds': sell_tx.qty * sell_tx.price,
            'matches': [],
            'section104_cost': Decimal('0.00'),
            'section104_qty': Decimal('0.00'),
            'total_cost': Decimal('0.00'),
            'gain_loss': Decimal('0.00'),
            'disallowed_loss': Decimal('0.00'),
            'allowable_loss': Decimal('0.00')
        }
        
        # Process 30-day matches
        matched_qty = Decimal('0.00')
        for match in matches:
            match_info = {
                'buy_tx': match.matched_buy_tx,
                'qty': match.qty_matched,
                'cost': match.matched_buy_tx.price,
                'disallowed_loss': match.disallowed_loss
            }
            disposal['matches'].append(match_info)
            matched_qty += match.qty_matched
            disposal['disallowed_loss'] += match.disallowed_loss
        
        # Calculate Section 104 portion
        remaining_qty = sell_tx.qty - matched_qty
        if remaining_qty > 0 and pool:
            disposal['section104_qty'] = remaining_qty
            disposal['section104_cost'] = remaining_qty * pool.avg_cost
        
        # Calculate total cost and gain/loss
        disposal['total_cost'] = sum(match['cost'] * match['qty'] for match in disposal['matches'])
        disposal['total_cost'] += disposal['section104_cost']
        
        disposal['gain_loss'] = disposal['disposal_proceeds'] - disposal['total_cost']
        disposal['allowable_loss'] = disposal['gain_loss'] + disposal['disallowed_loss']
        
        return disposal
    
    def _calculate_totals(self, disposals: List[Dict]) -> Dict:
        """Calculate report totals"""
        totals = {
            'total_disposals': len(disposals),
            'total_proceeds': Decimal('0.00'),
            'total_cost': Decimal('0.00'),
            'gross_gains': Decimal('0.00'),
            'gross_losses': Decimal('0.00'),
            'disallowed_losses': Decimal('0.00'),
            'net_gains': Decimal('0.00'),
            'annual_exempt_amount': Decimal(str(self.aea_2024_25)),
            'taxable_gains': Decimal('0.00'),
            'carry_forward_losses': Decimal('0.00')
        }
        
        for disposal in disposals:
            totals['total_proceeds'] += disposal['disposal_proceeds']
            totals['total_cost'] += disposal['total_cost']
            totals['disallowed_losses'] += disposal['disallowed_loss']
            
            if disposal['allowable_loss'] > 0:
                totals['gross_gains'] += disposal['allowable_loss']
            else:
                totals['gross_losses'] += abs(disposal['allowable_loss'])
        
        # Calculate net gains
        totals['net_gains'] = totals['gross_gains'] - totals['gross_losses']
        
        # Apply Annual Exempt Amount
        if totals['net_gains'] > 0:
            totals['taxable_gains'] = max(Decimal('0.00'), totals['net_gains'] - totals['annual_exempt_amount'])
        else:
            totals['carry_forward_losses'] = abs(totals['net_gains'])
        
        return totals
    
    def _generate_csv(self, filepath: str, disposals: List[Dict], totals: Dict, tax_year: str):
        """Generate CSV report"""
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            
            # Header
            writer.writerow(['UK Capital Gains Tax Report', tax_year])
            writer.writerow(['Generated:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])
            
            # Summary
            writer.writerow(['SUMMARY'])
            writer.writerow(['Total Disposals', totals['total_disposals']])
            writer.writerow(['Total Proceeds', f"£{totals['total_proceeds']:,.2f}"])
            writer.writerow(['Total Cost', f"£{totals['total_cost']:,.2f}"])
            writer.writerow(['Gross Gains', f"£{totals['gross_gains']:,.2f}"])
            writer.writerow(['Gross Losses', f"£{totals['gross_losses']:,.2f}"])
            writer.writerow(['Disallowed Losses (30-day rule)', f"£{totals['disallowed_losses']:,.2f}"])
            writer.writerow(['Net Gains', f"£{totals['net_gains']:,.2f}"])
            writer.writerow(['Annual Exempt Amount', f"£{totals['annual_exempt_amount']:,.2f}"])
            writer.writerow(['Taxable Gains', f"£{totals['taxable_gains']:,.2f}"])
            writer.writerow(['Carry Forward Losses', f"£{totals['carry_forward_losses']:,.2f}"])
            writer.writerow([])
            
            # Disposals detail
            writer.writerow(['DISPOSALS DETAIL'])
            writer.writerow([
                'Date', 'Ticker', 'Name', 'Quantity', 'Price', 'Proceeds',
                'Cost', 'Gain/Loss', 'Disallowed Loss', 'Allowable Loss'
            ])
            
            for disposal in disposals:
                writer.writerow([
                    disposal['disposal_date'].strftime('%Y-%m-%d'),
                    disposal['holding'].ticker,
                    disposal['holding'].name,
                    disposal['qty'],
                    f"£{disposal['disposal_price']:,.2f}",
                    f"£{disposal['disposal_proceeds']:,.2f}",
                    f"£{disposal['total_cost']:,.2f}",
                    f"£{disposal['gain_loss']:,.2f}",
                    f"£{disposal['disallowed_loss']:,.2f}",
                    f"£{disposal['allowable_loss']:,.2f}"
                ])
    
    def _generate_pdf(self, filepath: str, disposals: List[Dict], totals: Dict, tax_year: str):
        """Generate PDF report"""
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=30,
            alignment=1  # Center
        )
        story.append(Paragraph(f"UK Capital Gains Tax Report - {tax_year}", title_style))
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Summary table
        story.append(Paragraph("Summary", styles['Heading2']))
        summary_data = [
            ['Total Disposals', str(totals['total_disposals'])],
            ['Total Proceeds', f"£{totals['total_proceeds']:,.2f}"],
            ['Total Cost', f"£{totals['total_cost']:,.2f}"],
            ['Gross Gains', f"£{totals['gross_gains']:,.2f}"],
            ['Gross Losses', f"£{totals['gross_losses']:,.2f}"],
            ['Disallowed Losses (30-day rule)', f"£{totals['disallowed_losses']:,.2f}"],
            ['Net Gains', f"£{totals['net_gains']:,.2f}"],
            ['Annual Exempt Amount', f"£{totals['annual_exempt_amount']:,.2f}"],
            ['Taxable Gains', f"£{totals['taxable_gains']:,.2f}"],
            ['Carry Forward Losses', f"£{totals['carry_forward_losses']:,.2f}"]
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 20))
        
        # Disposals detail
        if disposals:
            story.append(Paragraph("Disposals Detail", styles['Heading2']))
            
            # Create table data
            table_data = [['Date', 'Ticker', 'Qty', 'Price', 'Proceeds', 'Cost', 'Gain/Loss', 'Disallowed', 'Allowable']]
            
            for disposal in disposals:
                table_data.append([
                    disposal['disposal_date'].strftime('%Y-%m-%d'),
                    disposal['holding'].ticker,
                    str(disposal['qty']),
                    f"£{disposal['disposal_price']:,.2f}",
                    f"£{disposal['disposal_proceeds']:,.2f}",
                    f"£{disposal['total_cost']:,.2f}",
                    f"£{disposal['gain_loss']:,.2f}",
                    f"£{disposal['disallowed_loss']:,.2f}",
                    f"£{disposal['allowable_loss']:,.2f}"
                ])
            
            disposals_table = Table(table_data, colWidths=[0.8*inch, 0.6*inch, 0.5*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.7*inch])
            disposals_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTSIZE', (0, 1), (-1, -1), 7)
            ]))
            
            story.append(disposals_table)
        
        # Build PDF
        doc.build(story)


# Global report generator instance
cgt_report_generator = CGTReportGenerator()
