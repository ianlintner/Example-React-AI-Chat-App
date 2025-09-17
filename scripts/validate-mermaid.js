#!/usr/bin/env node

/**
 * Mermaid Diagram Validator
 *
 * This script validates all Mermaid diagrams in markdown files within the docs/ directory.
 * It extracts Mermaid code blocks and validates them using the Mermaid CLI parser.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

class MermaidValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.totalDiagrams = 0;
    this.validDiagrams = 0;
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  /**
   * Extract all Mermaid code blocks from a markdown file
   */
  extractMermaidBlocks(content, filePath) {
    const blocks = [];
    const lines = content.split('\n');
    let inMermaidBlock = false;
    let currentBlock = [];
    let blockStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === '```mermaid') {
        inMermaidBlock = true;
        blockStartLine = i + 1;
        currentBlock = [];
      } else if (line.trim() === '```' && inMermaidBlock) {
        inMermaidBlock = false;
        if (currentBlock.length > 0) {
          blocks.push({
            content: currentBlock.join('\n'),
            startLine: blockStartLine,
            endLine: i,
            filePath,
          });
        }
      } else if (inMermaidBlock) {
        currentBlock.push(line);
      }
    }

    return blocks;
  }

  /**
   * Validate a single Mermaid diagram using basic syntax checks
   */
  async validateMermaidDiagram(block) {
    try {
      const content = block.content.trim();

      if (content.length === 0) {
        return {
          isValid: false,
          error: 'Empty diagram content',
        };
      }

      // Basic validation - check for common Mermaid diagram types and syntax
      const validDiagramTypes = [
        'graph',
        'flowchart',
        'sequenceDiagram',
        'classDiagram',
        'stateDiagram',
        'erDiagram',
        'journey',
        'gantt',
        'pie',
        'gitgraph',
        'mindmap',
        'timeline',
        'quadrantChart',
        'requirementDiagram',
      ];

      const firstLine = content.split('\n')[0].trim();
      const hasValidType = validDiagramTypes.some(type =>
        firstLine.toLowerCase().startsWith(type.toLowerCase()),
      );

      if (!hasValidType) {
        return {
          isValid: false,
          error: `Invalid diagram type. Expected one of: ${validDiagramTypes.join(', ')}`,
        };
      }

      // Check for balanced brackets and quotes - skip for erDiagram
      let inQuotes = false;
      if (!firstLine.toLowerCase().startsWith('erdiagram')) {
        const chars = content.split('');
        let bracketCount = 0;
        let quoteChar = null;

        for (let i = 0; i < chars.length; i++) {
          const char = chars[i];

          if (!inQuotes && (char === '"' || char === "'")) {
            inQuotes = true;
            quoteChar = char;
          } else if (inQuotes && char === quoteChar && chars[i - 1] !== '\\') {
            inQuotes = false;
            quoteChar = null;
          } else if (!inQuotes) {
            if (char === '[' || char === '(' || char === '{') {
              bracketCount++;
            } else if (char === ']' || char === ')' || char === '}') {
              bracketCount--;
            }
          }
        }

        if (bracketCount !== 0) {
          return {
            isValid: false,
            error: 'Unbalanced brackets or parentheses',
          };
        }

        if (inQuotes) {
          return {
            isValid: false,
            error: 'Unclosed quote in diagram',
          };
        }
      }

      // Additional checks for specific diagram types
      if (firstLine.toLowerCase().startsWith('sequencediagram')) {
        // Check for proper participant declarations or usage
        const hasParticipants =
          content.includes('participant ') ||
          content.includes('actor ') ||
          content.includes('->') ||
          content.includes('->>');
        if (!hasParticipants) {
          return {
            isValid: false,
            error: 'Sequence diagram should have participants and interactions',
          };
        }
      }

      if (
        firstLine.toLowerCase().startsWith('graph') ||
        firstLine.toLowerCase().startsWith('flowchart')
      ) {
        // Check for node connections
        const hasConnections =
          content.includes('-->') ||
          content.includes('---') ||
          content.includes('-.->') ||
          content.includes('==>');
        if (
          !hasConnections &&
          !content.includes('[') &&
          !content.includes('(')
        ) {
          return {
            isValid: false,
            error: 'Graph/flowchart should have nodes or connections',
          };
        }
      }

      return { isValid: true, error: null };
    } catch (error) {
      return {
        isValid: false,
        error: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Process a single markdown file
   */
  async processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const mermaidBlocks = this.extractMermaidBlocks(content, filePath);

      if (mermaidBlocks.length === 0) {
        return;
      }

      this.log(
        `\n📄 Processing ${filePath} (${mermaidBlocks.length} diagram${mermaidBlocks.length === 1 ? '' : 's'})`,
        'blue',
      );

      for (const block of mermaidBlocks) {
        this.totalDiagrams++;
        const blockInfo = `${filePath}:${block.startLine}-${block.endLine}`;

        const result = await this.validateMermaidDiagram(block);

        if (result.isValid) {
          this.validDiagrams++;
          this.log(
            `  ✅ Diagram at lines ${block.startLine}-${block.endLine}`,
            'green',
          );
        } else {
          this.errors.push({
            file: filePath,
            startLine: block.startLine,
            endLine: block.endLine,
            error: result.error,
            content: block.content,
          });
          this.log(
            `  ❌ Diagram at lines ${block.startLine}-${block.endLine}: ${result.error}`,
            'red',
          );
        }
      }
    } catch (error) {
      this.errors.push({
        file: filePath,
        error: `Failed to process file: ${error.message}`,
      });
      this.log(`❌ Failed to process ${filePath}: ${error.message}`, 'red');
    }
  }

  /**
   * Recursively find all markdown files in a directory
   */
  findMarkdownFiles(dir) {
    const files = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and node_modules
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this.findMarkdownFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Main validation function
   */
  async validate(targetPath = 'docs') {
    this.log(`🔍 Validating Mermaid diagrams in ${targetPath}/...`, 'bold');

    if (!fs.existsSync(targetPath)) {
      this.log(`❌ Directory ${targetPath} does not exist`, 'red');
      process.exit(1);
    }

    const markdownFiles = this.findMarkdownFiles(targetPath);
    this.log(
      `📁 Found ${markdownFiles.length} markdown files to check`,
      'blue',
    );

    for (const file of markdownFiles) {
      await this.processFile(file);
    }

    this.printSummary();

    // Exit with error code if there were validation errors
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  /**
   * Print validation summary
   */
  printSummary() {
    this.log('\n' + '='.repeat(60), 'bold');
    this.log('📊 MERMAID VALIDATION SUMMARY', 'bold');
    this.log('='.repeat(60), 'bold');

    this.log(`Total diagrams found: ${this.totalDiagrams}`, 'blue');
    this.log(`Valid diagrams: ${this.validDiagrams}`, 'green');
    this.log(
      `Invalid diagrams: ${this.errors.length}`,
      this.errors.length > 0 ? 'red' : 'green',
    );

    if (this.errors.length > 0) {
      this.log('\n❌ VALIDATION ERRORS:', 'red');
      this.log('-'.repeat(40), 'red');

      this.errors.forEach((error, index) => {
        this.log(
          `\n${index + 1}. ${error.file}${error.startLine ? `:${error.startLine}-${error.endLine}` : ''}`,
          'red',
        );
        this.log(`   ${error.error}`, 'red');

        if (error.content) {
          // Show first few lines of the problematic diagram
          const lines = error.content.split('\n').slice(0, 3);
          this.log(`   Content preview:`, 'yellow');
          lines.forEach(line => {
            this.log(`   > ${line}`, 'yellow');
          });
          if (error.content.split('\n').length > 3) {
            this.log(`   > ... (truncated)`, 'yellow');
          }
        }
      });
    } else {
      this.log('\n🎉 All Mermaid diagrams are valid!', 'green');
    }
  }
}

// CLI interface
if (require.main === module) {
  const targetPath = process.argv[2] || 'docs';
  const validator = new MermaidValidator();

  validator.validate(targetPath).catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = MermaidValidator;
