"""
URL configuration for TLH UK API
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.viewsets import (
    WealthManagerViewSet, ClientViewSet, HoldingViewSet, TransactionViewSet, 
    Section104PoolViewSet, DisposalMatchViewSet, CGTReportViewSet, 
    TLHOpportunityViewSet, CSVUploadViewSet, TLHExecutionViewSet
)
from api.auth_views import login, logout, refresh_token, me, register

# Create router and register viewsets
router = DefaultRouter()
router.register(r'wealth-managers', WealthManagerViewSet, basename='wealth-manager')
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'holdings', HoldingViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'section104-pools', Section104PoolViewSet)
router.register(r'disposal-matches', DisposalMatchViewSet)
router.register(r'reports', CGTReportViewSet)
router.register(r'tlh/opportunities', TLHOpportunityViewSet, basename='tlh-opportunities')
router.register(r'tlh/executions', TLHExecutionViewSet, basename='tlh-executions')
router.register(r'csv-uploads', CSVUploadViewSet, basename='csv-upload')

urlpatterns = [
    path('api/', include(router.urls)),
    # Authentication endpoints
    path('api/auth/login/', login, name='login'),
    path('api/auth/logout/', logout, name='logout'),
    path('api/auth/refresh/', refresh_token, name='refresh_token'),
    path('api/auth/me/', me, name='me'),
    path('api/auth/register/', register, name='register'),
]
