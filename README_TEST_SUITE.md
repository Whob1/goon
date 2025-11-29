# Microagent Validation Test Suite

## Overview

This test suite validates the OpenHands Maintainer microagent configuration file (`.openhands/microagents/openhands_maintainer.md`).

## Quick Start

```bash
# Install dependencies
npm install

# Run tests (47 tests should pass)
npm test
```

## What's Included

### Test Suite
- **47 validation tests** across 10 categories
- **391 lines** of test code
- **~1 second** execution time
- Zero external dependencies (only Jest)

### Documentation
1. `TESTING_GUIDE.md` - Comprehensive usage guide (437 lines)
2. `TEST_SUITE_SUMMARY.md` - Implementation overview (233 lines)
3. `FINAL_SUMMARY.md` - Complete project summary (273 lines)
4. `tests/README.md` - Test suite documentation (73 lines)
5. `tests/TEST_MATRIX.md` - Detailed test breakdown (296 lines)

### Total: 1,312 lines of documentation

## Test Categories

1. ✅ **File Structure** (4 tests) - File existence and format
2. ✅ **YAML Frontmatter** (6 tests) - Schema validation
3. ✅ **Content Quality** (8 tests) - Documentation quality
4. ✅ **Mission Requirements** (7 tests) - Required sections
5. ✅ **Content Specificity** (4 tests) - Actionable details
6. ✅ **Triggers Configuration** (3 tests) - Activation phrases
7. ✅ **Formatting & Style** (5 tests) - Markdown consistency
8. ✅ **Security & Edge Cases** (4 tests) - Security validation
9. ✅ **Project Consistency** (3 tests) - Correct references
10. ✅ **Actionability** (3 tests) - Clear instructions

## Why Validation Tests?

The changed file is a **Markdown configuration file with YAML frontmatter**, not executable code.

| Approach | Applicable? | Reason |
|----------|-------------|--------|
| Traditional unit tests | ❌ | No executable code to test |
| Component tests | ❌ | Not a UI component |
| Integration tests | ❌ | Not an API or service |
| **Validation tests** | ✅ | **Perfect for configuration files** |

This approach is industry-standard for:
- JSON Schema validation
- YAML linting
- Terraform validation
- Kubernetes manifest validation
- Infrastructure as Code validation

## Commands

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test category
npm test -- --testNamePattern="Security"

# Verbose output
npm test -- --verbose
```

## Expected Output