
all: v6. v8. v10. v11.

v%:
	n $@ && npm test

.PHONY: all
