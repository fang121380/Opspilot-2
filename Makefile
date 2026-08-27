PYTHON ?= .venv/bin/python
PIP ?= .venv/bin/pip

.PHONY: setup test lint format run

setup:
	$(PYTHON) -m pip install --upgrade pip
	$(PIP) install -e '.[dev]'

test:
	$(PYTHON) -m pytest

lint:
	$(PYTHON) -m ruff check .

format:
	$(PYTHON) -m ruff format .

run:
	$(PYTHON) -m uvicorn app.main:app --reload

