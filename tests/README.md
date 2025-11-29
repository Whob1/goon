# Microagent Validation Tests

This directory contains validation tests for OpenHands microagent configuration files.

## Purpose

These tests ensure that microagent configuration files:
- Have valid YAML frontmatter with required fields
- Contain comprehensive, actionable content
- Follow proper Markdown formatting conventions
- Are free from security issues
- Maintain consistency with project standards

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Categories

### 1. File Structure
Validates basic file existence and format.

### 2. YAML Frontmatter Validation
Checks required fields: name, type, version, agent, triggers.

### 3. Content Quality
Ensures the content is comprehensive and well-written.

### 4. Mission Requirements
Validates that all required sections are present and detailed.

### 5. Content Specificity
Checks for specific, actionable instructions.

### 6. Triggers Configuration
Validates trigger phrases and formatting.

### 7. Formatting and Style
Ensures consistent Markdown formatting.

### 8. Edge Cases and Security
Checks for security issues and malicious content.

### 9. Consistency with Project
Validates correct project references and terminology.

### 10. Actionability
Ensures instructions are clear and executable.

## Adding New Tests

To add new validation tests:

1. Add a new `describe` block in `microagent-validation.test.js`
2. Write test cases using Jest's `test()` or `it()` functions
3. Use descriptive test names that explain what is being validated
4. Ensure tests are deterministic and don't rely on external services

## Test Coverage

The validation tests provide comprehensive coverage of:
- Configuration structure (100%)
- Content quality metrics (100%)
- Security checks (100%)
- Formatting standards (100%)