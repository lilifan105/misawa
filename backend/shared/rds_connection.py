"""
RDS Connection Module

Manages PostgreSQL database connections with retry logic using pg8000.
"""

import time
import logging
from typing import List, Dict, Any, Optional
import pg8000


logger = logging.getLogger(__name__)


class ConnectionError(Exception):
    """Raised when database connection fails"""
    pass


class RDSConnection:
    """
    Manages PostgreSQL connection with SSL/TLS and retry logic.
    
    Features:
    - SSL/TLS encryption
    - Exponential backoff retry (max 3 attempts)
    - Connection timeout: 5 seconds
    """
    
    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str
    ):
        """
        Initialize RDS connection.
        
        Args:
            host: RDS endpoint
            port: Database port (default: 5432)
            database: Database name
            user: Database user
            password: Database password
        """
        self.host = host
        self.port = port
        self.database = database
        self.user = user
        self.password = password
        self._connection = None
        
        logger.info(f"RDS接続を初期化: host={host}, database={database}")
    
    def _create_connection(self) -> pg8000.Connection:
        """
        Create a new database connection with retry logic.
        
        Returns:
            Database connection
            
        Raises:
            ConnectionError: If connection fails after retries
        """
        max_retries = 3
        base_delay = 1  # seconds
        
        for attempt in range(max_retries):
            try:
                conn = pg8000.connect(
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.user,
                    password=self.password,
                    timeout=5,
                    ssl_context=True  # SSL/TLS有効化
                )
                
                logger.info("RDS接続成功")
                return conn
                
            except Exception as e:
                logger.warning(f"RDS接続失敗 (試行 {attempt + 1}/{max_retries}): {str(e)}")
                
                if attempt < max_retries - 1:
                    # Exponential backoff
                    delay = base_delay * (2 ** attempt)
                    time.sleep(delay)
                else:
                    error_msg = f"RDS接続失敗（最大リトライ回数超過）: {str(e)}"
                    logger.error(error_msg)
                    raise ConnectionError(error_msg)
    
    def get_connection(self) -> pg8000.Connection:
        """
        Get database connection (create if not exists).
        
        Returns:
            Database connection
        """
        if self._connection is None:
            self._connection = self._create_connection()
        return self._connection
    
    def execute_query(
        self,
        query: str,
        params: Optional[tuple] = None
    ) -> List[Dict[str, Any]]:
        """
        Execute SELECT query and return results.
        
        Args:
            query: SQL query
            params: Query parameters (optional)
            
        Returns:
            List of result rows as dictionaries
            
        Raises:
            ConnectionError: If query execution fails
        """
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # DB-API 2.0標準の方法でクエリを実行
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            # 列名を取得
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            
            # 結果が空の場合は空のリストを返す
            if not results:
                return []
            
            # 辞書形式に変換
            result_dicts = []
            for row in results:
                if len(columns) != len(row):
                    logger.error(f"列数不一致: columns={len(columns)}, row={len(row)}")
                    continue
                
                try:
                    row_dict = dict(zip(columns, row))
                    result_dicts.append(row_dict)
                except Exception as zip_error:
                    logger.error(f"Error creating dict for row: {str(zip_error)}")
                    raise ConnectionError(f"Failed to create dictionary for row: {str(zip_error)}")
            
            return result_dicts
            
        except Exception as e:
            error_msg = f"クエリ実行エラー: {str(e)}"
            logger.error(error_msg)
            # 接続をリセット
            self._connection = None
            raise ConnectionError(error_msg)
    
    def execute_update(
        self,
        query: str,
        params: Optional[tuple] = None
    ) -> int:
        """
        Execute INSERT/UPDATE/DELETE query.
        
        Args:
            query: SQL query
            params: Query parameters (optional)
            
        Returns:
            Number of affected rows
            
        Raises:
            ConnectionError: If query execution fails
        """
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(query, params)
            conn.commit()
            
            # DB-API 2.0では rowcount で影響を受けた行数を取得
            affected_rows = cursor.rowcount
            
            return affected_rows
            
        except Exception as e:
            error_msg = f"更新クエリ実行エラー: {str(e)}"
            logger.error(error_msg)
            # 接続をリセット
            self._connection = None
            raise ConnectionError(error_msg)
    
    def close(self):
        """Close database connection."""
        if self._connection:
            try:
                self._connection.close()
                logger.info("RDS接続をクローズしました")
            except Exception as e:
                logger.warning(f"RDS接続クローズ時のエラー: {str(e)}")
            finally:
                self._connection = None


# グローバル接続インスタンス（Lambda関数間で再利用）
_global_connection: Optional[RDSConnection] = None


def get_rds_connection(
    host: str,
    port: int,
    database: str,
    user: str,
    password: str
) -> RDSConnection:
    """
    Get or create global RDS connection instance.
    
    Args:
        host: RDS endpoint
        port: Database port
        database: Database name
        user: Database user
        password: Database password
        
    Returns:
        RDS connection instance
    """
    global _global_connection
    
    if _global_connection is None:
        _global_connection = RDSConnection(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
    
    return _global_connection
