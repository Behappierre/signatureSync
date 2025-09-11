import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock API endpoints for testing
  http.post('/api/extract-signature', () => {
    return HttpResponse.json({
      contactInfo: {
        firstName: 'John',
        lastName: 'Doe',
        company: 'Acme Corp',
        email: 'john.doe@acme.com',
        phone: '+1 555-123-4567',
        title: 'Software Engineer',
      },
      confidence: 0.95,
    });
  }),

  http.get('/api/sheets', () => {
    return HttpResponse.json({
      sheets: [
        {
          id: 'sheet1',
          name: 'Contacts',
          url: 'https://docs.google.com/spreadsheets/d/sheet1',
          lastModified: new Date().toISOString(),
        },
      ],
    });
  }),

  http.post('/api/save-to-sheet', () => {
    return HttpResponse.json({
      savedCount: 1,
      errors: [],
    });
  }),
];

export const server = setupServer(...handlers);