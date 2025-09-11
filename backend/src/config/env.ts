import { z } from 'zod';

const EnvSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),

  // Authentication & Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'Google Client ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'Google Client Secret is required'),

  // External Services
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  
  // Optional services
  REDIS_URL: z.string().url().optional(),
  
  // Rate limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
});

export type Env = z.infer<typeof EnvSchema>;

let env: Env;

try {
  env = EnvSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:');
  if (error instanceof z.ZodError) {
    error.errors.forEach((err) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
  }
  process.exit(1);
}

// Validate environment-specific requirements
if (env.NODE_ENV === 'production') {
  const productionRequiredVars = [
    'JWT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'OPENAI_API_KEY',
    'DATABASE_URL'
  ];

  const missingVars = productionRequiredVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables for production:');
    missingVars.forEach(varName => {
      console.error(`  ${varName}`);
    });
    process.exit(1);
  }

  // Validate JWT secret strength in production
  if (env.JWT_SECRET === 'dev-jwt-secret-change-in-production') {
    console.error('❌ Default JWT secret detected in production. Please set a secure JWT_SECRET.');
    process.exit(1);
  }
}

export { env };