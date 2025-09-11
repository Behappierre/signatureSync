import { z } from 'zod';

const EnvSchema = z.object({
  MODE: z.enum(['development', 'production', 'test']).default('development'),
  PROD: z.boolean().default(false),
  DEV: z.boolean().default(true),
  
  // API Configuration
  VITE_API_URL: z.string().url().default('http://localhost:3001'),
  
  // Feature flags
  VITE_ENABLE_DEBUG: z.string().transform(val => val === 'true').default('false'),
  VITE_ENABLE_MSW: z.string().transform(val => val === 'true').default('false'),
});

export type ClientEnv = z.infer<typeof EnvSchema>;

let env: ClientEnv;

try {
  env = EnvSchema.parse({
    MODE: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_ENABLE_DEBUG: import.meta.env.VITE_ENABLE_DEBUG,
    VITE_ENABLE_MSW: import.meta.env.VITE_ENABLE_MSW,
  });
} catch (error) {
  console.error('❌ Invalid environment variables:');
  if (error instanceof z.ZodError) {
    error.errors.forEach((err) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
  }
  throw new Error('Environment validation failed');
}

// Environment-specific validation
if (env.PROD && env.VITE_API_URL.includes('localhost')) {
  console.warn('⚠️  Production build is using localhost API URL');
}

// Export validated environment
export { env };

// Utility functions
export const isDevelopment = () => env.MODE === 'development';
export const isProduction = () => env.MODE === 'production';
export const isTest = () => env.MODE === 'test';
export const getApiUrl = () => env.VITE_API_URL;