import { Alert, AlertTitle, Box, Container, Link, Paper, Typography } from '@mui/material';

const STEPS = [
  'Create a project in the Google Cloud Console and enable the Google Sheets API, the Google Drive API and the Google Picker API.',
  'Under APIs and services, configure the OAuth consent screen and add the drive.file, userinfo.email and userinfo.profile scopes.',
  'Create an OAuth 2.0 Client ID of type "Web application", and add your site origin (and http://localhost:3000 for development) as an authorised JavaScript origin.',
  'Create an API key and restrict it to the Picker API and to your site.',
  'Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY in your Netlify site environment, then redeploy.',
];

export function SetupNotice() {
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h1" gutterBottom>
          SignatureSync
        </Typography>

        <Alert severity="info" sx={{ my: 2 }}>
          <AlertTitle>Not configured yet</AlertTitle>
          This build has no Google client ID, so it cannot talk to Google Sheets.
        </Alert>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Five steps to get it running:
        </Typography>

        <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 1 } }}>
          {STEPS.map((step) => (
            <Typography key={step} component="li" variant="body2">
              {step}
            </Typography>
          ))}
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Full detail is in the{' '}
          <Link href="https://github.com/Behappierre/signatureSync#setup" target="_blank" rel="noopener">
            README
          </Link>
          .
        </Typography>
      </Paper>
    </Container>
  );
}
