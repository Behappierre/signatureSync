import { createTheme } from '@mui/material/styles';

const SYSTEM_FONT = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(',');

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1a5f7a', light: '#4a8ba5', dark: '#0d3d52', contrastText: '#ffffff' },
    secondary: { main: '#c05621', light: '#dd8552', dark: '#8a3a12' },
    success: { main: '#2f7d4f' },
    warning: { main: '#b7791f' },
    error: { main: '#b42318' },
    background: { default: '#f6f7f9', paper: '#ffffff' },
    text: { primary: '#16212b', secondary: '#5a6b78' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: SYSTEM_FONT,
    h1: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.25rem', fontWeight: 600 },
    h3: { fontSize: '1.05rem', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    body2: { lineHeight: 1.6 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: '#e2e6ea' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
  },
});
