"""
DRF ViewSets for TLH UK API
"""

import os
from django.http import HttpResponse, Http404
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from core.models import (
    WealthManager, Client, Holding, Transaction, Section104Pool, 
    DisposalMatch, CGTReport, CSVUpload
)
from core.services.reporting import cgt_report_generator
from core.services.csv_upload import CSVUploadService
from ai.ranker import tlh_ranker
from api.serializers import (
    WealthManagerSerializer, ClientSerializer, HoldingSerializer, 
    TransactionSerializer, Section104PoolSerializer, DisposalMatchSerializer, 
    CGTReportSerializer, CSVUploadSerializer, TLHOpportunitySerializer
)


class WealthManagerViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for WealthManager model"""
    queryset = WealthManager.objects.all()
    serializer_class = WealthManagerSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Only show financial advisors for the authenticated user
        if hasattr(self.request.user, 'wealth_manager'):
            return WealthManager.objects.filter(user=self.request.user)
        return WealthManager.objects.none()


class ClientViewSet(viewsets.ModelViewSet):
    """ViewSet for Client model"""
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Check user type
        try:
            user_profile = self.request.user.profile
        except:
            return Client.objects.none()
        
        # Financial advisors can see their clients
        if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
            if hasattr(self.request.user, 'wealth_manager'):
                return Client.objects.filter(wealth_manager=self.request.user.wealth_manager)
        
        # Individual investors can only see their own client record
        elif user_profile.client_type == 'individual':
            return Client.objects.filter(
                first_name=self.request.user.first_name,
                last_name=self.request.user.last_name,
                email=self.request.user.email,
                wealth_manager=None
            )
        
        return Client.objects.none()
    
    def create(self, request, *args, **kwargs):
        # Check if user is allowed to create clients
        try:
            user_profile = request.user.profile
        except:
            return Response(
                {'error': 'User profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Only financial advisors can create clients
        if user_profile.client_type not in ['wealth_manager', 'financial_advisor']:
            return Response(
                {'error': 'Only financial advisors can create clients'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().create(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        # Check if user is allowed to update clients
        try:
            user_profile = request.user.profile
        except:
            return Response(
                {'error': 'User profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Individual investors can only update their own client record
        if user_profile.client_type == 'individual':
            client = self.get_object()
            if (client.first_name != request.user.first_name or 
                client.last_name != request.user.last_name or 
                client.email != request.user.email or
                client.wealth_manager is not None):
                return Response(
                    {'error': 'Can only update your own profile'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        # Check if user is allowed to delete clients
        try:
            user_profile = request.user.profile
        except:
            return Response(
                {'error': 'User profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Only financial advisors can delete clients
        if user_profile.client_type not in ['wealth_manager', 'financial_advisor']:
            return Response(
                {'error': 'Only financial advisors can delete clients'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['get'])
    def holdings(self, request, pk=None):
        """Get all holdings for a client"""
        client = self.get_object()
        holdings = client.holdings.all()
        serializer = HoldingSerializer(holdings, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def tlh_opportunities(self, request, pk=None):
        """Get TLH opportunities for a client"""
        client = self.get_object()
        opportunities = tlh_ranker.rank_tlh_candidates(client.holdings.all())
        serializer = TLHOpportunitySerializer(opportunities, many=True)
        return Response(serializer.data)


class CSVUploadViewSet(viewsets.ModelViewSet):
    """ViewSet for CSV upload"""
    queryset = CSVUpload.objects.all()
    serializer_class = CSVUploadSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        # If user has wealth_manager, show only their clients' uploads
        if hasattr(self.request.user, 'wealth_manager'):
            return CSVUpload.objects.filter(
                client__wealth_manager=self.request.user.wealth_manager
            )
        else:
            # Otherwise, show all uploads (for now)
            return CSVUpload.objects.all()
    
    def perform_create(self, serializer):
        # Allow any authenticated user to upload CSV files
        client_id = self.request.data.get('client')
        uploaded_file = self.request.FILES.get('file')
        
        if client_id and uploaded_file:
            try:
                # If user has wealth_manager, restrict to their clients
                if hasattr(self.request.user, 'wealth_manager'):
                    client = Client.objects.get(
                        id=client_id,
                        wealth_manager=self.request.user.wealth_manager
                    )
                else:
                    # Otherwise, allow any client (for now)
                    client = Client.objects.get(id=client_id)
                
                # Save the CSV upload record
                csv_upload = serializer.save(client=client)
                
                # Process the CSV immediately
                from core.services.csv_upload import CSVUploadService
                upload_service = CSVUploadService()
                upload_service.process_csv_upload(csv_upload)
                
            except Client.DoesNotExist:
                raise ValueError("Invalid client ID")
        else:
            raise ValueError("Both client ID and file are required")
    
    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """Process a CSV upload"""
        csv_upload = self.get_object()
        upload_service = CSVUploadService()
        result = upload_service.process_csv_upload(csv_upload)
        return Response(result)


class HoldingViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Holding model"""
    queryset = Holding.objects.all()
    serializer_class = HoldingSerializer
    permission_classes = [AllowAny]  # For development
    
    def get_queryset(self):
        """Filter holdings by various criteria"""
        queryset = Holding.objects.all()
        
        # Filter by ticker
        ticker = self.request.query_params.get('ticker', None)
        if ticker:
            queryset = queryset.filter(ticker__icontains=ticker)
        
        # Filter by name
        name = self.request.query_params.get('name', None)
        if name:
            queryset = queryset.filter(name__icontains=name)
        
        return queryset.order_by('ticker')


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Transaction model"""
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [AllowAny]  # For development
    
    def get_queryset(self):
        """Filter transactions by various criteria"""
        queryset = Transaction.objects.all()
        
        # Filter by holding
        holding_id = self.request.query_params.get('holding', None)
        if holding_id:
            queryset = queryset.filter(holding_id=holding_id)
        
        # Filter by side
        side = self.request.query_params.get('side', None)
        if side:
            queryset = queryset.filter(side=side.upper())
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date', None)
        if start_date:
            queryset = queryset.filter(trade_date__gte=start_date)
        
        end_date = self.request.query_params.get('end_date', None)
        if end_date:
            queryset = queryset.filter(trade_date__lte=end_date)
        
        return queryset.order_by('-trade_date', '-created_at')


class Section104PoolViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Section104Pool model"""
    queryset = Section104Pool.objects.all()
    serializer_class = Section104PoolSerializer
    permission_classes = [AllowAny]  # For development
    
    def get_queryset(self):
        """Filter pools by various criteria"""
        queryset = Section104Pool.objects.all()
        
        # Filter by holding
        holding_id = self.request.query_params.get('holding', None)
        if holding_id:
            queryset = queryset.filter(holding_id=holding_id)
        
        # Filter by non-zero quantity
        non_zero = self.request.query_params.get('non_zero', None)
        if non_zero and non_zero.lower() == 'true':
            queryset = queryset.filter(pooled_qty__gt=0)
        
        return queryset.order_by('holding__ticker')


class DisposalMatchViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for DisposalMatch model"""
    queryset = DisposalMatch.objects.all()
    serializer_class = DisposalMatchSerializer
    permission_classes = [AllowAny]  # For development
    
    def get_queryset(self):
        """Filter disposal matches by various criteria"""
        queryset = DisposalMatch.objects.all()
        
        # Filter by sell transaction
        sell_tx = self.request.query_params.get('sell_tx', None)
        if sell_tx:
            queryset = queryset.filter(sell_tx_id=sell_tx)
        
        # Filter by buy transaction
        buy_tx = self.request.query_params.get('buy_tx', None)
        if buy_tx:
            queryset = queryset.filter(matched_buy_tx_id=buy_tx)
        
        return queryset.order_by('-created_at')


class CGTReportViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for CGTReport model"""
    queryset = CGTReport.objects.all()
    serializer_class = CGTReportSerializer
    permission_classes = [AllowAny]  # For development
    
    def get_queryset(self):
        """Filter reports by various criteria"""
        queryset = CGTReport.objects.all()
        
        # Filter by tax year
        tax_year = self.request.query_params.get('tax_year', None)
        if tax_year:
            queryset = queryset.filter(tax_year=tax_year)
        
        return queryset.order_by('-created_at')
    
    @action(detail=True, methods=['get'])
    def download_csv(self, request, pk=None):
        """Download CSV file for a report"""
        try:
            report = self.get_object()
            if not report.csv_path or not os.path.exists(report.csv_path):
                raise Http404("CSV file not found")
            
            with open(report.csv_path, 'rb') as csv_file:
                response = HttpResponse(csv_file.read(), content_type='text/csv')
                response['Content-Disposition'] = f'attachment; filename="cgt_report_{report.tax_year}.csv"'
                return response
                
        except CGTReport.DoesNotExist:
            raise Http404("Report not found")
    
    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Download PDF file for a report"""
        try:
            report = self.get_object()
            if not report.pdf_path or not os.path.exists(report.pdf_path):
                raise Http404("PDF file not found")
            
            with open(report.pdf_path, 'rb') as pdf_file:
                response = HttpResponse(pdf_file.read(), content_type='application/pdf')
                response['Content-Disposition'] = f'attachment; filename="cgt_report_{report.tax_year}.pdf"'
                return response
                
        except CGTReport.DoesNotExist:
            raise Http404("Report not found")


class TLHOpportunityViewSet(viewsets.ViewSet):
    """ViewSet for TLH opportunities"""
    permission_classes = [AllowAny]  # For development
    
    def list(self, request):
        """Get ranked list of TLH opportunities"""
        try:
            # Get TLH opportunities from ranker
            opportunities = tlh_ranker.rank_tlh_candidates()
            
            # Serialize opportunities
            serializer = TLHOpportunitySerializer(opportunities, many=True)
            
            return Response({
                'count': len(opportunities),
                'results': serializer.data
            })
            
        except Exception as e:
            return Response(
                {'error': f'Error getting TLH opportunities: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'])
    def generate_report(self, request):
        """Generate CGT report for specified tax year"""
        tax_year = request.query_params.get('tax_year', '2024-25')
        
        try:
            # Generate report
            report = cgt_report_generator.generate_report(tax_year)
            
            # Serialize and return
            serializer = CGTReportSerializer(report)
            
            return Response({
                'message': f'CGT report generated for {tax_year}',
                'report': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Error generating report: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
