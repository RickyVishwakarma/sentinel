FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt "psycopg[binary]" pymongo redis

COPY app ./app
COPY cli ./cli
COPY evals ./evals
COPY scripts ./scripts

EXPOSE 8000

# Seed is idempotent — safe on every boot; PORT is provided by most PaaS hosts.
CMD ["sh", "-c", "python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
