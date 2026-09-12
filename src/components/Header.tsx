import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAppStore } from '../store/useAppStore.ts';

export function Header() {
  const user = useAppStore((state) => state.user);
  const token = useAppStore((state) => state.token);
  const authStatus = useAppStore((state) => state.authStatus);
  const connect = useAppStore((state) => state.connect);
  const disconnect = useAppStore((state) => state.disconnect);

  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 1 }}>
        <MarkEmailReadIcon color="primary" />
        <Typography variant="h2" component="span" sx={{ mr: 'auto' }}>
          SignatureSync
        </Typography>

        {token && user ? (
          <>
            <Tooltip title={user.email}>
              <Chip
                avatar={user.picture ? <Avatar src={user.picture} alt="" /> : undefined}
                label={user.name}
                variant="outlined"
                sx={{ maxWidth: 220 }}
              />
            </Tooltip>
            <Button size="small" startIcon={<LogoutIcon />} onClick={disconnect} color="inherit">
              Disconnect
            </Button>
          </>
        ) : (
          <Box>
            <Button
              variant="contained"
              onClick={() => void connect()}
              disabled={authStatus === 'working'}
            >
              {authStatus === 'working' ? 'Connecting...' : 'Connect Google'}
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
