.PHONY: all
all: help

## help: Display this help message
.PHONY: help
help: Makefile
	@echo
	@echo " Choose a make command to run"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' | sed -e 's/^/ /'
	@echo

## build: Build TypeScript project
.PHONY: build
build:
	npm install
	npm run build

## test: Run tests with timeout and coverage
.PHONY: test
test: build
	npm test -- --testTimeout=30000 --coverage --maxWorkers=1

## test-quick: Run quick test suite for development
.PHONY: test-quick
test-quick: build
	npm test

## lint: Run ESLint code quality checks
.PHONY: lint
lint:
	npm run lint

## format: Format code with Prettier
.PHONY: format
format:
	npm run format

## clean: Clean build artifacts
.PHONY: clean
clean:
	rm -rf dist/ coverage/ node_modules/
	rm -f demo.js debug_*.js

## demo: Run demo showing ROML conversion
.PHONY: demo
demo: build
	@echo "=== ROML Demo ==="
	@echo "Converting sample JSON to ROML format..."
	@echo
	@echo 'const { RomlFile } = require("./dist/file/RomlFile");' > demo.js
	@echo 'const data = { name: "Robert", age: 30, active: true, tags: ["dev", "admin"] };' >> demo.js
	@echo 'console.log("Input:", JSON.stringify(data, null, 2));' >> demo.js
	@echo 'const roml = RomlFile.jsonToRoml(data);' >> demo.js
	@echo 'console.log("\\nROML Output:\\n", roml);' >> demo.js
	@echo 'const roundTrip = RomlFile.romlToJson(roml);' >> demo.js
	@echo 'console.log("\\nRound-trip:", JSON.stringify(roundTrip, null, 2));' >> demo.js
	@echo 'console.log("\\nMatch:", JSON.stringify(data) === JSON.stringify(roundTrip));' >> demo.js
	@node demo.js
	@rm -f demo.js

## watch: Watch for changes and rebuild
.PHONY: watch
watch:
	npm run watch

## test-watch: Run tests in watch mode
.PHONY: test-watch
test-watch:
	npm run test:watch