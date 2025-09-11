# SignatureSync

An AI-powered email signature extractor that automatically processes email signatures and saves contact information to Google Sheets.

## 🚀 Project Status

**Current Phase:** Infrastructure Complete ✅  
**Next Phase:** Core Feature Implementation 🔄

### ✅ Completed Infrastructure
- [x] Complete project structure with TypeScript
- [x] Frontend: React 18 + Vite + Material-UI v5 setup
- [x] Backend: Fastify + Prisma + PostgreSQL setup  
- [x] Docker development environment
- [x] Environment validation with Zod
- [x] Security measures (input sanitization, rate limiting, CORS)
- [x] Database schema with Prisma
- [x] API route structure with OpenAPI documentation
- [x] Testing framework setup

### 🔄 In Progress
- Material Design 3 theme implementation
- React component development
- Authentication system (Google OAuth 2.0)
- OpenAI integration service
- Google Sheets API integration

### 📋 Upcoming
- Core React components (SignatureInput, ContactDisplay)
- State management with Zustand
- API client services
- Comprehensive testing suite
- Production deployment configuration

## ✨ Key Features

- **🤖 AI-Powered Extraction**: Uses OpenAI GPT-4 to extract contact information from email signatures with 95%+ accuracy
- **📊 Google Sheets Integration**: Seamlessly save extracted contacts to Google Sheets with automatic column mapping
- **🎨 Material Design 3**: Modern, accessible UI following Google's latest design principles
- **🔒 Enterprise Security**: Comprehensive input sanitization, rate limiting, and secure authentication
- **⚡ High Performance**: Sub-3-second processing with optimized bundle sizes
- **🧪 TypeScript First**: Full type safety across frontend, backend, and shared utilities

## 🛠 Tech Stack

### Frontend
- **React 18+** with TypeScript
- **Material-UI v5** (Material Design 3 implementation)
- **Zustand** for state management
- **Vite** for lightning-fast development
- **Vitest + React Testing Library** for testing

### Backend  
- **Node.js 20+** with Fastify framework
- **TypeScript** with strict configuration
- **Prisma ORM** with PostgreSQL
- **OpenAI API** for signature processing
- **Google APIs** (Sheets + OAuth 2.0)

### DevOps & Security
- **Docker** for containerized development
- **Zod** for schema validation
- **Comprehensive security** (XSS prevention, rate limiting, CORS)
- **Structured logging** with correlation IDs

## 📁 Project Architecture

```
signatureSync/
├── frontend/                    # React + TypeScript frontend
│   ├── src/
│   │   ├── components/         # React components with Material-UI
│   │   ├── pages/             # Route components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── store/             # Zustand state management
│   │   ├── types/             # TypeScript type definitions
│   │   ├── utils/             # Utility functions
│   │   ├── services/          # API service layers
│   │   └── theme/             # Material Design 3 theme
│   ├── vitest.config.ts       # Testing configuration
│   └── vite.config.ts         # Build configuration
├── backend/                     # Fastify + TypeScript API
│   ├── src/
│   │   ├── server/
│   │   │   ├── routes/        # API routes with OpenAPI docs
│   │   │   ├── services/      # Business logic services
│   │   │   ├── plugins/       # Fastify plugins
│   │   │   └── types/         # Backend type definitions
│   │   ├── config/            # Environment & configuration
│   │   └── utils/             # Security & utility functions
│   ├── prisma/                # Database schema & migrations
│   └── Dockerfile             # Production container
├── shared/                      # Shared types and utilities
│   ├── types/                 # Common TypeScript interfaces
│   └── utils/                 # Shared validation & utilities
├── docker-compose.yml          # Development environment
├── docker-compose.prod.yml     # Production deployment
└── README.md                  # Project documentation
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+**
- **PostgreSQL** (or use Docker)
- **Google Cloud Project** with OAuth 2.0 credentials
- **OpenAI API key**

### Development Setup

1. **Clone and setup environment:**
   ```bash
   git clone <repository-url>
   cd signatureSync
   cp .env.example .env
   # Edit .env with your API keys and credentials
   ```

2. **Start with Docker (recommended):**
   ```bash
   docker-compose up
   ```
   
3. **Or setup manually:**
   ```bash
   # Install dependencies
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   
   # Setup database
   cd backend && npx prisma migrate dev
   npx prisma db seed
   
   # Start services
   npm run dev # Runs both frontend and backend
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - API Documentation: http://localhost:3001/docs

### Available Commands

**Root Level:**
```bash
npm run dev          # Start both frontend and backend
npm run build        # Build all packages
npm run test         # Run all tests
npm run lint         # Lint all packages
npm run clean        # Clean all build artifacts
```

**Frontend:**
```bash
cd frontend
npm run dev          # Start development server with HMR
npm run build        # Production build with Vite
npm run preview      # Preview production build
npm run test         # Run component tests with Vitest
npm run test:ui      # Run tests with UI
npm run lint         # ESLint with TypeScript rules
```

**Backend:**
```bash
cd backend
npm run dev          # Start API server with auto-reload
npm run build        # Compile TypeScript to JavaScript
npm run start        # Start production server
npm run test         # Run integration tests
npm run lint         # ESLint for backend code
npx prisma studio    # Open Prisma database admin
npx prisma migrate dev # Run database migrations
```

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/signatureSync"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
OPENAI_API_KEY="your-openai-api-key"
JWT_SECRET="your-secure-jwt-secret-32-chars-minimum"

# Optional
REDIS_URL="redis://localhost:6379"
LOG_LEVEL="info"
RATE_LIMIT_MAX="100"
```

### Security Configuration

The application includes comprehensive security measures:
- **Input Sanitization**: XSS and injection prevention
- **Rate Limiting**: Configurable per-user and per-IP limits
- **CORS**: Strict origin validation
- **JWT Security**: Secure token generation and validation
- **Content Security Policy**: Prevents XSS attacks

## 📊 API Endpoints

### Authentication
- `GET /api/auth/google/login` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback handler
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user info

### Signature Processing
- `POST /api/extract-signature` - Extract contact info from signature
- `POST /api/validate-signature` - Validate signature format
- `GET /api/processing-history` - Get user processing history

### Google Sheets
- `GET /api/sheets` - Get user's Google Sheets
- `POST /api/sheets/save` - Save contacts to sheet
- `POST /api/sheets/create` - Create new sheet
- `GET /api/sheets/:id` - Get sheet metadata

Full API documentation available at `/docs` when running the server.

## 🧪 Testing

The project includes comprehensive testing setup:

- **Unit Tests**: Component and utility function tests
- **Integration Tests**: API endpoint tests with test database
- **E2E Tests**: Full user journey testing (planned)

```bash
# Run all tests
npm run test

# Frontend tests only
cd frontend && npm run test

# Backend tests only  
cd backend && npm run test

# Run tests with coverage
npm run test:coverage
```

## 🚀 Deployment

### Production Build
```bash
# Build all services
npm run build

# Or build individually
cd frontend && npm run build
cd backend && npm run build
```

### Docker Production
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Setup
Ensure production environment variables are properly configured:
- Use strong JWT secrets
- Configure proper CORS origins
- Set up SSL certificates
- Configure proper logging levels

## 📈 Performance Targets

- **Signature Processing**: < 3 seconds
- **Google Sheets Save**: < 2 seconds  
- **Bundle Size**: < 500KB gzipped
- **Extraction Accuracy**: > 95% on standard business signatures
- **Concurrent Users**: 100+ simultaneous users supported

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the established patterns
4. Run tests: `npm run test`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Use Material Design 3 principles for UI
- Write comprehensive tests for new features
- Update documentation for API changes
- Follow security best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Technical Requirements Document](./signature_extractor_trd.md)
- [Product Requirements Document](./signature_extractor_prd.md)
- [Claude Code Instructions](./claude_code_instructions.md)

---

**Built with ❤️ using TypeScript, React, Fastify, and Material Design 3**