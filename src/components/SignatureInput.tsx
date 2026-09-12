import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import ClearIcon from '@mui/icons-material/Clear';
import { useAppStore } from '../store/useAppStore.ts';

const SAMPLE = `Kind regards,

Olivier André
Partner, Transportation & Infrastructure
Netcompany UK Ltd
M: +44 7700 900123 | T: +44 20 7946 0000
olivier.andre@netcompany.com
www.netcompany.com
linkedin.com/in/olivierandre
1 Finsbury Avenue, London EC2M 2PF`;

export function SignatureInput() {
  const rawText = useAppStore((state) => state.rawText);
  const setRawText = useAppStore((state) => state.setRawText);
  const extract = useAppStore((state) => state.extract);
  const reset = useAppStore((state) => state.reset);
  const extractStatus = useAppStore((state) => state.extractStatus);
  const notify = useAppStore((state) => state.notify);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setRawText(text);
    } catch {
      notify({
        message: 'Your browser would not share the clipboard. Paste into the box instead.',
        severity: 'info',
      });
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h3" gutterBottom>
        1. Paste the signature
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Paste the whole sign-off. Disclaimers and footers are ignored.
      </Typography>

      <TextField
        multiline
        minRows={8}
        maxRows={18}
        fullWidth
        value={rawText}
        onChange={(event) => setRawText(event.target.value)}
        placeholder={'Jane Smith\nHead of Operations\nExample Rail Ltd\n+44 7700 900000\njane.smith@example.com'}
        inputProps={{ 'aria-label': 'Email signature text', spellCheck: false }}
        sx={{ '& textarea': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 } }}
      />

      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={<AutoFixHighIcon />}
          onClick={() => void extract()}
          disabled={extractStatus === 'working' || rawText.trim().length === 0}
        >
          {extractStatus === 'working' ? 'Extracting...' : 'Extract contact'}
        </Button>
        <Button startIcon={<ContentPasteIcon />} onClick={() => void pasteFromClipboard()}>
          Paste
        </Button>
        <Box sx={{ flex: 1 }} />
        {rawText.length > 0 && (
          <Button startIcon={<ClearIcon />} color="inherit" onClick={reset}>
            Clear
          </Button>
        )}
        {rawText.length === 0 && (
          <Button color="inherit" onClick={() => setRawText(SAMPLE)}>
            Try an example
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
