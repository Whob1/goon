# Microagent Validation Test Matrix

## Test Coverage Overview

This document provides a complete breakdown of all validation tests for the OpenHands Maintainer microagent configuration file.

## Test Execution Matrix

| Category | Test Case | Purpose | Pass Criteria |
|----------|-----------|---------|---------------|
| **File Structure** | | | |
| 1 | File exists at correct location | Validates file path | File found at `.openhands/microagents/openhands_maintainer.md` |
| 2 | Valid markdown file | Checks file format | Has `.md` extension and non-empty content |
| 3 | Has YAML frontmatter | Validates structure | Starts with `---` and has closing `---` |
| 4 | Has markdown content | Ensures documentation exists | Non-empty content after frontmatter |
| **YAML Frontmatter** | | | |
| 5 | Has 'name' field | Required metadata | `name: OpenHands Maintainer` present |
| 6 | Has 'type' field | Required metadata | `type: knowledge` present |
| 7 | Has 'version' field | Required metadata | Valid semver format (e.g., `1.0.0`) |
| 8 | Has 'agent' field | Required metadata | `agent: CodeActAgent` present |
| 9 | Has 'triggers' array | Activation phrases | At least one trigger defined |
| 10 | Valid semantic version | Version format | Three numbers separated by dots |
| **Content Quality** | | | |
| 11 | Has Purpose section | Documentation completeness | `## Purpose` heading present |
| 12 | Has Mission section | Documentation completeness | `## Mission` heading present |
| 13 | No trailing whitespace | Code quality | Lines don't end with spaces |
| 14 | Proper markdown headings | Formatting | Valid heading syntax (`##`, `###`, etc.) |
| 15 | Has numbered lists | Structure | At least one `1.` style list |
| 16 | No placeholder text | Content quality | No TODO, FIXME, or lorem ipsum |
| 17 | Comprehensive content | Completeness | Minimum 1000 characters |
| 18 | Proper sentence structure | Readability | Multiple complete sentences |
| **Mission Requirements** | | | |
| 19 | RAG Index Refresh | Task completeness | Mentions index rebuild process |
| 20 | Documentation Health Check | Task completeness | References README, CONTRIBUTING |
| 21 | agent.md enhancement | Task completeness | Specific agent.md requirements |
| 22 | Autonomous Features | Task completeness | Lists improvement categories |
| 23 | Code Style requirements | Task completeness | References linters (ruff/black/mypy) |
| 24 | Final Steps | Task completeness | Commit and PR instructions |
| 25 | Minimum 6 action items | Completeness | At least 6 numbered items |
| **Content Specificity** | | | |
| 26 | Specific file references | Actionability | Names README.md, CONTRIBUTING.md |
| 27 | Improvement categories | Clarity | Lists performance, error recovery, etc. |
| 28 | Tool references | Specificity | Mentions specific tools |
| 29 | Actionable language | Clarity | Uses imperative verbs (run, update, fix) |
| **Triggers Configuration** | | | |
| 30 | Multiple triggers | Usability | At least 3 trigger phrases |
| 31 | Quoted trigger strings | YAML correctness | Triggers wrapped in quotes |
| 32 | Descriptive triggers | Usability | Each trigger > 5 characters |
| **Formatting & Style** | | | |
| 33 | Consistent heading levels | Formatting | No skipped heading levels |
| 34 | Consistent list formatting | Formatting | Proper indentation for bullets |
| 35 | Proper section spacing | Readability | Blank lines before headings |
| 36 | No multiple blank lines | Code quality | Max one consecutive blank line |
| 37 | Proper file ending | Formatting | Ends with "Start now.." |
| **Security & Edge Cases** | | | |
| 38 | No malicious commands | Security | No `rm -rf /`, fork bombs, etc. |
| 39 | No hardcoded secrets | Security | No API keys, passwords, tokens |
| 40 | Reasonable line lengths | Readability | Less than 5 lines exceed 200 chars |
| 41 | UTF-8 safe characters | Compatibility | No control characters |
| **Project Consistency** | | | |
| 42 | Correct project name | Accuracy | References "OpenHands" (not other projects) |
| 43 | No incorrect names | Accuracy | Doesn't mention wrong project names |
| 44 | Appropriate terminology | Quality | Uses technical terms correctly |
| **Actionability** | | | |
| 45 | Clear executable steps | Usability | Each action item > 10 characters |
| 46 | Action verbs | Clarity | Uses imperative mood (Run, Crawl, Update) |
| 47 | Success criteria | Completeness | Defines what "done" looks like |

## Validation Flow