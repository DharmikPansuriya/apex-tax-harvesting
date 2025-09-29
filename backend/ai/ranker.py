"""
TLH Candidate Ranker

AI/ML helper for ranking Tax-Loss Harvesting candidates.
Provides deterministic heuristic scoring with ML interface stubs.
"""

from decimal import Decimal
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from django.db.models import Q

from core.models import Holding, Transaction, Section104Pool, DisposalMatch


class TLHRanker:
    """Ranks TLH candidates using deterministic heuristics with ML interface stubs"""
    
    def __init__(self):
        self.thirty_day_days = 30
    
    def rank_tlh_candidates(self, portfolio_snapshot: Optional[Dict] = None) -> List[Dict]:
        """
        Rank TLH candidates based on unrealised losses and compliance constraints.
        
        Args:
            portfolio_snapshot: Optional portfolio snapshot (if None, uses current state)
            
        Returns:
            List of ranked candidates with scores and explanations
        """
        if portfolio_snapshot is None:
            portfolio_snapshot = self._get_current_portfolio_snapshot()
        
        candidates = []
        
        for holding_data in portfolio_snapshot['holdings']:
            candidate = self._evaluate_holding(holding_data)
            if candidate:
                candidates.append(candidate)
        
        # Normalize scores to 0–100 for easier comparison
        if candidates:
            raw_scores = [c['score'] for c in candidates]
            min_s, max_s = min(raw_scores), max(raw_scores)
            for c in candidates:
                c['raw_score'] = c['score']
                if max_s > min_s:
                    c['score'] = ((c['raw_score'] - min_s) / (max_s - min_s)) * 100.0
                else:
                    # If all scores equal, assign 100 if positive else 0
                    c['score'] = 100.0 if c['raw_score'] > 0 else 0.0

        # Sort by normalized score (descending - higher scores are better TLH candidates)
        candidates.sort(key=lambda x: x['score'], reverse=True)
        
        return candidates
    
    def _get_current_portfolio_snapshot(self) -> Dict:
        """Get current portfolio snapshot"""
        holdings = Holding.objects.all()
        snapshot = {'holdings': []}
        
        for holding in holdings:
            try:
                pool = holding.section104_pool
            except Section104Pool.DoesNotExist:
                continue
            
            if pool.pooled_qty <= 0:
                continue
            
            # Get current market price (simulated - in real app, this would come from market data)
            current_price = self._get_current_market_price(holding)
            
            # Calculate unrealised P&L
            unrealised_pnl = (Decimal(str(current_price)) - pool.avg_cost) * pool.pooled_qty
            
            holding_data = {
                'holding': holding,
                'pool': pool,
                'current_price': current_price,
                'unrealised_pnl': unrealised_pnl,
                'unrealised_pnl_pct': ((Decimal(str(current_price)) - pool.avg_cost) / pool.avg_cost * 100) if pool.avg_cost > 0 else 0
            }
            
            snapshot['holdings'].append(holding_data)
        
        return snapshot
    
    def _evaluate_holding(self, holding_data: Dict) -> Optional[Dict]:
        """Evaluate a holding as a TLH candidate"""
        holding = holding_data['holding']
        pool = holding_data['pool']
        current_price = holding_data['current_price']
        unrealised_pnl = holding_data['unrealised_pnl']
        unrealised_pnl_pct = holding_data['unrealised_pnl_pct']
        
        # Only consider holdings with unrealised losses
        if unrealised_pnl >= 0:
            return None
        
        # Check for 30-day rule constraints
        thirty_day_constraint = self._check_thirty_day_constraint(holding)
        
        # Calculate base score
        base_score = self._calculate_base_score(unrealised_pnl, unrealised_pnl_pct, pool.pooled_qty)
        
        # Apply constraint penalties
        final_score = self._apply_constraint_penalties(base_score, thirty_day_constraint)
        
        # Generate explanation
        explanation = self._generate_explanation(holding, unrealised_pnl, unrealised_pnl_pct, thirty_day_constraint)
        
        return {
            'holding_id': str(holding.id),
            'ticker': holding.ticker,
            'name': holding.name,
            'current_price': current_price,
            'avg_cost': pool.avg_cost,
            'unrealised_pnl': unrealised_pnl,
            'unrealised_pnl_pct': unrealised_pnl_pct,
            'pooled_qty': pool.pooled_qty,
            'score': final_score,
            'reason': explanation,
            'constraints': {
                'thirty_day_rule': thirty_day_constraint
            }
        }
    
    def _check_thirty_day_constraint(self, holding: Holding) -> Dict:
        """Check if holding is subject to 30-day rule constraints"""
        # Check for recent sales (within last 30 days)
        thirty_days_ago = datetime.now().date() - timedelta(days=self.thirty_day_days)
        
        recent_sales = Transaction.objects.filter(
            holding=holding,
            side='SELL',
            trade_date__gte=thirty_days_ago
        ).order_by('-trade_date')
        
        if recent_sales.exists():
            latest_sale = recent_sales.first()
            days_since_sale = (datetime.now().date() - latest_sale.trade_date).days
            return {
                'blocked': True,
                'days_remaining': self.thirty_day_days - days_since_sale,
                'last_sale_date': latest_sale.trade_date,
                'message': f"Within 30 days of prior sell — harvesting blocked for {self.thirty_day_days - days_since_sale} more days"
            }
        
        return {'blocked': False}
    
    def _calculate_base_score(self, unrealised_pnl: Decimal, unrealised_pnl_pct: float, qty: Decimal) -> float:
        """
        Calculate base TLH score using deterministic heuristic.
        
        Score components:
        1. Unrealised loss size (larger losses = higher score)
        2. Loss percentage (higher % = higher score)
        3. Quantity (more shares = higher score)
        """
        # Normalize unrealised loss (convert to positive for scoring)
        loss_magnitude = abs(float(unrealised_pnl))
        
        # Normalize loss percentage (convert to positive)
        loss_pct_magnitude = abs(float(unrealised_pnl_pct))
        
        # Normalize quantity
        qty_normalized = float(qty)
        
        # Weighted score calculation
        score = (
            loss_magnitude * 0.4 +           # 40% weight on absolute loss
            loss_pct_magnitude * 0.4 +       # 40% weight on percentage loss
            qty_normalized * 0.2             # 20% weight on quantity
        )
        
        return score
    
    def _apply_constraint_penalties(self, base_score: float, thirty_day_constraint: Dict) -> float:
        """Apply penalties based on compliance constraints"""
        final_score = base_score
        
        # Apply 30-day rule penalty
        if thirty_day_constraint['blocked']:
            # Reduce score significantly if blocked by 30-day rule
            final_score *= 0.1
        
        return final_score
    
    def _generate_explanation(self, holding: Holding, unrealised_pnl: Decimal, unrealised_pnl_pct: float, thirty_day_constraint: Dict) -> str:
        """Generate human-readable explanation for the TLH candidate"""
        explanations = []
        
        # Loss information
        explanations.append(f"Unrealised loss: £{abs(float(unrealised_pnl)):,.2f} ({abs(float(unrealised_pnl_pct)):.1f}%)")
        
        # Constraint information
        if thirty_day_constraint['blocked']:
            explanations.append(thirty_day_constraint['message'])
        else:
            explanations.append("No 30-day rule constraints")
        
        # Additional context
        if abs(float(unrealised_pnl_pct)) > 20:
            explanations.append("Significant loss opportunity")
        elif abs(float(unrealised_pnl_pct)) > 10:
            explanations.append("Moderate loss opportunity")
        else:
            explanations.append("Small loss opportunity")
        
        return " | ".join(explanations)
    
    def _get_current_market_price(self, holding: Holding) -> Decimal:
        """Get current market price for a holding from Yahoo Finance"""
        try:
            from core.services.market_data import MarketDataService
            market_service = MarketDataService()
            price = market_service.get_current_price(holding.ticker)
            return price if price else Decimal('100.00')
        except:
            # Fallback to simulated prices
            price_map = {
                'ABC': Decimal('13.50'),
                'XYZ': Decimal('48.75'),
                'FND': Decimal('97.25'),
            }
            return price_map.get(holding.ticker, Decimal('100.00'))
    
    # ML Interface Stubs (for future implementation)
    
    def train_lstm_model(self, historical_data: List[Dict]) -> bool:
        """
        Train LSTM model for price prediction.
        
        Args:
            historical_data: List of historical price data
            
        Returns:
            True if training successful
        """
        # Stub implementation
        print("LSTM model training stub - not implemented")
        return True
    
    def predict_price_movement(self, holding: Holding, horizon_days: int = 30) -> Dict:
        """
        Predict price movement using ML model.
        
        Args:
            holding: The holding to predict
            horizon_days: Prediction horizon in days
            
        Returns:
            Dict with prediction results
        """
        # Stub implementation
        return {
            'predicted_return': 0.0,
            'confidence': 0.5,
            'model_used': 'stub'
        }
    
    def train_xgb_model(self, features: List[Dict], targets: List[float]) -> bool:
        """
        Train XGBoost model for TLH scoring.
        
        Args:
            features: Feature vectors
            targets: Target scores
            
        Returns:
            True if training successful
        """
        # Stub implementation
        print("XGBoost model training stub - not implemented")
        return True
    
    def get_ml_score(self, holding_data: Dict) -> float:
        """
        Get ML-based TLH score.
        
        Args:
            holding_data: Holding data for scoring
            
        Returns:
            ML-based score
        """
        # Stub implementation - fall back to heuristic
        return self._calculate_base_score(
            holding_data['unrealised_pnl'],
            holding_data['unrealised_pnl_pct'],
            holding_data['pool']['pooled_qty']
        )


# Global ranker instance
tlh_ranker = TLHRanker()
