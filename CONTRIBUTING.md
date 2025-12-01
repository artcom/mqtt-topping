# Contributing to MQTT Topping

## Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/artcom/mqtt-topping.git
   cd mqtt-topping
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

## Development Workflow

- **Build:**

  ```bash
  npm run build
  ```

  This uses `tsdown` to build the library.

- **Test:**

  ```bash
  npm test
  ```

  Runs the Jest test suite.

- **Lint:**

  ```bash
  npm run lint
  ```

  Checks code style with ESLint.

- **Format:**

  ```bash
  npm run format
  ```

  Formats code with Prettier.

## Pull Requests

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes.
4. Make sure your code lints.
5. Issue that pull request!

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
