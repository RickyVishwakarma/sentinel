"""Runtime settings, loaded from the environment / .env (see .env.example)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Persistence
    database_url: str = "sqlite:///./sentinel.db"
    span_store: str = "sql"           # "sql" | "mongo"
    mongo_url: str = "mongodb://localhost:27017"
    mongo_db: str = "sentinel"

    # Rate limiting
    rate_limiter: str = "memory"      # "memory" | "redis"
    redis_url: str = "redis://localhost:6379/0"
    rate_limit_per_minute: int = 60

    # Providers (unset key => provider is skipped in the fallback chain)
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    gemini_api_key: str | None = None

    anthropic_model: str = "claude-opus-4-8"
    openai_model: str = "gpt-4o-mini"
    gemini_model: str = "gemini-1.5-flash"


@lru_cache
def get_settings() -> Settings:
    return Settings()
