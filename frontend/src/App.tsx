import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Container, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        return failureCount < 3 && error?.status !== 401;
      },
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Container 
          maxWidth="md" 
          sx={{ 
            py: 4,
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Typography variant="h2" component="h1" gutterBottom>
            SignatureSync
          </Typography>
          <Typography variant="body1" color="text.secondary">
            AI-powered email signature extractor coming soon...
          </Typography>
        </Container>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;