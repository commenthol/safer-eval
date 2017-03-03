
all: v4. v6. v7.

v%:
	n $@ && npm test

.PHONY: all
