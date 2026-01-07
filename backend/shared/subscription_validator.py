"""
Subscription Validator Module

Validates tenant service subscriptions with caching.
"""

import time
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from .rds_connection import RDSConnection


logger = logging.getLogger(__name__)


class SubscriptionValidator:
    """
    Validates tenant service subscriptions.
    
    Features:
    - Tenant name to UUID resolution
    - Active subscription verification
    - 5-minute result caching
    """
    
    def __init__(self, rds_connection: RDSConnection, service_id: str, cache_ttl: int = 300):
        """
        Initialize subscription validator.
        
        Args:
            rds_connection: RDS connection instance
            service_id: Document management service UUID
            cache_ttl: Cache TTL in seconds (default: 300 = 5 minutes)
        """
        self.rds_connection = rds_connection
        self.service_id = service_id
        self.cache_ttl = cache_ttl
        
        # Cache for tenant_id lookups
        self._tenant_id_cache: Dict[str, tuple[Optional[str], float]] = {}
        
        # Cache for subscription checks
        self._subscription_cache: Dict[str, tuple[bool, float]] = {}
    
    def get_tenant_id(self, tenant_name: str) -> Optional[str]:
        """
        Get tenant_id (UUID) from tenant_name.
        
        Args:
            tenant_name: Tenant name from JWT (custom:tenant_name)
            
        Returns:
            Tenant UUID or None if not found
        """
        # Check cache
        if tenant_name in self._tenant_id_cache:
            cached_id, cache_time = self._tenant_id_cache[tenant_name]
            if (time.time() - cache_time) < self.cache_ttl:
                return cached_id
        
        # Query database
        try:
            query = """
                SELECT tenant_id 
                FROM tenant 
                WHERE tenant_name = %s
            """
            results = self.rds_connection.execute_query(query, (tenant_name,))
            
            tenant_id = results[0]['tenant_id'] if results else None
            
            # Update cache
            self._tenant_id_cache[tenant_name] = (tenant_id, time.time())
            
            if not tenant_id:
                logger.warning(f"Tenant not found: {tenant_name}")
            
            return tenant_id
            
        except Exception as e:
            logger.error(f"Error resolving tenant_id for '{tenant_name}': {str(e)}")
            return None
    
    def check_subscription(self, tenant_id: str) -> bool:
        """
        Check if tenant has active subscription to the service.
        
        Args:
            tenant_id: Tenant UUID
            
        Returns:
            True if active subscription exists, False otherwise
        """
        # Check cache
        cache_key = f"{tenant_id}:{self.service_id}"
        if cache_key in self._subscription_cache:
            cached_result, cache_time = self._subscription_cache[cache_key]
            if (time.time() - cache_time) < self.cache_ttl:
                return cached_result
        
        # Query database
        try:
            query = """
                SELECT subscription_id, status, expires_at
                FROM tenant_service_subscription
                WHERE tenant_id = %s 
                  AND service_id = %s
                  AND status = 'active'
                  AND (expires_at IS NULL OR expires_at > NOW())
            """
            results = self.rds_connection.execute_query(
                query,
                (tenant_id, self.service_id)
            )
            
            has_subscription = len(results) > 0
            
            # Update cache
            self._subscription_cache[cache_key] = (has_subscription, time.time())
            
            if not has_subscription:
                logger.warning(f"No active subscription for tenant_id '{tenant_id}'")
            
            return has_subscription
            
        except Exception as e:
            logger.error(f"Error checking subscription for tenant_id '{tenant_id}': {str(e)}")
            return False
    
    def get_subscription_details(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """
        Get subscription details for a tenant.
        
        Args:
            tenant_id: Tenant UUID
            
        Returns:
            Subscription details dict or None if not found
            Contains: subscription_id, access_level, subscribed_at, expires_at, status
        """
        try:
            query = """
                SELECT 
                    subscription_id,
                    access_level,
                    subscribed_at,
                    expires_at,
                    status,
                    created_at,
                    updated_at
                FROM tenant_service_subscription
                WHERE tenant_id = %s 
                  AND service_id = %s
            """
            results = self.rds_connection.execute_query(
                query,
                (tenant_id, self.service_id)
            )
            
            result = results[0] if results else None
            
            if not result:
                logger.warning(f"No subscription found for tenant_id '{tenant_id}'")
            
            return result
            
        except Exception as e:
            logger.error(f"Error getting subscription details for tenant_id '{tenant_id}': {str(e)}")
            return None
    
    def clear_cache(self):
        """Clear all caches."""
        self._tenant_id_cache.clear()
        self._subscription_cache.clear()
        logger.info("Cleared subscription validator caches")
