"""
Management command to clear all portfolio data
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import Holding, Transaction, Section104Pool, DisposalMatch, CGTReport


class Command(BaseCommand):
    help = 'Clear all portfolio data (holdings, transactions, pools, etc.)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirm that you want to delete all data'
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(
                self.style.WARNING(
                    'This will delete ALL portfolio data including:\n'
                    '- All holdings\n'
                    '- All transactions\n'
                    '- All Section 104 pools\n'
                    '- All disposal matches\n'
                    '- All CGT reports\n\n'
                    'To confirm, run: python manage.py clear_portfolio_data --confirm'
                )
            )
            return

        self.stdout.write('Clearing all portfolio data...')

        try:
            with transaction.atomic():
                # Delete in order to respect foreign key constraints
                deleted_counts = {}
                
                # Delete CGT reports first
                deleted_counts['cgt_reports'] = CGTReport.objects.count()
                CGTReport.objects.all().delete()
                
                # Delete disposal matches
                deleted_counts['disposal_matches'] = DisposalMatch.objects.count()
                DisposalMatch.objects.all().delete()
                
                # Delete Section 104 pools
                deleted_counts['section104_pools'] = Section104Pool.objects.count()
                Section104Pool.objects.all().delete()
                
                # Delete transactions
                deleted_counts['transactions'] = Transaction.objects.count()
                Transaction.objects.all().delete()
                
                # Delete holdings
                deleted_counts['holdings'] = Holding.objects.count()
                Holding.objects.all().delete()

                # Report what was deleted
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully cleared portfolio data:\n'
                        f'- {deleted_counts["cgt_reports"]} CGT reports\n'
                        f'- {deleted_counts["disposal_matches"]} disposal matches\n'
                        f'- {deleted_counts["section104_pools"]} Section 104 pools\n'
                        f'- {deleted_counts["transactions"]} transactions\n'
                        f'- {deleted_counts["holdings"]} holdings'
                    )
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error clearing data: {str(e)}')
            )
            raise
