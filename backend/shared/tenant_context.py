"""
Tenant Context Module

Manages tenant context throughout request lifecycle.
"""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from contextvars import ContextVar


logger = logging.getLogger(__name__)


# Context variable for storing tenant context in request scope
_tenant_context: ContextVar[Optional['TenantContext']] = ContextVar(
    'tenant_context',
    default=None
)


class ContextNotFoundError(Exception):
    """Raised when tenant context is not set"""
    pass


@dataclass
class TenantContext:
    """
    Tenant context data.
    
    Attributes:
        tenant_name: Tenant name from JWT (custom:tenant_name)
        tenant_id: Tenant UUID from database
        username: User name from JWT
        role: User role from JWT (custom:role)
        user_id: User ID from JWT (sub)
    """
    tenant_name: str
    tenant_id: str
    username: str
    role: str
    user_id: str
    
    def to_dict(self) -> Dict[str, str]:
        """
        Convert context to dictionary.
        
        Returns:
            Dictionary representation of context
        """
        return {
            'tenant_name': self.tenant_name,
            'tenant_id': self.tenant_id,
            'username': self.username,
            'role': self.role,
            'user_id': self.user_id
        }
    
    def __str__(self) -> str:
        """String representation for logging."""
        return (
            f"TenantContext(tenant_name={self.tenant_name}, "
            f"tenant_id={self.tenant_id}, username={self.username}, "
            f"role={self.role}, user_id={self.user_id})"
        )


class TenantContextManager:
    """
    Manages tenant context in request scope.
    
    Uses contextvars to ensure thread-safe context management
    in Lambda execution environment.
    """
    
    @staticmethod
    def create_context(jwt_claims: Dict[str, Any], tenant_id: str) -> TenantContext:
        """
        Create tenant context from JWT claims.
        
        Args:
            jwt_claims: Validated JWT claims
            tenant_id: Tenant UUID from database
            
        Returns:
            TenantContext instance
            
        Raises:
            ValueError: If required claims are missing
        """
        try:
            context = TenantContext(
                tenant_name=jwt_claims['custom:tenant_name'],
                tenant_id=tenant_id,
                username=jwt_claims['name'],
                role=jwt_claims['custom:role'],
                user_id=jwt_claims['sub']
            )
            
            # Set context in context variable
            _tenant_context.set(context)
            
            logger.info(f"Created tenant context: {context}")
            return context
            
        except KeyError as e:
            raise ValueError(f"Missing required claim in JWT: {str(e)}")
    
    @staticmethod
    def set_context(context: TenantContext):
        """
        Set the current tenant context.
        
        Args:
            context: TenantContext to set
        """
        _tenant_context.set(context)
        logger.debug(f"Set tenant context: {context}")
    
    @staticmethod
    def get_current_context() -> TenantContext:
        """
        Get the current tenant context.
        
        Returns:
            Current TenantContext
            
        Raises:
            ContextNotFoundError: If context is not set
        """
        context = _tenant_context.get()
        
        if context is None:
            raise ContextNotFoundError(
                "Tenant context not found. Ensure context is set before accessing."
            )
        
        return context
    
    @staticmethod
    def clear_context():
        """Clear the current tenant context."""
        _tenant_context.set(None)
        logger.debug("Cleared tenant context")
    
    @staticmethod
    def has_context() -> bool:
        """
        Check if tenant context is set.
        
        Returns:
            True if context is set, False otherwise
        """
        return _tenant_context.get() is not None
    
    @staticmethod
    def get_tenant_id() -> str:
        """
        Get tenant_id from current context.
        
        Returns:
            Tenant UUID
            
        Raises:
            ContextNotFoundError: If context is not set
        """
        context = TenantContextManager.get_current_context()
        return context.tenant_id
    
    @staticmethod
    def get_tenant_name() -> str:
        """
        Get tenant_name from current context.
        
        Returns:
            Tenant name
            
        Raises:
            ContextNotFoundError: If context is not set
        """
        context = TenantContextManager.get_current_context()
        return context.tenant_name
    
    @staticmethod
    def get_user_id() -> str:
        """
        Get user_id from current context.
        
        Returns:
            User ID
            
        Raises:
            ContextNotFoundError: If context is not set
        """
        context = TenantContextManager.get_current_context()
        return context.user_id
    
    @staticmethod
    def get_context_for_logging() -> Dict[str, str]:
        """
        Get context data for structured logging.
        
        Returns:
            Dictionary with tenant context fields, or empty dict if no context
        """
        try:
            context = TenantContextManager.get_current_context()
            return context.to_dict()
        except ContextNotFoundError:
            return {}
