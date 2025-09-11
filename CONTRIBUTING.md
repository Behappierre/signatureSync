# Contributing to SignatureSync

Thank you for your interest in contributing to SignatureSync! This document provides guidelines for contributing to this project.

## Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL (or Docker)
- Google Cloud Project with OAuth 2.0 credentials
- OpenAI API key

### Local Development
1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/signatureSync.git
   cd signatureSync
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and credentials
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start development environment:**
   ```bash
   docker-compose up
   ```

## Development Workflow

### Branch Strategy
- `main` - Production ready code
- `develop` - Latest development code
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `hotfix/critical-fix` - Critical production fixes

### Making Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes following our guidelines:**
   - Follow TypeScript strict mode
   - Use Material Design 3 principles
   - Write comprehensive tests
   - Update documentation

3. **Test your changes:**
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, semicolons, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
- `feat: add Google OAuth authentication`
- `fix: resolve signature parsing edge case`
- `docs: update API documentation`
- `test: add unit tests for contact validation`

## Code Guidelines

### TypeScript
- Use strict TypeScript configuration
- Define proper interfaces for all data structures
- Avoid `any` types - use proper typing
- Use Zod for runtime validation

### React Components
- Use functional components with hooks
- Follow Material Design 3 principles
- Write accessible components (WCAG 2.1 AA)
- Use proper TypeScript props interfaces

### API Development
- Follow RESTful design principles
- Use OpenAPI/Swagger documentation
- Implement proper error handling
- Add comprehensive input validation

### Security
- Sanitize all user inputs
- Use parameterized queries (Prisma ORM)
- Implement proper authentication checks
- Follow OWASP security guidelines

## Testing

### Running Tests
```bash
# All tests
npm run test

# Frontend only
cd frontend && npm run test

# Backend only  
cd backend && npm run test

# With coverage
npm run test:coverage
```

### Writing Tests
- Write unit tests for utilities and pure functions
- Write integration tests for API endpoints
- Write component tests for React components
- Aim for >80% test coverage

## Pull Request Process

1. **Before submitting:**
   - Ensure all tests pass
   - Run linting and fix any issues
   - Update documentation if needed
   - Test the full application flow

2. **Submit your PR:**
   - Use a clear, descriptive title
   - Provide detailed description of changes
   - Reference any related issues
   - Include screenshots for UI changes

3. **PR Review:**
   - Address reviewer feedback promptly
   - Keep discussions focused and respectful
   - Update tests and documentation as requested

## Code Review Guidelines

### For Reviewers
- Be constructive and specific in feedback
- Focus on code quality, security, and maintainability
- Test the changes locally if possible
- Approve when satisfied with the quality

### For Contributors
- Respond to feedback professionally
- Ask clarifying questions if feedback is unclear
- Make requested changes promptly
- Thank reviewers for their time

## Getting Help

- **Issues:** Check existing issues or create a new one
- **Discussions:** Use GitHub Discussions for questions
- **Documentation:** Refer to README.md and technical docs

## Project Structure

```
signatureSync/
├── frontend/          # React TypeScript frontend
├── backend/           # Fastify TypeScript API
├── shared/            # Shared types and utilities  
├── docs/             # Additional documentation
└── scripts/          # Development and deployment scripts
```

## Release Process

1. All changes go through PR review
2. Automated tests must pass
3. Manual testing for critical features
4. Semantic versioning for releases
5. Update CHANGELOG.md

Thank you for contributing to SignatureSync! 🚀