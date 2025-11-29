const fs = require('fs');
const path = require('path');

/**
 * Microagent Configuration Validation Tests
 * 
 * These tests validate the structure, content, and quality of microagent
 * configuration files to ensure they follow OpenHands standards.
 */

describe('OpenHands Maintainer Microagent', () => {
  let microagentContent;
  let frontmatter;
  let markdownContent;

  beforeAll(() => {
    const filePath = path.join(__dirname, '..', '.openhands', 'microagents', 'openhands_maintainer.md');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Microagent file not found: ${filePath}`);
    }

    microagentContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse YAML frontmatter
    const frontmatterMatch = microagentContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (frontmatterMatch) {
      const frontmatterText = frontmatterMatch[1];
      markdownContent = frontmatterMatch[2];
      
      // Simple YAML parsing for validation (without external dependencies)
      frontmatter = {};
      frontmatterText.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > -1 && !line.trim().startsWith('-')) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          frontmatter[key] = value;
        }
      });
    }
  });

  describe('File Structure', () => {
    test('should exist at correct location', () => {
      const filePath = path.join(__dirname, '..', '.openhands', 'microagents', 'openhands_maintainer.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    test('should be a valid markdown file', () => {
      expect(microagentContent).toBeDefined();
      expect(microagentContent.length).toBeGreaterThan(0);
      expect(path.extname('.openhands/microagents/openhands_maintainer.md')).toBe('.md');
    });

    test('should have YAML frontmatter', () => {
      expect(microagentContent).toMatch(/^---\n/);
      expect(microagentContent).toMatch(/\n---\n/);
    });

    test('should have markdown content after frontmatter', () => {
      expect(markdownContent).toBeDefined();
      expect(markdownContent.trim().length).toBeGreaterThan(0);
    });
  });

  describe('YAML Frontmatter Validation', () => {
    test('should have required "name" field', () => {
      expect(frontmatter.name).toBeDefined();
      expect(frontmatter.name.length).toBeGreaterThan(0);
      expect(frontmatter.name).toBe('OpenHands Maintainer');
    });

    test('should have required "type" field', () => {
      expect(frontmatter.type).toBeDefined();
      expect(frontmatter.type).toBe('knowledge');
    });

    test('should have required "version" field', () => {
      expect(frontmatter.version).toBeDefined();
      expect(frontmatter.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('should have required "agent" field', () => {
      expect(frontmatter.agent).toBeDefined();
      expect(frontmatter.agent).toBe('CodeActAgent');
    });

    test('should have "triggers" array', () => {
      const triggersSection = microagentContent.match(/triggers:\n((?:  - .*\n)+)/);
      expect(triggersSection).toBeTruthy();
      
      if (triggersSection) {
        const triggers = triggersSection[1].match(/  - (.+)/g).map(t => t.replace('  - ', '').trim());
        expect(triggers.length).toBeGreaterThan(0);
        expect(triggers).toContain('OpenHands Maintainer');
      }
    });

    test('should have valid semantic version', () => {
      const version = frontmatter.version;
      const parts = version.split('.');
      
      expect(parts.length).toBe(3);
      parts.forEach(part => {
        expect(parseInt(part, 10)).not.toBeNaN();
        expect(parseInt(part, 10)).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Content Quality', () => {
    test('should have a Purpose section', () => {
      expect(markdownContent).toMatch(/## Purpose/);
    });

    test('should have a Mission section', () => {
      expect(markdownContent).toMatch(/## Mission/);
    });

    test('should not have trailing whitespace on lines', () => {
      const lines = microagentContent.split('\n');
      const linesWithTrailingSpace = lines.filter((line, i) => 
        line !== line.trimEnd() && i !== lines.length - 1
      );
      
      expect(linesWithTrailingSpace.length).toBe(0);
    });

    test('should have proper markdown headings', () => {
      const headings = markdownContent.match(/^#{1,6} .+$/gm);
      expect(headings).toBeTruthy();
      expect(headings.length).toBeGreaterThan(0);
    });

    test('should have numbered list items', () => {
      const numberedLists = markdownContent.match(/^\d+\. /gm);
      expect(numberedLists).toBeTruthy();
      expect(numberedLists.length).toBeGreaterThan(0);
    });

    test('should have descriptive content (not placeholder text)', () => {
      expect(markdownContent).not.toMatch(/TODO|FIXME|XXX|PLACEHOLDER/i);
      expect(markdownContent).not.toMatch(/lorem ipsum/i);
    });

    test('should be comprehensive (minimum length)', () => {
      // Should have substantial content (at least 1000 characters of actual content)
      expect(markdownContent.trim().length).toBeGreaterThan(1000);
    });

    test('should have proper sentence structure', () => {
      const sentences = markdownContent.match(/[.!?]\s+[A-Z]/g);
      expect(sentences).toBeTruthy();
      expect(sentences.length).toBeGreaterThan(5);
    });
  });

  describe('Mission Requirements', () => {
    test('should define RAG Index Refresh steps', () => {
      expect(markdownContent).toMatch(/RAG Index Refresh/);
      expect(markdownContent).toMatch(/make index|rebuild.*vector database/i);
    });

    test('should define Documentation Health Check steps', () => {
      expect(markdownContent).toMatch(/Documentation Health Check/);
      expect(markdownContent).toMatch(/README\.md|CONTRIBUTING\.md/);
    });

    test('should define agent.md enhancement requirements', () => {
      expect(markdownContent).toMatch(/agent\.md/);
    });

    test('should define Autonomous Feature Additions', () => {
      expect(markdownContent).toMatch(/Autonomous Feature Additions/);
      expect(markdownContent).toMatch(/Performance optimizations|error recovery|logging/i);
    });

    test('should define Code Style requirements', () => {
      expect(markdownContent).toMatch(/Code Style|Cleanliness/i);
      expect(markdownContent).toMatch(/ruff|black|mypy|linter/i);
    });

    test('should define Final Steps', () => {
      expect(markdownContent).toMatch(/Final Steps/);
      expect(markdownContent).toMatch(/commit message|pull request/i);
    });

    test('should have at least 6 major action items', () => {
      const numberedItems = markdownContent.match(/^\d+\. /gm);
      expect(numberedItems.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Content Specificity', () => {
    test('should include specific file names to maintain', () => {
      expect(markdownContent).toMatch(/README\.md/);
      expect(markdownContent).toMatch(/CONTRIBUTING\.md/);
      expect(markdownContent).toMatch(/agent\.md/);
    });

    test('should include specific improvement categories', () => {
      expect(markdownContent).toMatch(/Performance optimizations/);
      expect(markdownContent).toMatch(/error recovery/);
      expect(markdownContent).toMatch(/logging|observability/i);
      expect(markdownContent).toMatch(/Security/i);
    });

    test('should reference specific tools', () => {
      expect(markdownContent).toMatch(/ruff|black|mypy/i);
    });

    test('should include actionable language', () => {
      const actionVerbs = /\b(run|execute|update|create|fix|improve|optimize|ensure|check|add|remove)\b/gi;
      const matches = markdownContent.match(actionVerbs);
      expect(matches).toBeTruthy();
      expect(matches.length).toBeGreaterThan(20);
    });
  });

  describe('Triggers Configuration', () => {
    test('should have multiple trigger phrases', () => {
      const triggersSection = microagentContent.match(/triggers:\n((?:  - .*\n?)+)/);
      expect(triggersSection).toBeTruthy();
      
      if (triggersSection) {
        const triggers = triggersSection[1].match(/  - "?([^"\n]+)"?/g);
        expect(triggers.length).toBeGreaterThanOrEqual(3);
      }
    });

    test('should have quoted trigger strings', () => {
      const triggersSection = microagentContent.match(/triggers:\n((?:  - .*\n?)+)/);
      
      if (triggersSection) {
        const triggers = triggersSection[1].split('\n').filter(l => l.trim().startsWith('- '));
        triggers.forEach(trigger => {
          expect(trigger).toMatch(/  - ".*"/);
        });
      }
    });

    test('should have descriptive trigger phrases', () => {
      const triggersSection = microagentContent.match(/triggers:\n((?:  - .*\n?)+)/);
      
      if (triggersSection) {
        const triggers = triggersSection[1].match(/- "([^"]+)"/g);
        triggers.forEach(trigger => {
          const phrase = trigger.replace(/- "|"/g, '');
          expect(phrase.length).toBeGreaterThan(5);
        });
      }
    });
  });

  describe('Formatting and Style', () => {
    test('should use consistent heading levels', () => {
      const headings = markdownContent.match(/^(#{1,6}) (.+)$/gm);
      
      if (headings) {
        // Should start with ## (h2) after frontmatter
        expect(headings[0]).toMatch(/^## /);
        
        // Should not skip heading levels
        const levels = headings.map(h => h.match(/^#{1,6}/)[0].length);
        for (let i = 1; i < levels.length; i++) {
          const diff = levels[i] - levels[i - 1];
          expect(Math.abs(diff)).toBeLessThanOrEqual(1);
        }
      }
    });

    test('should use consistent list formatting', () => {
      const bulletPoints = markdownContent.match(/^   - /gm);
      expect(bulletPoints).toBeTruthy();
    });

    test('should have proper spacing around sections', () => {
      // Headings should be preceded by blank line (except first)
      const headingPattern = /\n\n## /g;
      const matches = markdownContent.match(headingPattern);
      expect(matches).toBeTruthy();
    });

    test('should not have multiple consecutive blank lines', () => {
      expect(microagentContent).not.toMatch(/\n\n\n+/);
    });

    test('should end with proper line ending', () => {
      // Check if file ends properly (either with newline or specific text)
      expect(microagentContent.endsWith('Start now..')).toBe(true);
    });
  });

  describe('Edge Cases and Security', () => {
    test('should not contain malicious commands', () => {
      const dangerousPatterns = [
        /rm -rf \//,
        /:\(\)\{ :\|:& \};:/,  // Fork bomb
        /wget.*\|.*sh/,
        /curl.*\|.*bash/,
        /eval.*\$\(/
      ];

      dangerousPatterns.forEach(pattern => {
        expect(microagentContent).not.toMatch(pattern);
      });
    });

    test('should not contain hardcoded secrets', () => {
      const secretPatterns = [
        /api[_-]?key.*=.*["'][a-zA-Z0-9]{20,}["']/i,
        /password.*=.*["'].+["']/i,
        /token.*=.*["'][a-zA-Z0-9]{20,}["']/i,
        /ghp_[a-zA-Z0-9]{36}/,  // GitHub token
        /sk-[a-zA-Z0-9]{48}/     // OpenAI key
      ];

      secretPatterns.forEach(pattern => {
        expect(microagentContent).not.toMatch(pattern);
      });
    });

    test('should not have excessively long lines', () => {
      const lines = microagentContent.split('\n');
      const longLines = lines.filter(line => line.length > 200);
      
      // Allow some long lines but not too many
      expect(longLines.length).toBeLessThan(5);
    });

    test('should use UTF-8 safe characters', () => {
      // Check for common problematic characters
      expect(microagentContent).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    });
  });

  describe('Consistency with Project', () => {
    test('should reference OpenHands correctly', () => {
      // Should use consistent naming
      const openHandsRefs = microagentContent.match(/OpenHands/g);
      expect(openHandsRefs).toBeTruthy();
      expect(openHandsRefs.length).toBeGreaterThan(3);
    });

    test('should not reference incorrect project names', () => {
      expect(microagentContent).not.toMatch(/Goon VoiceFlow/);
      expect(microagentContent).not.toMatch(/VoiceFlow/);
    });

    test('should use appropriate technical terminology', () => {
      const technicalTerms = [
        'RAG',
        'vector database',
        'documentation',
        'agent',
        'repository'
      ];

      technicalTerms.forEach(term => {
        expect(microagentContent.toLowerCase()).toMatch(new RegExp(term.toLowerCase()));
      });
    });
  });

  describe('Actionability', () => {
    test('should have clear, executable steps', () => {
      // Each numbered item should have sub-items or clear instructions
      const mainItems = markdownContent.match(/^\d+\. .+$/gm);
      
      expect(mainItems).toBeTruthy();
      mainItems.forEach(item => {
        expect(item.length).toBeGreaterThan(10);
      });
    });

    test('should specify what to do, not just what to achieve', () => {
      // Should have action verbs in imperative mood
      expect(markdownContent).toMatch(/\bRun\b/);
      expect(markdownContent).toMatch(/\bCrawl\b/);
      expect(markdownContent).toMatch(/\bUpdate\b/);
      expect(markdownContent).toMatch(/\bWrite\b/);
    });

    test('should include success criteria', () => {
      // Should mention what "done" looks like
      expect(markdownContent).toMatch(/up to date|up-to-date|current|pristine|complete/i);
    });
  });
});