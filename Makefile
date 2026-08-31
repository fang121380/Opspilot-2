PYTHON ?= .venv/bin/python
PIP ?= .venv/bin/pip

.PHONY: setup test coverage eval demo lint format migrate recover-jobs run

setup:
	$(PYTHON) -m pip install --upgrade pip
	$(PIP) install -e '.[dev]'

test:
	$(PYTHON) -m pytest

coverage:
	$(PYTHON) -m pytest --cov=app --cov-report=term-missing

eval:
	$(PYTHON) scripts/run-evals.py

demo:
	$(PYTHON) scripts/run-local-demo.py

lint:
	$(PYTHON) -m ruff check .

format:
	$(PYTHON) -m ruff format .

migrate:
	$(PYTHON) -m app.migrate

recover-jobs:
	$(PYTHON) -m app.job_recovery

run:
	$(PYTHON) -m uvicorn app.main:app --reload
