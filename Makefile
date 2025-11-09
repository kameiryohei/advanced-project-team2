setup/first:
	make -C backend deps
	make -C frontend deps
	npm run install
	docker compose up -d

run/backend:
	make -C backend start

run/frontend:
	make -C frontend/ start

check: check/backend check/frontend

check/backend:
	make -C backend check

check/frontend:
	make -C frontend check

.PHONY: setup/first run/backend run/frontend check/backend check/frontend