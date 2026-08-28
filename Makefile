PYTHON ?= .venv/bin/python
PIP ?= .venv/bin/pip

.PHONY: setup test coverage eval lint format run

setup:
	$(PYTHON) -m pip install --upgrade pip
	$(PIP) install -e '.[dev]'

test:
	$(PYTHON) -m pytest

coverage:
	$(PYTHON) -m pytest --cov=app --cov-report=term-missing

eval:
	$(PYTHON) scripts/run-evals.py

lint:
	$(PYTHON) -m ruff check .

format:
	$(PYTHON) -m ruff format .

run:
	$(PYTHON) -m uvicorn app.main:app --reload
