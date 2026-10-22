import uuid
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.mysql import BINARY

def get_uuid_column(*, primary_key=False, default=None, nullable=False):
    from sqlalchemy import create_engine
    from app.core.config import settings  # adjust import as needed

    # You may need to get the URL from your config
    db_url = settings.SQLALCHEMY_DATABASE_URI

    if db_url.startswith("postgresql"):
        return PG_UUID(as_uuid=True), default or uuid.uuid4, primary_key, nullable
    elif db_url.startswith("mysql"):
        # Store as CHAR(36) for MySQL
        return String(36), (default or (lambda: str(uuid.uuid4()))), primary_key, nullable
    else:
        # Default to string
        return String(36), (default or (lambda: str(uuid.uuid4()))), primary_key, nullable

# Or, a TypeDecorator for more flexibility:
class GUID(TypeDecorator):
    """Platform-independent GUID type.

    Uses PostgreSQL's UUID type, otherwise stores as CHAR(36).
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID())
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, str):
                return str(value)
            else:
                return value

    def process_result_value(self, value, dialect):
        return value
