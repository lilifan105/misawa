"""
RDS Connection Module

Manages PostgreSQL database connections with connection pooling and retry logic.
"""

import time
import logging
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2 import pool, OperationalError, DatabaseError
from psycopg2.extras import RealDictCursor


logger = logging.getLogger(__name__)


class ConnectionError(Exception):
    """Raised when database connection fails"""
    pass


class RDSConnectionPool:
    """
    Manages PostgreSQL connection pool with SSL/TLS and retry logic.
    
    Features:
    - Connection pooling (min_conn=2, max_conn=10)
    - SSL/TLS encryption (sslmode=require)
    - Exponential backoff retry (max 3 attempts)
    - Connection timeout: 5 seconds
    - Query timeout: 30 seconds
    """
    
    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str,
        min_conn: int = 2,
        max_conn: int = 10
    ):
        """
        Initialize RDS connection pool.
        
        Args:
            host: RDS endpoint
            port: Database port (default: 5432)
            database: Database name
            user: Database username
            password: Database password
            min_conn: Minimum connections in pool
            max_conn: Maximum connections in pool
        """
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self.min_conn = min_conn
        self.max_conn = max_conn
        
        self._pool: Optional[pool.SimpleConnectionPool] = None
        self._initialize_pool()
    
    def _initialize_pool(self):
        """
        Initialize connection pool with retry logic.
        
        Raises:
            ConnectionError: If pool initialization fails after retries
        """
        max_retries = 3
        base_delay = 1  # seconds
        
        for attempt in range(max_retries):
            try:
                self._pool = psycopg2.pool.SimpleConnectionPool(
                    self.min_conn,
                    self.max_conn,
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.user,
                    password=self.password,
                    sslmode='require',  # Force SSL/TLS
                    connect_timeout=5,
                    options='-c statement_timeout=30000'  # 30 second query timeout
                )
                logger.info(f"Successfully initialized RDS connection pool to {self.host}")
                return
                
            except OperationalError as e:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(
                        f"Connection attempt {attempt + 1} failed: {str(e)}. "
                        f"Retrying in {delay} seconds..."
                    )
                    time.sleep(delay)
                else:
                    logger.error(f"Failed to initialize connection pool after {max_retries} attempts")
                    raise ConnectionError(f"Failed to connect to RDS: {str(e)}")
    
    def get_connection(self) -> psycopg2.extensions.connection:
        """
        Get a connection from the pool.
        
        Returns:
            Database connection
            
        Raises:
            ConnectionError: If connection cannot be obtained
        """
        if not self._pool:
            raise ConnectionError("Connection pool not initialized")
        
        try:
            conn = self._pool.getconn()
            if conn:
                return conn
            else:
                raise ConnectionError("Failed to get connection from pool")
        except Exception as e:
            raise ConnectionError(f"Error getting connection: {str(e)}")
    
    def return_connection(self, conn: psycopg2.extensions.connection):
        """
        Return a connection to the pool.
        
        Args:
            conn: Database connection to return
        """
        if self._pool and conn:
            self._pool.putconn(conn)
    
    def execute_query(
        self,
        query: str,
        params: tuple = None,
        fetch_one: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Execute SQL query with automatic connection management.
        
        Args:
            query: SQL query with placeholders (%s)
            params: Query parameters tuple
            fetch_one: If True, return only first result
            
        Returns:
            Query results as list of dicts (or single dict if fetch_one=True)
            
        Raises:
            DatabaseError: If query execution fails
            ConnectionError: If connection fails
        """
        conn = None
        cursor = None
        
        try:
            conn = self.get_connection()
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Execute query
            cursor.execute(query, params or ())
            
            # Fetch results
            if fetch_one:
                result = cursor.fetchone()
                return dict(result) if result else None
            else:
                results = cursor.fetchall()
                return [dict(row) for row in results]
            
        except OperationalError as e:
            logger.error(f"Database operational error: {str(e)}")
            raise ConnectionError(f"Database connection error: {str(e)}")
        except DatabaseError as e:
            logger.error(f"Database error executing query: {str(e)}")
            raise DatabaseError(f"Query execution failed: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error executing query: {str(e)}")
            raise DatabaseError(f"Unexpected database error: {str(e)}")
        finally:
            if cursor:
                cursor.close()
            if conn:
                self.return_connection(conn)
    
    def close_all_connections(self):
        """Close all connections in the pool."""
        if self._pool:
            self._pool.closeall()
            logger.info("Closed all connections in pool")
