import { Box, Chip, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { CONTACT_FIELDS, FIELD_LABELS } from '../types/index.ts';
import type { ContactField, ExtractionSource } from '../types/index.ts';
import { useAppStore } from '../store/useAppStore.ts';

const FULL_WIDTH_FIELDS: ContactField[] = ['address'];

const ORIGIN_LABEL: Record<ExtractionSource, string> = {
  heuristic: 'Matched directly in the text',
  ai: 'Interpreted by the AI model',
  hybrid: 'AI reading, differs from the direct match',
};

function confidenceChip(score: number | undefined, origin: ExtractionSource | undefined) {
  if (score === undefined) return null;

  const percentage = Math.round(score * 100);
  const color = score >= 0.85 ? 'success' : score >= 0.6 ? 'warning' : 'error';
  const title = origin ? `${ORIGIN_LABEL[origin]}. Confidence ${percentage}%.` : `Confidence ${percentage}%`;

  return (
    <Tooltip title={title}>
      <Chip size="small" variant="outlined" color={color} label={`${percentage}%`} />
    </Tooltip>
  );
}

export function ContactFields() {
  const result = useAppStore((state) => state.result);
  const updateField = useAppStore((state) => state.updateField);
  const extractStatus = useAppStore((state) => state.extractStatus);

  const hasAnything = CONTACT_FIELDS.some((field) => result.contact[field]);
  const lowConfidence = CONTACT_FIELDS.filter((field) => {
    const score = result.confidence[field];
    return score !== undefined && score < 0.6;
  });

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="h3">2. Check the details</Typography>
        {result.source === 'hybrid' && <Chip size="small" label="AI assisted" color="primary" variant="outlined" />}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {hasAnything
          ? 'Everything here is editable. Percentages show how sure the extraction is, and disappear once you edit a field.'
          : 'Extract a signature and the fields will appear here for checking.'}
      </Typography>

      {lowConfidence.length > 0 && (
        <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
          Worth a look before saving: {lowConfidence.map((field) => FIELD_LABELS[field].toLowerCase()).join(', ')}.
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
        {CONTACT_FIELDS.map((field) => (
          <TextField
            key={field}
            label={FIELD_LABELS[field]}
            value={result.contact[field]}
            onChange={(event) => updateField(field, event.target.value)}
            disabled={extractStatus === 'working'}
            fullWidth
            multiline={field === 'address'}
            minRows={field === 'address' ? 2 : undefined}
            sx={{ gridColumn: FULL_WIDTH_FIELDS.includes(field) ? { sm: 'span 2' } : undefined }}
            InputProps={{
              endAdornment: confidenceChip(result.confidence[field], result.origin[field]),
              // Keep the chip level with the first line of a multiline field
              // rather than floating in the vertical middle of the box.
              sx:
                field === 'address'
                  ? { alignItems: 'flex-start', '& .MuiChip-root': { mt: 0.75 } }
                  : undefined,
            }}
          />
        ))}
      </Box>
    </Paper>
  );
}
