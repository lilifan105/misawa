"""
JWT Token Validator Module

Validates Cognito JWT tokens and extracts claims.
"""

import os
import time
from typing import Dict, Any, Optional
import requests
from jose import jwt, JWTError
from jose.exceptions import ExpiredSignatureError, JWTClaimsError


class InvalidTokenError(Exception):
    """Raised when JWT token is invalid or expired"""
    pass


class MissingClaimError(Exception):
    """Raised when required claims are missing from token"""
    pass


class JWTValidator:
    """
    Validates Cognito JWT tokens and extracts claims.
    
    Caches JWKS (JSON Web Key Set) for 1 hour to improve performance.
    """
    
    def __init__(self, region: str, user_pool_id: str):
        """
        Initialize JWT validator.
        
        Args:
            region: AWS region (e.g., 'ap-northeast-1')
            user_pool_id: Cognito User Pool ID
        """
        self.region = region
        self.user_pool_id = user_pool_id
        self.jwks_url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
        
        # Cache for JWKS
        self._jwks_cache: Optional[Dict[str, Any]] = None
        self._jwks_cache_time: float = 0
        self._jwks_cache_ttl: int = 3600  # 1 hour
        
    def _get_jwks(self) -> Dict[str, Any]:
        """
        Get JWKS from Cognito, using cache if available.
        
        Returns:
            JWKS dictionary
            
        Raises:
            InvalidTokenError: If JWKS cannot be retrieved
        """
        current_time = time.time()
        
        # Return cached JWKS if still valid
        if self._jwks_cache and (current_time - self._jwks_cache_time) < self._jwks_cache_ttl:
            return self._jwks_cache
        
        # Fetch fresh JWKS
        try:
            response = requests.get(self.jwks_url, timeout=5)
            response.raise_for_status()
            jwks = response.json()
            
            # Update cache
            self._jwks_cache = jwks
            self._jwks_cache_time = current_time
            
            return jwks
        except Exception as e:
            raise InvalidTokenError(f"Failed to retrieve JWKS: {str(e)}")
    
    def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate JWT token and extract claims.
        
        Args:
            token: JWT token string
            
        Returns:
            Dict containing claims:
                - custom:tenant_name: str
                - name: str
                - custom:role: str
                - sub: str (user ID)
                - email: str
                
        Raises:
            InvalidTokenError: Token is invalid or expired
            MissingClaimError: Required claims are missing
        """
        try:
            # Get JWKS
            jwks = self._get_jwks()
            
            # Get the key ID from token header
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get('kid')
            
            if not kid:
                raise InvalidTokenError("Token header missing 'kid' field")
            
            # Find the matching key in JWKS
            key = None
            for jwk_key in jwks.get('keys', []):
                if jwk_key.get('kid') == kid:
                    key = jwk_key
                    break
            
            if not key:
                raise InvalidTokenError(f"Public key not found for kid: {kid}")
            
            # Verify token signature and decode claims
            claims = jwt.decode(
                token,
                key,
                algorithms=['RS256'],
                audience=None,  # Cognito ID tokens don't have aud claim
                options={
                    'verify_signature': True,
                    'verify_exp': True,
                    'verify_iat': True,
                }
            )
            
            # Validate required claims
            required_claims = ['custom:tenant_name', 'name', 'custom:role', 'sub']
            missing_claims = [claim for claim in required_claims if claim not in claims]
            
            if missing_claims:
                raise MissingClaimError(f"Missing required claims: {', '.join(missing_claims)}")
            
            return claims
            
        except ExpiredSignatureError:
            raise InvalidTokenError("Token has expired")
        except JWTClaimsError as e:
            raise InvalidTokenError(f"Token claims validation failed: {str(e)}")
        except JWTError as e:
            raise InvalidTokenError(f"Token validation failed: {str(e)}")
        except Exception as e:
            if isinstance(e, (InvalidTokenError, MissingClaimError)):
                raise
            raise InvalidTokenError(f"Unexpected error during token validation: {str(e)}")
