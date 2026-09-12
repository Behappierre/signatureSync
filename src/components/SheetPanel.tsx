import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SaveIcon from '@mui/icons-material/Save';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { canUsePicker } from '../lib/config.ts';
import { useAppStore } from '../store/useAppStore.ts';

export function SheetPanel() {
  const token = useAppStore((state) => state.token);
  const sheetList = useAppStore((state) => state.sheetList);
  const activeSheetId = useAppStore((state) => state.activeSheetId);
  const setActiveSheet = useAppStore((state) => state.setActiveSheet);
  const forgetSheet = useAppStore((state) => state.forgetSheet);
  const chooseSheet = useAppStore((state) => state.chooseSheet);
  const createSheet = useAppStore((state) => state.createSheet);
  const save = useAppStore((state) => state.save);
  const saveStatus = useAppStore((state) => state.saveStatus);
  const result = useAppStore((state) => state.result);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Contacts from signatures');

  const activeSheet = sheetList.find((sheet) => sheet.id === activeSheetId);
  const hasContact = Boolean(result.contact.email || result.contact.lastName);

  const handleCreate = async () => {
    setDialogOpen(false);
    await createSheet(newTitle.trim() || 'Contacts from signatures');
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Typography variant="h3" gutterBottom>
        3. Save to Google Sheets
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The spreadsheet is the database. Contacts are appended as rows, matched to whatever column
        headings the sheet already uses.
      </Typography>

      {!token && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Connect Google above to choose a sheet.
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button
          startIcon={<FolderOpenIcon />}
          onClick={() => void chooseSheet()}
          disabled={!token || !canUsePicker()}
        >
          Choose from Drive
        </Button>
        <Button startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} disabled={!token}>
          New sheet
        </Button>
      </Stack>

      {sheetList.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <TextField
            select
            label="Save into"
            value={activeSheetId}
            onChange={(event) => setActiveSheet(event.target.value)}
            fullWidth
          >
            {sheetList.map((sheet) => (
              <MenuItem key={sheet.id} value={sheet.id}>
                {sheet.name}
              </MenuItem>
            ))}
          </TextField>

          {activeSheet && (
            <>
              <Tooltip title="Open in Google Sheets">
                <IconButton component={Link} href={activeSheet.url} target="_blank" rel="noopener">
                  <OpenInNewIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove from this list. The sheet itself is untouched.">
                <IconButton onClick={() => forgetSheet(activeSheet.id)}>
                  <LinkOffIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Stack>
      )}

      <Button
        variant="contained"
        size="large"
        fullWidth
        startIcon={<SaveIcon />}
        onClick={() => void save()}
        disabled={!token || !activeSheetId || !hasContact || saveStatus === 'working'}
      >
        {saveStatus === 'working' ? 'Saving...' : 'Save contact to sheet'}
      </Button>

      {!canUsePicker() && token && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Set VITE_GOOGLE_API_KEY to pick an existing spreadsheet from Drive. Creating a new sheet
          works without it.
        </Typography>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New spreadsheet</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Name"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Created in your Google Drive with a Contacts tab and a header row.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleCreate()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
