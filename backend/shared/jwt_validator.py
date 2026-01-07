"""
JWT Token Validator Module

Validates Cognito JWT tokens and Multitenant Service JWT tokens, and extracts claims.
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
    Validates Cognito JWT tokens and Multitenant Service JWT tokens, and extracts claims.
    
    Caches JWKS (JSON Web Key Set) for 1 hour to improve performance.
    """
    
    def __init__(self, region: str, user_pool_id: str, multitenant_issuer: Optional[str] = None):
        """
        Initialize JWT validator.
        
        Args:
            region: AWS region (e.g., 'ap-northeast-1')
            user_pool_id: Cognito User Pool ID
            multitenant_issuer: Multitenant service issuer URL (optional)
        """
        self.region = region
        self.user_pool_id = user_pool_id
        self.cognito_jwks_url = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
        self.multitenant_issuer = multitenant_issuer
        self.multitenant_jwks_url = f"{multitenant_issuer}/.well-known/jwks.json" if multitenant_issuer else None
        
        # Cache for JWKS
        self._cognito_jwks_cache: Optional[Dict[str, Any]] = None
        self._cognito_jwks_cache_time: float = 0
        self._multitenant_jwks_cache: Optional[Dict[str, Any]] = None
        self._multitenant_jwks_cache_time: float = 0
        self._jwks_cache_ttl: int = 3600  # 1 hour
        
    def _get_jwks(self, issuer: str) -> Dict[str, Any]:
        """
        Get JWKS from issuer, using cache if available.
        
        Args:
            issuer: Token issuer URL
        
        Returns:
            JWKS dictionary
            
        Raises:
            InvalidTokenError: If JWKS cannot be retrieved
        """
        current_time = time.time()
        
        # Determine which JWKS URL and cache to use
        if self.multitenant_issuer and issuer.startswith(self.multitenant_issuer):
            jwks_url = self.multitenant_jwks_url
            cache = self._multitenant_jwks_cache
            cache_time = self._multitenant_jwks_cache_time
            is_multitenant = True
        else:
            jwks_url = self.cognito_jwks_url
            cache = self._cognito_jwks_cache
            cache_time = self._cognito_jwks_cache_time
            is_multitenant = False
        
        # Return cached JWKS if still valid
        if cache and (current_time - cache_time) < self._jwks_cache_ttl:
            return cache
        
        # Fetch fresh JWKS
        try:
            response = requests.get(jwks_url, timeout=5)
            response.raise_for_status()
            jwks_data = response.json()
            
            # API Gateway形式のレスポンスの場合、bodyフィールドからJWKSを抽出
            if isinstance(jwks_data, dict) and 'body' in jwks_data:
                import json
                jwks = json.loads(jwks_data['body'])
            else:
                jwks = jwks_data
            
            # Update cache
            if is_multitenant:
                self._multitenant_jwks_cache = jwks
                self._multitenant_jwks_cache_time = current_time
            else:
                self._cognito_jwks_cache = jwks
                self._cognito_jwks_cache_time = current_time
            
            return jwks
        except Exception as e:
            raise InvalidTokenError(f"Failed to retrieve JWKS from {jwks_url}: {str(e)}")
    def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate JWT token and extract claims.
        
        Args:
            token: JWT token string
            
        Returns:
            Dict containing claims:
                - tenant_name or custom:tenant_name: str
                - name: str
                - role or custom:role: str
                - sub: str (user ID)
                - email: str (optional)
                
        Raises:
            InvalidTokenError: Token is invalid or expired
            MissingClaimError: Required claims are missing
        """
        import logging
        logger = logging.getLogger()
        
        try:
            # Get the unverified claims to determine issuer
            unverified_claims = jwt.get_unverified_claims(token)
            issuer = unverified_claims.get('iss')
            
            if not issuer:
                logger.error("Token missing 'iss' (issuer) claim")
                raise InvalidTokenError("Token missing 'iss' (issuer) claim")
            
            # Get JWKS based on issuer
            jwks = self._get_jwks(issuer)
            
            # Get the key ID from token header
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get('kid')
            
            if not kid:
                logger.error("Token header missing 'kid' field")
                raise InvalidTokenError("Token header missing 'kid' field")
            
            # Find the matching key in JWKS
            key = None
            for jwk_key in jwks.get('keys', []):
                if jwk_key.get('kid') == kid:
                    key = jwk_key
                    break
            
            if not key:
                logger.error(f"Public key not found for kid: {kid}")
                raise InvalidTokenError(f"Public key not found for kid: {kid}")
            
            # Verify token signature and decode claims
            try:
                # 環境変数からexpected audienceを取得（設定されていない場合は検証をスキップ）
                expected_audience = os.environ.get('MULTITENANT_CLIENT_ID')
                
                decode_options = {
                    'verify_signature': True,
                    'verify_exp': True,
                    'verify_iat': True,
                    'verify_aud': bool(expected_audience),  # audienceが設定されている場合のみ検証
                }
                
                claims = jwt.decode(
                    token,
                    key,
                    algorithms=['RS256'],
                    audience=expected_audience,
                    options=decode_options
                )
            except Exception as decode_error:
                logger.error(f"JWT署名検証エラー: {str(decode_error)}")
                
                # 一時的な回避策: 署名検証をスキップして処理を続行
                # 本番環境では絶対に使用しないでください
                skip_signature_verification = os.environ.get('SKIP_JWT_SIGNATURE_VERIFICATION', 'false').lower() == 'true'
                if skip_signature_verification:
                    logger.warning("⚠️ 警告: 署名検証をスキップしています（開発・デバッグ用）")
                    claims = jwt.decode(
                        token,
                        key,
                        algorithms=['RS256'],
                        options={
                            'verify_signature': False,
                            'verify_exp': False,
                            'verify_iat': False,
                            'verify_aud': False,
                        }
                    )
                else:
                    raise decode_error
            
            # Validate required claims
            # マルチテナントサービス形式（tenant_name）とCognito形式（custom:tenant_name）の両方をサポート
            has_tenant_name = 'tenant_name' in claims or 'custom:tenant_name' in claims
            has_role = 'role' in claims or 'custom:role' in claims
            
            if not has_tenant_name:
                logger.error("Missing required claim: tenant_name or custom:tenant_name")
                raise MissingClaimError("Missing required claim: tenant_name or custom:tenant_name")
            
            if not has_role:
                logger.error("Missing required claim: role or custom:role")
                raise MissingClaimError("Missing required claim: role or custom:role")
            
            if 'sub' not in claims:
                logger.error("Missing required claim: sub")
                raise MissingClaimError("Missing required claim: sub")
            
            return claims
            
        except ExpiredSignatureError:
            logger.error("Token has expired")
            raise InvalidTokenError("Token has expired")
        except JWTClaimsError as e:
            logger.error(f"Token claims validation failed: {str(e)}")
            raise InvalidTokenError(f"Token claims validation failed: {str(e)}")
        except JWTError as e:
            logger.error(f"Token validation failed: {str(e)}")
            raise InvalidTokenError(f"Token validation failed: {str(e)}")
        except Exception as e:
            if isinstance(e, (InvalidTokenError, MissingClaimError)):
                raise
            logger.error(f"Unexpected error during token validation: {str(e)}")
            raise InvalidTokenError(f"Unexpected error during token validation: {str(e)}")
