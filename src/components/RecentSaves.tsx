import {
  Button,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useAppStore } from '../store/useAppStore.ts';

function describe(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function RecentSaves() {
  const recent = useAppStore((state) => state.recent);
  const clearRecent = useAppStore((state) => state.clearRecent);

  if (recent.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h3" sx={{ mr: 'auto' }}>
          Recently saved
        </Typography>
        <Button size="small" color="inherit" onClick={clearRecent}>
          Clear list
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Kept in this browser only. The contacts themselves are in the spreadsheet.
      </Typography>

      <List dense disablePadding>
        {recent.map((entry, index) => {
          const name = [entry.contact.firstName, entry.contact.lastName].filter(Boolean).join(' ');
          return (
            <ListItem key={`${entry.savedAt}-${index}`} disableGutters divider={index < recent.length - 1}>
              <ListItemText
                primary={name || entry.contact.email || 'Unnamed contact'}
                secondary={
                  <>
                    {[entry.contact.company, entry.contact.email].filter(Boolean).join(' · ')}
                    {' — '}
                    <Link href={entry.sheetUrl} target="_blank" rel="noopener">
                      {entry.sheetName}
                    </Link>
                    {`, ${describe(entry.savedAt)}`}
                  </>
                }
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          );
        })}
      </List>
    </Paper>
  );
}
