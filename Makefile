.PHONY: all
all: build

.PHONY: build
build: .venv
	.venv/bin/bikeshed spec

.venv:
	python3 -mvenv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install bikeshed
	.venv/bin/bikeshed update
