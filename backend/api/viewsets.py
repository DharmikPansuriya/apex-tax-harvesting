"""
DRF ViewSets for TLH UK API
"""

import os
from decimal import Decimal
from datetime import datetime
from django.http import HttpResponse, Http404
from django.conf import settings
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from core.models import (
    WealthManager, Client, Holding, Transaction, Section104Pool, 
    DisposalMatch, CGTReport, CSVUpload, TLHExecution
)
from core.services.reporting import cgt_report_generator
from core.services.csv_upload import CSVUploadService
from core.services.market_data import MarketDataService
from ai.ranker import tlh_ranker
from api.serializers import (
    WealthManagerSerializer, ClientSerializer, HoldingSerializer, 
    TransactionSerializer, Section104PoolSerializer, DisposalMatchSerializer, 
    CGTReportSerializer, CSVUploadSerializer, TLHOpportunitySerializer,
    TLHExecutionSerializer, TLHExecutionCreateSerializer, ReplacementSuggestionSerializer
)
# Removed decorator import - using direct queryset filtering instead


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
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter clients by user type"""
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
        """Filter CSV uploads by user type"""
        try:
            user_profile = self.request.user.profile
        except:
            return CSVUpload.objects.none()
        
        # Financial advisors can see their clients' uploads
        if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
            if hasattr(self.request.user, 'wealth_manager'):
                return CSVUpload.objects.filter(
                    client__wealth_manager=self.request.user.wealth_manager
                )
        
        # Individual investors can only see their own uploads
        elif user_profile.client_type == 'individual':
            return CSVUpload.objects.filter(
                client__first_name=self.request.user.first_name,
                client__last_name=self.request.user.last_name,
                client__email=self.request.user.email,
                client__wealth_manager=None
            )
        
        return CSVUpload.objects.none()
    
    def perform_create(self, serializer):
        """Create CSV upload with proper user filtering"""
        try:
            user_profile = self.request.user.profile
        except:
            raise ValueError("User profile not found")
        
        client_id = self.request.data.get('client')
        uploaded_file = self.request.FILES.get('file')
        
        if client_id and uploaded_file:
            try:
                # Get client based on user type
                if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
                    if hasattr(self.request.user, 'wealth_manager'):
                        client = Client.objects.get(
                            id=client_id,
                            wealth_manager=self.request.user.wealth_manager
                        )
                    else:
                        raise ValueError("Invalid client ID")
                
                elif user_profile.client_type == 'individual':
                    client = Client.objects.get(
                        id=client_id,
                        first_name=self.request.user.first_name,
                        last_name=self.request.user.last_name,
                        email=self.request.user.email,
                        wealth_manager=None
                    )
                else:
                    raise ValueError("Invalid user type")
                
                # Save the CSV upload record
                csv_upload = serializer.save(client=client)
                
                # Process the CSV immediately
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
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter holdings by user's clients"""
        try:
            user_profile = self.request.user.profile
        except:
            return Holding.objects.none()
        
        # Financial advisors can see their clients' holdings
        if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
            if hasattr(self.request.user, 'wealth_manager'):
                queryset = Holding.objects.filter(
                    client__wealth_manager=self.request.user.wealth_manager
                )
        
        # Individual investors can only see their own holdings
        elif user_profile.client_type == 'individual':
            queryset = Holding.objects.filter(
                client__first_name=self.request.user.first_name,
                client__last_name=self.request.user.last_name,
                client__email=self.request.user.email,
                client__wealth_manager=None
            )
        else:
            return Holding.objects.none()
        
        # Additional filtering
        ticker = self.request.query_params.get('ticker', None)
        if ticker:
            queryset = queryset.filter(ticker__icontains=ticker)
        
        name = self.request.query_params.get('name', None)
        if name:
            queryset = queryset.filter(name__icontains=name)
        
        return queryset.order_by('ticker')


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Transaction model"""
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter transactions by user's holdings and additional criteria"""
        try:
            user_profile = self.request.user.profile
        except:
            return Transaction.objects.none()
        
        # Financial advisors can see their clients' transactions
        if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
            if hasattr(self.request.user, 'wealth_manager'):
                queryset = Transaction.objects.filter(
                    holding__client__wealth_manager=self.request.user.wealth_manager
                )
        
        # Individual investors can only see their own transactions
        elif user_profile.client_type == 'individual':
            queryset = Transaction.objects.filter(
                holding__client__first_name=self.request.user.first_name,
                holding__client__last_name=self.request.user.last_name,
                holding__client__email=self.request.user.email,
                holding__client__wealth_manager=None
            )
        else:
            return Transaction.objects.none()
        
        # Additional filtering
        holding_id = self.request.query_params.get('holding', None)
        if holding_id:
            queryset = queryset.filter(holding_id=holding_id)
        
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
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter pools by user's holdings and additional criteria"""
        try:
            user_profile = self.request.user.profile
        except:
            return Section104Pool.objects.none()
        
        # Financial advisors can see their clients' pools
        if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
            if hasattr(self.request.user, 'wealth_manager'):
                queryset = Section104Pool.objects.filter(
                    holding__client__wealth_manager=self.request.user.wealth_manager
                )
        
        # Individual investors can only see their own pools
        elif user_profile.client_type == 'individual':
            queryset = Section104Pool.objects.filter(
                holding__client__first_name=self.request.user.first_name,
                holding__client__last_name=self.request.user.last_name,
                holding__client__email=self.request.user.email,
                holding__client__wealth_manager=None
            )
        else:
            return Section104Pool.objects.none()
        
        # Additional filtering
        holding_id = self.request.query_params.get('holding', None)
        if holding_id:
            queryset = queryset.filter(holding_id=holding_id)
        
        non_zero = self.request.query_params.get('non_zero', None)
        if non_zero and non_zero.lower() == 'true':
            queryset = queryset.filter(pooled_qty__gt=0)
        
        return queryset.order_by('holding__ticker')


class DisposalMatchViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for DisposalMatch model"""
    queryset = DisposalMatch.objects.all()
    serializer_class = DisposalMatchSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter disposal matches by user's transactions and additional criteria"""
        try:
            user_profile = self.request.user.profile
        except:
            return DisposalMatch.objects.none()
        
        # Financial advisors can see their clients' disposal matches
        if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
            if hasattr(self.request.user, 'wealth_manager'):
                queryset = DisposalMatch.objects.filter(
                    sell_tx__holding__client__wealth_manager=self.request.user.wealth_manager
                )
        
        # Individual investors can only see their own disposal matches
        elif user_profile.client_type == 'individual':
            queryset = DisposalMatch.objects.filter(
                sell_tx__holding__client__first_name=self.request.user.first_name,
                sell_tx__holding__client__last_name=self.request.user.last_name,
                sell_tx__holding__client__email=self.request.user.email,
                sell_tx__holding__client__wealth_manager=None
            )
        else:
            return DisposalMatch.objects.none()
        
        # Additional filtering
        sell_tx = self.request.query_params.get('sell_tx', None)
        if sell_tx:
            queryset = queryset.filter(sell_tx_id=sell_tx)
        
        buy_tx = self.request.query_params.get('buy_tx', None)
        if buy_tx:
            queryset = queryset.filter(matched_buy_tx_id=buy_tx)
        
        return queryset.order_by('-created_at')


class CGTReportViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for CGTReport model"""
    queryset = CGTReport.objects.all()
    serializer_class = CGTReportSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter reports by user"""
        try:
            user_profile = self.request.user.profile
        except:
            return CGTReport.objects.none()
        
        # Return only reports generated by this user
        queryset = CGTReport.objects.filter(user=self.request.user)
        
        # Filter by tax year if specified
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
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """Get ranked list of TLH opportunities"""
        try:
            # Get user's holdings based on user type
            try:
                user_profile = request.user.profile
            except:
                return Response(
                    {'error': 'User profile not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Get user's holdings based on their type
            if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
                if hasattr(request.user, 'wealth_manager'):
                    holdings = Holding.objects.filter(
                        client__wealth_manager=request.user.wealth_manager
                    )
                else:
                    return Response({
                        'count': 0,
                        'results': []
                    })
            
            elif user_profile.client_type == 'individual':
                holdings = Holding.objects.filter(
                    client__first_name=request.user.first_name,
                    client__last_name=request.user.last_name,
                    client__email=request.user.email,
                    client__wealth_manager=None
                )
            else:
                return Response({
                    'count': 0,
                    'results': []
                })
            
            # Initialize market data service
            market_service = MarketDataService()
            
            # Create portfolio snapshot from user's holdings
            portfolio_snapshot = {'holdings': []}
            for holding in holdings:
                try:
                    pool = holding.section104_pool
                    if pool.pooled_qty > 0:
                        # Get real current market price from database or Alpha Vantage
                        current_price = market_service.get_current_price(holding.ticker)
                        
                        # Skip if we can't get a valid price
                        if not current_price or current_price <= 0:
                            continue
                        
                        unrealised_pnl = (float(current_price) - float(pool.avg_cost)) * float(pool.pooled_qty)
                        
                        holding_data = {
                            'holding': holding,
                            'pool': pool,
                            'current_price': float(current_price),
                            'unrealised_pnl': unrealised_pnl,
                            'unrealised_pnl_pct': ((float(current_price) - float(pool.avg_cost)) / float(pool.avg_cost) * 100) if pool.avg_cost > 0 else 0
                        }
                        portfolio_snapshot['holdings'].append(holding_data)
                except Exception as e:
                    print(f"Error processing holding {holding.ticker}: {str(e)}")
                    continue
            
            # Get TLH opportunities from ranker with user's portfolio snapshot
            opportunities = tlh_ranker.rank_tlh_candidates(portfolio_snapshot)
            
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
        """Generate user-specific CGT report for specified tax year"""
        tax_year = request.query_params.get('tax_year', '2024-25')
        
        try:
            # Generate user-specific report
            report = cgt_report_generator.generate_report(tax_year, user=request.user)
            
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


class TLHExecutionViewSet(viewsets.ModelViewSet):
    """ViewSet for TLH execution"""
    queryset = TLHExecution.objects.all()
    serializer_class = TLHExecutionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter TLH executions by user type"""
        try:
            user_profile = self.request.user.profile
        except:
            return TLHExecution.objects.none()
        
        # Financial advisors can see their clients' executions
        if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
            if hasattr(self.request.user, 'wealth_manager'):
                return TLHExecution.objects.filter(
                    client__wealth_manager=self.request.user.wealth_manager
                )
        
        # Individual investors can only see their own executions
        elif user_profile.client_type == 'individual':
            return TLHExecution.objects.filter(
                client__first_name=self.request.user.first_name,
                client__last_name=self.request.user.last_name,
                client__email=self.request.user.email,
                client__wealth_manager=None
            )
        
        return TLHExecution.objects.none()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TLHExecutionCreateSerializer
        return TLHExecutionSerializer
    
    def create(self, request, *args, **kwargs):
        """Create a new TLH execution"""
        from core.services.tlh_execution import tlh_execution_service
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Get the client based on user type
        try:
            user_profile = request.user.profile
        except:
            return Response(
                {'error': 'User profile not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
            if hasattr(request.user, 'wealth_manager'):
                # For financial advisors, we need to specify which client
                client_id = request.data.get('client_id')
                if not client_id:
                    return Response(
                        {'error': 'client_id is required for financial advisors'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                try:
                    client = Client.objects.get(
                        id=client_id,
                        wealth_manager=request.user.wealth_manager
                    )
                except Client.DoesNotExist:
                    return Response(
                        {'error': 'Client not found'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                return Response(
                    {'error': 'Wealth manager profile not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Individual investor - find their client record
            try:
                client = Client.objects.get(
                    first_name=request.user.first_name,
                    last_name=request.user.last_name,
                    email=request.user.email,
                    wealth_manager=None
                )
            except Client.DoesNotExist:
                return Response(
                    {'error': 'Client record not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Get the holding
        try:
            holding = Holding.objects.get(
                id=serializer.validated_data['holding_id'],
                client=client
            )
        except Holding.DoesNotExist:
            return Response(
                {'error': 'Holding not found or does not belong to client'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            # Create TLH execution
            tlh_execution = tlh_execution_service.create_tlh_execution(
                client=client,
                holding=holding,
                sell_price=serializer.validated_data.get('sell_price'),
                sell_fees=serializer.validated_data.get('sell_fees', Decimal('0.00')),
                replacement_ticker=serializer.validated_data.get('replacement_ticker'),
                replacement_name=serializer.validated_data.get('replacement_name'),
                replacement_qty=serializer.validated_data.get('replacement_qty'),
                replacement_price=serializer.validated_data.get('replacement_price'),
                replacement_fees=serializer.validated_data.get('replacement_fees', Decimal('0.00')),
                notes=serializer.validated_data.get('notes', '')
            )
            
            response_serializer = TLHExecutionSerializer(tlh_execution)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute a TLH trade"""
        from core.services.tlh_execution import tlh_execution_service
        
        tlh_execution = self.get_object()
        
        if tlh_execution.status != 'PENDING':
            return Response(
                {'error': 'Only pending TLH executions can be executed'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            result = tlh_execution_service.execute_tlh(tlh_execution)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a TLH execution"""
        from core.services.tlh_execution import tlh_execution_service
        
        tlh_execution = self.get_object()
        
        try:
            success = tlh_execution_service.cancel_tlh_execution(tlh_execution)
            if success:
                return Response({'message': 'TLH execution cancelled successfully'})
            else:
                return Response(
                    {'error': 'Failed to cancel TLH execution'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['get'])
    def suggestions(self, request):
        """Get replacement suggestions for a holding"""
        from core.services.tlh_execution import tlh_execution_service
        
        holding_id = request.query_params.get('holding_id')
        if not holding_id:
            return Response(
                {'error': 'holding_id parameter is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            holding = Holding.objects.get(id=holding_id)
            suggestions = tlh_execution_service.suggest_replacements(holding)
            serializer = ReplacementSuggestionSerializer(suggestions, many=True)
            return Response(serializer.data)
        except Holding.DoesNotExist:
            return Response(
                {'error': 'Holding not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
