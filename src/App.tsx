import { useEffect } from 'react';
import { Alert, Box, Container, Link, Snackbar, Stack, Typography } from '@mui/material';
import { Header } from './components/Header.tsx';
import { SignatureInput } from './components/SignatureInput.tsx';
import { ContactFields } from './components/ContactFields.tsx';
import { SheetPanel } from './components/SheetPanel.tsx';
import { RecentSaves } from './components/RecentSaves.tsx';
import { SetupNotice } from './components/SetupNotice.tsx';
import { isConfigured } from './lib/config.ts';
import { useAppStore } from './store/useAppStore.ts';

export default function App() {
  const init = useAppStore((state) => state.init);
  const notice = useAppStore((state) => state.notify);
  const current = useAppStore((state) => state.notice);

  useEffect(() => {
    if (isConfigured()) void init();
  }, [init]);

  if (!isConfigured()) return <SetupNotice />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />

      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 4 } }}>
        <Typography variant="h1" gutterBottom>
          Turn a signature into a row
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 620 }}>
          Paste an email sign-off, check what comes out, and append it to a Google Sheet. Your
          contacts never leave your Google account, and nothing is stored by this site.
        </Typography>

        <Stack spacing={2.5}>
          <SignatureInput />
          <ContactFields />
          <SheetPanel />
          <RecentSaves />
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 4, textAlign: 'center' }}>
          <Link href="https://github.com/Behappierre/signatureSync" target="_blank" rel="noopener">
            SignatureSync
          </Link>{' '}
          runs as a static site with one serverless function. No database, no server.
        </Typography>
      </Container>

      <Snackbar
        open={Boolean(current)}
        autoHideDuration={6000}
        onClose={() => notice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={current?.severity ?? 'info'}
          onClose={() => notice(null)}
          variant="filled"
          sx={{ maxWidth: 520 }}
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
