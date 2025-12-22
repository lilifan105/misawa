# Shared Authentication Modules

This directory contains shared modules for multitenant authentication and authorization.

## Modules

### 1. jwt_validator.py
Validates Cognito JWT tokens and extracts claims.

**Features:**
- JWKS caching (1 hour TTL)
- Token signature verification using python-jose
- Required claims validation (custom:tenant_name, name, custom:role)
- Expiration checking

**Usage:**
```python
from shared.jwt_validator import JWTValidator

validator = JWTValidator(
    region='ap-northeast-1',
    user_pool_id='ap-northeast-1_xxxxxxxxx'
)

try:
    claims = validator.validate_token(token)
    tenant_name = claims['custom:tenant_name']
    username = claims['name']
    role = claims['custom:role']
except InvalidTokenError as e:
    # Handle invalid token
    pass
```

### 2. rds_connection.py
Manages PostgreSQL database connections with pooling and retry logic.

**Features:**
- Connection pooling (min=2, max=10)
- SSL/TLS encryption (sslmode=require)
- Exponential backoff retry (max 3 attempts)
- Connection timeout: 5 seconds
- Query timeout: 30 seconds

**Usage:**
```python
from shared.rds_connection import RDSConnectionPool

pool = RDSConnectionPool(
    host='db.example.com',
    port=5432,
    database='multitenant',
    user='readonly_user',
    password='password'
)

# Execute query
results = pool.execute_query(
    "SELECT * FROM tenant WHERE tenant_name = %s",
    ('sample-company',)
)
```

### 3. subscription_validator.py
Validates tenant service subscriptions with caching.

**Features:**
- Tenant name to UUID resolution
- Active subscription verification
- 5-minute result caching

**Usage:**
```python
from shared.subscription_validator import SubscriptionValidator

validator = SubscriptionValidator(
    rds_pool=pool,
    service_id='uuid-for-document-management'
)

# Get tenant ID
tenant_id = validator.get_tenant_id('sample-company')

# Check subscription
has_access = validator.check_subscription(tenant_id)
```

### 4. tenant_context.py
Manages tenant context throughout request lifecycle.

**Features:**
- Thread-safe context management using contextvars
- Request-scoped context storage
- Helper methods for accessing context data

**Usage:**
```python
from shared.tenant_context import TenantContextManager

# Create context from JWT claims
context = TenantContextManager.create_context(
    jwt_claims=claims,
    tenant_id=tenant_id
)

# Access context anywhere in request
tenant_id = TenantContextManager.get_tenant_id()
tenant_name = TenantContextManager.get_tenant_name()

# Get context for logging
log_data = TenantContextManager.get_context_for_logging()
```

## Dependencies

Install dependencies:
```bash
pip install -r requirements.txt
```

Required packages:
- python-jose[cryptography]==3.3.0
- requests==2.31.0
- psycopg2-binary==2.9.9

## Environment Variables

Required environment variables for Lambda functions:

```bash
# Cognito settings
COGNITO_REGION=ap-northeast-1
COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx

# RDS connection settings
MULTITENANT_RDS_HOST=multitenant-db.example.com
MULTITENANT_RDS_PORT=5432
MULTITENANT_RDS_DATABASE=multitenant
MULTITENANT_RDS_USER=readonly_user
MULTITENANT_RDS_PASSWORD=<secure-password>

# Service settings
DOCUMENT_SERVICE_ID=uuid-for-document-management

# Cache settings (optional)
SUBSCRIPTION_CACHE_TTL=300  # 5 minutes
```

## Error Handling

All modules raise specific exceptions:

- `InvalidTokenError`: JWT token is invalid or expired
- `MissingClaimError`: Required claims missing from token
- `ConnectionError`: Database connection failed
- `DatabaseError`: Query execution failed
- `ContextNotFoundError`: Tenant context not set

## Logging

All modules use Python's standard logging module. Configure logging in your Lambda function:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

## Testing

Unit tests are located in `tests/unit/`:
- `test_jwt_validator.py`
- `test_rds_connection.py`
- `test_subscription_validator.py`
- `test_tenant_context.py`

Run tests:
```bash
pytest tests/unit/
```
