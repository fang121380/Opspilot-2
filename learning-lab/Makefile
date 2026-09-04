.PHONY: check up status open api down reset

check:
	./scripts/check-prerequisites.sh

up:
	./scripts/lab.sh up

status:
	./scripts/lab.sh status

open:
	./scripts/lab.sh open

api:
	./scripts/lab-api.py

down:
	./scripts/lab.sh down

reset:
	./scripts/lab.sh down
	./scripts/lab.sh up
