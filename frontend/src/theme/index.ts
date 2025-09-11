import { createTheme, ThemeOptions } from '@mui/material/styles';
import { PaletteOptions } from '@mui/material/styles/createPalette';

// Material Design 3 Color Tokens
const materialTokens = {
  primary: {
    main: '#6750A4',
    light: '#9A82DB',
    dark: '#4F378B',
    contrastText: '#FFFFFF',
  },
  secondary: {
    main: '#625B71',
    light: '#8B83A0',
    dark: '#4A4458',
    contrastText: '#FFFFFF',
  },
  surface: {
    main: '#FEF7FF',
    variant: '#E7E0EC',
    container: '#F3EDF7',
  },
  outline: {
    main: '#79747E',
    variant: '#CAC4D0',
  },
} as const;

const paletteOptions: PaletteOptions = {
  mode: 'light',
  primary: materialTokens.primary,
  secondary: materialTokens.secondary,
  background: {
    default: materialTokens.surface.main,
    paper: '#FFFFFF',
  },
  divider: materialTokens.outline.variant,
};

const themeOptions: ThemeOptions = {
  palette: paletteOptions,
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // Material Design 3 Typography Scale
    h1: {
      fontSize: '57px',
      lineHeight: '64px',
      fontWeight: 400,
    },
    h2: {
      fontSize: '45px',
      lineHeight: '52px',
      fontWeight: 400,
    },
    h3: {
      fontSize: '36px',
      lineHeight: '44px',
      fontWeight: 400,
    },
    h4: {
      fontSize: '32px',
      lineHeight: '40px',
      fontWeight: 400,
    },
    h5: {
      fontSize: '28px',
      lineHeight: '36px',
      fontWeight: 400,
    },
    h6: {
      fontSize: '24px',
      lineHeight: '32px',
      fontWeight: 400,
    },
    subtitle1: {
      fontSize: '22px',
      lineHeight: '28px',
      fontWeight: 400,
    },
    subtitle2: {
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: 500,
    },
    body1: {
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: 400,
    },
    body2: {
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 400,
    },
    caption: {
      fontSize: '12px',
      lineHeight: '16px',
      fontWeight: 400,
    },
    overline: {
      fontSize: '11px',
      lineHeight: '16px',
      fontWeight: 500,
    },
    button: {
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 500,
      textTransform: 'none' as const,
    },
  },
  shape: {
    borderRadius: 12, // Material Design 3 rounded corners
  },
  components: {
    // Material Design 3 Component Customizations
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '20px',
          textTransform: 'none',
          fontWeight: 500,
        },
        containedPrimary: {
          backgroundColor: materialTokens.primary.main,
          '&:hover': {
            backgroundColor: materialTokens.primary.dark,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
          },
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);