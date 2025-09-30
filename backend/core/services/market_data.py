"""
Market Data Service - uses Alpha Vantage for last available daily close.
"""

try:
    # yfinance no longer used for pricing; keep optional import for other areas if needed
    import yfinance as yf  # noqa: F401
except ImportError:
    yf = None  # noqa: F401

import requests
from decimal import Decimal
import os
from typing import Dict, Optional, List
from django.core.cache import cache
import logging
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

class MarketDataService:
    """Service for fetching real market data (Alpha Vantage last close)."""
    
    # Top 50 UK securities with their Yahoo Finance tickers
    UK_SECURITIES = {
        # FTSE 100 Companies
        'AAL.L': {'name': 'Anglo American', 'sector': 'Mining'},
        'ABF.L': {'name': 'Associated British Foods', 'sector': 'Consumer Goods'},
        'ADM.L': {'name': 'Admiral Group', 'sector': 'Insurance'},
        'AHT.L': {'name': 'Ashtead Group', 'sector': 'Industrial Services'},
        'ANTO.L': {'name': 'Antofagasta', 'sector': 'Mining'},
        'AUTO.L': {'name': 'Auto Trader Group', 'sector': 'Technology'},
        'AV.L': {'name': 'Aviva', 'sector': 'Insurance'},
        'AZN.L': {'name': 'AstraZeneca', 'sector': 'Pharmaceuticals'},
        'BA.L': {'name': 'BAE Systems', 'sector': 'Defense'},
        'BARC.L': {'name': 'Barclays', 'sector': 'Banking'},
        'BATS.L': {'name': 'British American Tobacco', 'sector': 'Tobacco'},
        'BDEV.L': {'name': 'Barratt Developments', 'sector': 'Construction'},
        'BEZ.L': {'name': 'Beazley', 'sector': 'Insurance'},
        'BG.L': {'name': 'BG Group', 'sector': 'Oil & Gas'},
        'BKG.L': {'name': 'Berkeley Group', 'sector': 'Construction'},
        'BLND.L': {'name': 'British Land', 'sector': 'Real Estate'},
        'BNZL.L': {'name': 'Bunzl', 'sector': 'Distribution'},
        'BP.L': {'name': 'BP', 'sector': 'Oil & Gas'},
        'BRBY.L': {'name': 'Burberry', 'sector': 'Luxury Goods'},
        'BT-A.L': {'name': 'BT Group', 'sector': 'Telecommunications'},
        'CCH.L': {'name': 'Coca-Cola HBC', 'sector': 'Beverages'},
        'CCL.L': {'name': 'Carnival', 'sector': 'Travel & Leisure'},
        'CNA.L': {'name': 'Centrica', 'sector': 'Utilities'},
        'CPG.L': {'name': 'Compass Group', 'sector': 'Food Services'},
        'CRDA.L': {'name': 'Croda International', 'sector': 'Chemicals'},
        'CRH.L': {'name': 'CRH', 'sector': 'Building Materials'},
        'DCC.L': {'name': 'DCC', 'sector': 'Distribution'},
        'DGE.L': {'name': 'Diageo', 'sector': 'Beverages'},
        'EVR.L': {'name': 'Evraz', 'sector': 'Steel'},
        'EXPN.L': {'name': 'Experian', 'sector': 'Information Services'},
        'FERG.L': {'name': 'Ferguson', 'sector': 'Distribution'},
        'FLTR.L': {'name': 'Flutter Entertainment', 'sector': 'Gaming'},
        'FRES.L': {'name': 'Fresnillo', 'sector': 'Mining'},
        'GLEN.L': {'name': 'Glencore', 'sector': 'Mining'},
        'GSK.L': {'name': 'GSK', 'sector': 'Pharmaceuticals'},
        'HL.L': {'name': 'Hargreaves Lansdown', 'sector': 'Financial Services'},
        'HLMA.L': {'name': 'Halma', 'sector': 'Technology'},
        'HSBA.L': {'name': 'HSBC', 'sector': 'Banking'},
        'IAG.L': {'name': 'International Airlines Group', 'sector': 'Airlines'},
        'IHG.L': {'name': 'InterContinental Hotels', 'sector': 'Hospitality'},
        'IMB.L': {'name': 'Imperial Brands', 'sector': 'Tobacco'},
        'INF.L': {'name': 'Informa', 'sector': 'Information Services'},
        'ITV.L': {'name': 'ITV', 'sector': 'Media'},
        'JD.L': {'name': 'JD Sports Fashion', 'sector': 'Retail'},
        'JET.L': {'name': 'Just Eat Takeaway', 'sector': 'Food Delivery'},
        'KGF.L': {'name': 'Kingfisher', 'sector': 'Retail'},
        'LAND.L': {'name': 'Land Securities', 'sector': 'Real Estate'},
        'LGEN.L': {'name': 'Legal & General', 'sector': 'Insurance'},
        'LLOY.L': {'name': 'Lloyds Banking Group', 'sector': 'Banking'},
        'LSE.L': {'name': 'London Stock Exchange', 'sector': 'Financial Services'},
        'MGGT.L': {'name': 'Meggitt', 'sector': 'Aerospace'},
        'MNDI.L': {'name': 'Mondi', 'sector': 'Paper & Packaging'},
        'MNG.L': {'name': 'M&G', 'sector': 'Asset Management'},
        'MRO.L': {'name': 'Melrose Industries', 'sector': 'Industrial'},
        'MRW.L': {'name': 'Morrisons', 'sector': 'Retail'},
        'NG.L': {'name': 'National Grid', 'sector': 'Utilities'},
        'NXT.L': {'name': 'Next', 'sector': 'Retail'},
        'OCDO.L': {'name': 'Ocado Group', 'sector': 'Online Retail'},
        'PFC.L': {'name': 'Petrofac', 'sector': 'Oil Services'},
        'PRU.L': {'name': 'Prudential', 'sector': 'Insurance'},
        'PSON.L': {'name': 'Pearson', 'sector': 'Education'},
        'PSN.L': {'name': 'Persimmon', 'sector': 'Construction'},
        'RBS.L': {'name': 'NatWest Group', 'sector': 'Banking'},
        'RDSA.L': {'name': 'Royal Dutch Shell', 'sector': 'Oil & Gas'},
        'REL.L': {'name': 'RELX', 'sector': 'Information Services'},
        'RKT.L': {'name': 'Reckitt Benckiser', 'sector': 'Consumer Goods'},
        'RMV.L': {'name': 'Rightmove', 'sector': 'Property'},
        'RR.L': {'name': 'Rolls-Royce', 'sector': 'Aerospace'},
        'RTO.L': {'name': 'Rentokil Initial', 'sector': 'Business Services'},
        'SBRY.L': {'name': 'Sainsbury\'s', 'sector': 'Retail'},
        'SDR.L': {'name': 'Schroders', 'sector': 'Asset Management'},
        'SGE.L': {'name': 'Sage Group', 'sector': 'Software'},
        'SGRO.L': {'name': 'Segro', 'sector': 'Real Estate'},
        'SHEL.L': {'name': 'Shell', 'sector': 'Oil & Gas'},
        'SMT.L': {'name': 'Scottish Mortgage Investment Trust', 'sector': 'Investment Trust'},
        'SN.L': {'name': 'Smith & Nephew', 'sector': 'Medical Devices'},
        'SPX.L': {'name': 'Spirax-Sarco Engineering', 'sector': 'Industrial'},
        'SSE.L': {'name': 'SSE', 'sector': 'Utilities'},
        'STAN.L': {'name': 'Standard Chartered', 'sector': 'Banking'},
        'STJ.L': {'name': 'St. James\'s Place', 'sector': 'Wealth Management'},
        'SVT.L': {'name': 'Severn Trent', 'sector': 'Utilities'},
        'TSCO.L': {'name': 'Tesco', 'sector': 'Retail'},
        'TUI.L': {'name': 'TUI Group', 'sector': 'Travel'},
        'ULVR.L': {'name': 'Unilever', 'sector': 'Consumer Goods'},
        'UU.L': {'name': 'United Utilities', 'sector': 'Utilities'},
        'VOD.L': {'name': 'Vodafone', 'sector': 'Telecommunications'},
        'WEIR.L': {'name': 'Weir Group', 'sector': 'Industrial'},
        'WPP.L': {'name': 'WPP', 'sector': 'Advertising'},
        'WTB.L': {'name': 'Whitbread', 'sector': 'Hospitality'},
    }
    
    def __init__(self):
        # Longer cache to reduce external calls and avoid rate limits
        self.cache_timeout = int(os.environ.get('MARKET_PRICE_CACHE_SECONDS', '3600'))
        # Always prefer live prices; do not use static fallback unless explicitly coded
        self.always_fallback = False
        self.alpha_key = os.environ.get('ALPHAVANTAGE_API_KEY', '').strip()
    
    def get_current_price(self, ticker: str) -> Optional[Decimal]:
        """Get current market price for a ticker"""
        print(f"get_current_price called for ticker={ticker}")
        print(f"cache_timeout={self.cache_timeout}")
        if not self.alpha_key:
            logger.warning("ALPHAVANTAGE_API_KEY not set; returning 0")
            return Decimal('0.00')
            
        cache_key = f"price_{ticker}"
        cooldown_key = f"price_cooldown_{ticker}"

        # Respect cooldown if we recently hit a rate limit for this ticker
        if cache.get(cooldown_key):
            print(f"cooldown active for {ticker}; returning 0")
            return Decimal('0.00')
        cached_price = cache.get(cache_key)
        
        if cached_price is not None:
            print(f"cache hit for {ticker}: {cached_price}")
            return Decimal(str(cached_price))
        else:
            print(f"cache miss for {ticker}")
        
        try:
            # 0) Check today's snapshot in DB
            from core.models import PriceSnapshot
            today = timezone.now().date()
            snap = PriceSnapshot.objects.filter(ticker=ticker, date=today).first()
            if snap:
                print(f"snapshot hit for {ticker} {today}: {snap.close}")
                cache.set(cache_key, float(snap.close), self.cache_timeout)
                return Decimal(str(snap.close))

            # 1) Fetch from Alpha Vantage and persist snapshot
            print(f"trying symbol variants for {ticker}")
            for variant in self._alpha_symbol_variants(ticker):
                price = self._get_alpha_last_close(variant)
                print(f"price for {variant}: {price}")
                if price is not None:
                    print(f"alpha last close for {variant}: {price}")
                    cache.set(cache_key, float(price), self.cache_timeout)
                    # Save snapshot
                    PriceSnapshot.objects.update_or_create(
                        ticker=ticker,
                        date=today,
                        defaults={'close': price}
                    )
                    return price
            logger.warning(f"No last price available for {ticker} from Alpha Vantage; returning 0")
            return Decimal('0.00')
                
        except Exception as e:
            # If we hit rate limit, set a short cooldown to avoid repeated calls
            msg = str(e)
            if '429' in msg or 'Too Many Requests' in msg or 'Please visit' in msg:
                # set 5-minute cooldown
                cache.set(cooldown_key, True, 300)
            logger.warning(f"Error fetching price for {ticker}: {msg} - returning 0")
            return Decimal('0.00')

    def _alpha_symbol_variants(self, ticker: str) -> list:
        base = ticker[:-2] if ticker.endswith('.L') else ticker
        return [f"{base}.LON", f"{base}.L", base]

    def _get_alpha_last_close(self, symbol: str) -> Optional[Decimal]:
        """Fetch last available close from Alpha Vantage TIME_SERIES_DAILY."""
        try:
            params = {
                'function': 'TIME_SERIES_DAILY',
                'symbol': symbol,
                'apikey': self.alpha_key,
                'datatype': 'json',
            }
            resp = requests.get('https://www.alphavantage.co/query', params=params, timeout=10)
            if resp.status_code != 200:
                return None
            data = resp.json()
            # Alpha Vantage returns 'Note' when throttled and 'Error Message' for bad symbols
            ts = data.get('Time Series (Daily)')
            if not isinstance(ts, dict) or not ts:
                return None
            latest_date = sorted(ts.keys())[-1]
            close_str = ts[latest_date].get('4. close')
            if not close_str:
                return None
            return Decimal(str(float(close_str)))
        except Exception:
            return None
    
    # Note: Fallback pricing has been removed by request. When live prices
    # are unavailable, get_current_price returns Decimal('0.00').
    
    def get_security_info(self, ticker: str) -> Optional[Dict]:
        """Get comprehensive security information"""
        cache_key = f"info_{ticker}"
        cached_info = cache.get(cache_key)
        
        if cached_info is not None:
            return cached_info
        
        try:
            yahoo_ticker = ticker if ticker.endswith('.L') else f"{ticker}.L"
            stock = yf.Ticker(yahoo_ticker)
            info = stock.info
            
            security_info = {
                'name': info.get('longName', ''),
                'sector': info.get('sector', ''),
                'industry': info.get('industry', ''),
                'market_cap': info.get('marketCap', 0),
                'currency': info.get('currency', 'GBP'),
                'exchange': info.get('exchange', 'LSE'),
                'country': info.get('country', 'GB'),
            }
            
            cache.set(cache_key, security_info, self.cache_timeout)
            return security_info
            
        except Exception as e:
            logger.error(f"Error fetching info for {ticker}: {str(e)}")
            return None
    
    def get_top_uk_securities(self) -> List[Dict]:
        """Get list of top UK securities with current prices"""
        securities = []
        
        for ticker, info in self.UK_SECURITIES.items():
            price = self.get_current_price(ticker)
            if price:
                securities.append({
                    'ticker': ticker,
                    'name': info['name'],
                    'sector': info['sector'],
                    'current_price': float(price),
                    'currency': 'GBP'
                })
        
        return sorted(securities, key=lambda x: x['name'])
    
    def get_market_summary(self) -> Dict:
        """Get market summary for dashboard"""
        try:
            # Get FTSE 100 index
            ftse = yf.Ticker("^FTSE")
            ftse_info = ftse.info
            
            return {
                'ftse_100': {
                    'current_price': ftse_info.get('regularMarketPrice', 0),
                    'change': ftse_info.get('regularMarketChange', 0),
                    'change_percent': ftse_info.get('regularMarketChangePercent', 0),
                },
                'last_updated': ftse_info.get('regularMarketTime', ''),
            }
        except Exception as e:
            logger.error(f"Error fetching market summary: {str(e)}")
            return {
                'ftse_100': {
                    'current_price': 0,
                    'change': 0,
                    'change_percent': 0,
                },
                'last_updated': '',
            }
