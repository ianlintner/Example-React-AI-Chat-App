# GitHub Copilot Agent Instructions

This directory contains specialized agent instructions for GitHub Copilot to provide context-aware assistance when working with this repository.

## Overview

GitHub Copilot uses these instruction files to understand the project structure, coding standards, and best practices specific to this repository. This helps provide more relevant and accurate code suggestions and completions.

## Structure

- **`../copilot-instructions.md`** - Main instructions for all Copilot interactions
- **`coding-agent.md`** - Specialized instructions for code implementation tasks
- **`documentation-agent.md`** - Specialized instructions for documentation tasks
- **`testing-agent.md`** - Specialized instructions for writing and maintaining tests

## How It Works

When you use GitHub Copilot in this repository:

1. Copilot reads the main `copilot-instructions.md` file for general context
2. Based on the task, it may reference specialized agent instructions
3. It applies project-specific patterns and conventions to its suggestions

## Agent Roles

### Coding Agent
Assists with:
- Feature implementation
- Bug fixes
- Code refactoring
- API development
- Integration work

### Documentation Agent
Assists with:
- Technical documentation
- API documentation
- README updates
- MkDocs content
- Code comments

### Testing Agent
Assists with:
- Unit test writing
- Integration test development
- Test debugging
- Coverage improvement
- Test maintenance

## Using These Instructions

### For Developers

Simply use GitHub Copilot as normal in this repository. The instructions are automatically applied to provide better context-aware suggestions.

### For Copilot

When assisting with tasks:
1. Always reference the main `copilot-instructions.md` first
2. For specialized tasks, consult the relevant agent instructions
3. Follow the patterns and conventions documented
4. Maintain consistency with existing code

## Maintaining Instructions

These instructions should be updated when:
- Project structure changes significantly
- New technologies or frameworks are added
- Coding standards or conventions change
- New development patterns are established
- Common issues or patterns emerge

## Best Practices

1. **Keep instructions current** - Update when project changes
2. **Be specific** - Provide concrete examples and patterns
3. **Stay consistent** - Ensure all instructions align
4. **Include context** - Explain why, not just how
5. **Test changes** - Verify instructions improve suggestions

## Examples

### Good Instruction Example
```markdown
## Error Handling Pattern

Always use try-catch for async operations:

\`\`\`typescript
try {
  const result = await operation();
  return result;
} catch (error) {
  logger.error({ error }, 'Operation failed');
  throw new AppError('Operation failed', 500);
}
\`\`\`
```

### Poor Instruction Example
```markdown
Handle errors properly.
```

## Related Documentation

- [Main README](../../README.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [Architecture Documentation](../../docs/architecture/)
- [Development Guides](../../docs/development/)

## Questions?

If you have questions about these instructions or suggestions for improvements:
- Open an issue with the `documentation` label
- Submit a pull request with proposed changes
- Discuss in team meetings or code reviews

## Version History

- **v1.0.0** (2024-01-01) - Initial setup with coding, documentation, and testing agents
