"""
Authentication views for financial advisors
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from core.models import WealthManager
from .serializers import WealthManagerSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Login endpoint for all user types"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response(
            {'error': 'Username and password are required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = authenticate(username=username, password=password)
    
    if user is None:
        return Response(
            {'error': 'Invalid credentials'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Get user profile (exists for all users)
    from core.models import UserProfile
    try:
        user_profile = user.profile
    except UserProfile.DoesNotExist:
        return Response(
            {'error': 'User profile not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    access_token = refresh.access_token
    
    response_data = {
        'access': str(access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
        },
        'user_profile': {
            'client_type': user_profile.client_type,
            'firm_name': user_profile.firm_name,
            'license_number': user_profile.license_number,
            'phone': user_profile.phone,
        }
    }
    
    # Add wealth manager data if user is a financial advisor
    if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
        try:
            wealth_manager = user.wealth_manager
            response_data['wealth_manager'] = WealthManagerSerializer(wealth_manager).data
        except WealthManager.DoesNotExist:
            # This shouldn't happen if registration is working correctly
            pass
    
    # Add client data for individual investors
    if user_profile.client_type == 'individual':
        from core.models import Client
        try:
            # Find the client associated with this individual investor
            client = Client.objects.filter(
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                wealth_manager=None
            ).first()
            if client:
                from .serializers import ClientSerializer
                response_data['client'] = ClientSerializer(client).data
        except Exception:
            # Client not found or other error
            pass
    
    return Response(response_data)


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    """Refresh JWT token"""
    refresh_token = request.data.get('refresh')
    
    if not refresh_token:
        return Response(
            {'error': 'Refresh token is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        refresh = RefreshToken(refresh_token)
        access_token = refresh.access_token
        
        return Response({
            'access': str(access_token),
        })
    except Exception as e:
        return Response(
            {'error': 'Invalid refresh token'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Logout endpoint - blacklist refresh token"""
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        
        return Response({'message': 'Successfully logged out'})
    except Exception as e:
        return Response(
            {'error': 'Invalid token'}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Get current user profile"""
    from core.models import UserProfile
    
    # Get user profile (exists for all users)
    try:
        user_profile = request.user.profile
    except UserProfile.DoesNotExist:
        return Response(
            {'error': 'User profile not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    response_data = {
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
        },
        'user_profile': {
            'client_type': user_profile.client_type,
            'firm_name': user_profile.firm_name,
            'license_number': user_profile.license_number,
            'phone': user_profile.phone,
        }
    }
    
    # Add wealth manager data if user is a financial advisor
    if user_profile.client_type in ['wealth_manager', 'financial_advisor']:
        try:
            wealth_manager = request.user.wealth_manager
            response_data['wealth_manager'] = WealthManagerSerializer(wealth_manager).data
        except WealthManager.DoesNotExist:
            # This shouldn't happen if registration is working correctly
            pass
    
    # Add client data for individual investors
    if user_profile.client_type == 'individual':
        from core.models import Client
        try:
            # Find the client associated with this individual investor
            client = Client.objects.filter(
                first_name=request.user.first_name,
                last_name=request.user.last_name,
                email=request.user.email,
                wealth_manager=None
            ).first()
            if client:
                from .serializers import ClientSerializer
                response_data['client'] = ClientSerializer(client).data
        except Exception:
            # Client not found or other error
            pass
    
    return Response(response_data)


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register new user with different types"""
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    first_name = request.data.get('first_name')
    last_name = request.data.get('last_name')
    user_type = request.data.get('user_type', 'individual')
    firm_name = request.data.get('firm_name', '')
    license_number = request.data.get('license_number', '')
    phone = request.data.get('phone', '')
    
    if not all([username, email, password, first_name, last_name]):
        return Response(
            {'error': 'All required fields must be provided'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate user type
    valid_user_types = ['individual', 'wealth_manager', 'financial_advisor', 'institution']
    if user_type not in valid_user_types:
        return Response(
            {'error': 'Invalid user type'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if user already exists
    if User.objects.filter(username=username).exists():
        return Response(
            {'error': 'Username already exists'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if User.objects.filter(email=email).exists():
        return Response(
            {'error': 'Email already exists'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Create user
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name
    )
    
    # Create user profile
    from core.models import UserProfile
    user_profile = UserProfile.objects.create(
        user=user,
        client_type=user_type,
        firm_name=firm_name if firm_name else None,
        license_number=license_number,
        phone=phone
    )
    
    # Create wealth manager profile if applicable
    wealth_manager = None
    if user_type in ['wealth_manager', 'financial_advisor']:
        # Set default firm name if not provided
        if not firm_name:
            firm_name = f"{first_name} {last_name} Wealth Management"
        
        wealth_manager = WealthManager.objects.create(
            user=user,
            firm_name=firm_name,
            license_number=license_number,
            phone=phone
        )
    
    # Create client for individual investors
    client = None
    if user_type == 'individual':
        from core.models import Client
        client = Client.objects.create(
            wealth_manager=None,  # Individual investors don't have a wealth manager
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            risk_profile='MODERATE'  # Default risk profile
        )
    
    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    access_token = refresh.access_token
    
    response_data = {
        'access': str(access_token),
        'refresh': str(refresh),
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
        },
        'user_profile': {
            'client_type': user_profile.client_type,
            'firm_name': user_profile.firm_name,
            'license_number': user_profile.license_number,
            'phone': user_profile.phone,
        }
    }
    
    # Add wealth manager data if applicable
    if wealth_manager:
        response_data['wealth_manager'] = WealthManagerSerializer(wealth_manager).data
    
    # Add client data for individual investors
    if client:
        from .serializers import ClientSerializer
        response_data['client'] = ClientSerializer(client).data
    
    return Response(response_data, status=status.HTTP_201_CREATED)
