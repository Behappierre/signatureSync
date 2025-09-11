import { google } from 'googleapis';
import { PrismaClient } from '@prisma/client';
import { ContactInfo, GoogleSheet } from '@shared/types/index.js';
import { AuthService } from './authService.js';

export interface SheetColumn {
  name: string;
  type: string;
}

export interface SheetMetadata {
  id: string;
  name: string;
  url: string;
  columns: SheetColumn[];
  rowCount: number;
}

export class GoogleSheetsService {
  private prisma: PrismaClient;
  private authService: AuthService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.authService = new AuthService(prisma);
  }

  /**
   * Get authenticated Google Sheets client for user
   */
  private async getAuthenticatedSheetsClient(userId: string) {
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if tokens are valid, refresh if needed
    const hasValidTokens = await this.authService.hasValidGoogleTokens(userId);
    if (!hasValidTokens) {
      throw new Error('Invalid or expired Google tokens');
    }

    // Get fresh user data (tokens might have been refreshed)
    const updatedUser = await this.authService.getUserById(userId);
    if (!updatedUser) {
      throw new Error('Failed to get updated user tokens');
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: updatedUser.googleAccessToken,
      refresh_token: updatedUser.googleRefreshToken,
    });

    return google.sheets({ version: 'v4', auth });
  }

  /**
   * Get user's Google Sheets
   */
  async getUserSheets(userId: string): Promise<GoogleSheet[]> {
    try {
      // Get authenticated client
      const sheets = await this.getAuthenticatedSheetsClient(userId);
      const auth = sheets.auth as any;

      // Use Google Drive API to list spreadsheets
      const drive = google.drive({ version: 'v3', auth });
      
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: 'files(id,name,modifiedTime,webViewLink)',
        orderBy: 'modifiedTime desc',
        pageSize: 50,
      });

      const files = response.data.files || [];
      
      // Convert to GoogleSheet format
      const userSheets: GoogleSheet[] = files.map(file => ({
        id: file.id!,
        name: file.name!,
        url: file.webViewLink!,
        lastModified: new Date(file.modifiedTime!),
      }));

      // Update cached sheets in database
      for (const sheet of userSheets) {
        await this.prisma.sheet.upsert({
          where: { id: sheet.id },
          update: {
            name: sheet.name,
            url: sheet.url,
            lastSynced: new Date(),
            updatedAt: new Date(),
          },
          create: {
            id: sheet.id,
            name: sheet.name,
            url: sheet.url,
            userId,
            lastSynced: new Date(),
          },
        });
      }

      return userSheets;
    } catch (error) {
      throw new Error(`Failed to fetch user sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sheet metadata including columns and row count
   */
  async getSheetMetadata(userId: string, sheetId: string): Promise<SheetMetadata> {
    try {
      const sheets = await this.getAuthenticatedSheetsClient(userId);

      // Get spreadsheet metadata
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
      });

      const sheet = spreadsheet.data.sheets?.[0];
      if (!sheet) {
        throw new Error('No sheets found in spreadsheet');
      }

      // Get first few rows to analyze column structure
      const valuesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A1:Z10', // Get first 10 rows, columns A-Z
      });

      const values = valuesResponse.data.values || [];
      const headerRow = values[0] || [];
      
      // Determine columns based on header row or create default
      const columns: SheetColumn[] = headerRow.length > 0 
        ? headerRow.map((header, index) => ({
            name: String(header || `Column ${index + 1}`),
            type: this.inferColumnType(values, index),
          }))
        : [
            { name: 'First Name', type: 'string' },
            { name: 'Last Name', type: 'string' },
            { name: 'Company', type: 'string' },
            { name: 'Email', type: 'email' },
            { name: 'Phone', type: 'phone' },
            { name: 'Title', type: 'string' },
            { name: 'Website', type: 'url' },
            { name: 'LinkedIn', type: 'url' },
            { name: 'Address', type: 'string' },
            { name: 'Date Added', type: 'date' },
          ];

      const rowCount = sheet.properties?.gridProperties?.rowCount || values.length;

      return {
        id: sheetId,
        name: spreadsheet.data.properties?.title || 'Untitled',
        url: `https://docs.google.com/spreadsheets/d/${sheetId}`,
        columns,
        rowCount,
      };
    } catch (error) {
      throw new Error(`Failed to get sheet metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save contacts to Google Sheet
   */
  async saveContactsToSheet(
    userId: string, 
    sheetId: string, 
    contacts: ContactInfo[]
  ): Promise<{
    savedCount: number;
    errors: string[];
  }> {
    try {
      const sheets = await this.getAuthenticatedSheetsClient(userId);
      const errors: string[] = [];
      let savedCount = 0;

      // Get sheet metadata to understand structure
      const metadata = await this.getSheetMetadata(userId, sheetId);
      
      // Check if sheet has headers, if not create them
      const hasHeaders = await this.ensureHeaders(sheets, sheetId, metadata);

      // Prepare data rows
      const rows: any[][] = [];
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        try {
          const row = this.mapContactToRow(contact, metadata.columns);
          rows.push(row);
        } catch (error) {
          errors.push(`Contact ${i + 1}: ${error instanceof Error ? error.message : 'Mapping error'}`);
        }
      }

      if (rows.length === 0) {
        throw new Error('No valid contacts to save');
      }

      // Find the next empty row
      const valuesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A:A',
      });

      const existingRows = valuesResponse.data.values?.length || 0;
      const nextRow = Math.max(existingRows + 1, hasHeaders ? 2 : 1);

      // Append contacts to sheet
      const range = `A${nextRow}:${String.fromCharCode(65 + metadata.columns.length - 1)}${nextRow + rows.length - 1}`;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows,
        },
      });

      savedCount = rows.length;

      // Save contacts to database
      for (const contact of contacts) {
        await this.prisma.contact.create({
          data: {
            firstName: contact.firstName,
            lastName: contact.lastName,
            company: contact.company,
            email: contact.email,
            phone: contact.phone,
            title: contact.title,
            website: contact.website,
            linkedin: contact.linkedin,
            address: contact.address,
            additionalInfo: contact.additionalInfo,
            confidence: contact.confidence.overall,
            sheetId,
            userId,
          },
        });
      }

      return { savedCount, errors };
    } catch (error) {
      throw new Error(`Failed to save contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new Google Sheet
   */
  async createSheet(userId: string, name: string): Promise<GoogleSheet> {
    try {
      const sheets = await this.getAuthenticatedSheetsClient(userId);

      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: name,
          },
          sheets: [{
            properties: {
              title: 'Contacts',
            },
          }],
        },
      });

      const spreadsheet = response.data;
      if (!spreadsheet.spreadsheetId) {
        throw new Error('Failed to get created spreadsheet ID');
      }

      // Add headers to the new sheet
      const headers = [
        'First Name', 'Last Name', 'Company', 'Email', 'Phone',
        'Title', 'Website', 'LinkedIn', 'Address', 'Date Added'
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheet.spreadsheetId,
        range: 'A1:J1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers],
        },
      });

      // Format headers (bold)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: spreadsheet.spreadsheetId,
        requestBody: {
          requests: [{
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          }],
        },
      });

      const newSheet: GoogleSheet = {
        id: spreadsheet.spreadsheetId,
        name: name,
        url: spreadsheet.spreadsheetUrl!,
        lastModified: new Date(),
      };

      // Cache in database
      await this.prisma.sheet.create({
        data: {
          id: newSheet.id,
          name: newSheet.name,
          url: newSheet.url,
          userId,
          lastSynced: new Date(),
        },
      });

      return newSheet;
    } catch (error) {
      throw new Error(`Failed to create sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure sheet has proper headers
   */
  private async ensureHeaders(sheets: any, sheetId: string, metadata: SheetMetadata): Promise<boolean> {
    try {
      // Check if first row has data (headers)
      const firstRowResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A1:Z1',
      });

      const firstRow = firstRowResponse.data.values?.[0] || [];
      
      // If no headers or very few columns, add default headers
      if (firstRow.length < 4) {
        const headers = [
          'First Name', 'Last Name', 'Company', 'Email', 'Phone',
          'Title', 'Website', 'LinkedIn', 'Address', 'Date Added'
        ];

        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: 'A1:J1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [headers],
          },
        });

        return true;
      }

      return firstRow.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Map contact to sheet row based on column structure
   */
  private mapContactToRow(contact: ContactInfo, columns: SheetColumn[]): any[] {
    const row: any[] = new Array(columns.length).fill('');

    columns.forEach((column, index) => {
      const columnName = column.name.toLowerCase();
      
      if (columnName.includes('first') && columnName.includes('name')) {
        row[index] = contact.firstName || '';
      } else if (columnName.includes('last') && columnName.includes('name')) {
        row[index] = contact.lastName || '';
      } else if (columnName.includes('company')) {
        row[index] = contact.company || '';
      } else if (columnName.includes('email')) {
        row[index] = contact.email || '';
      } else if (columnName.includes('phone')) {
        row[index] = contact.phone || '';
      } else if (columnName.includes('title') || columnName.includes('position')) {
        row[index] = contact.title || '';
      } else if (columnName.includes('website')) {
        row[index] = contact.website || '';
      } else if (columnName.includes('linkedin')) {
        row[index] = contact.linkedin || '';
      } else if (columnName.includes('address')) {
        row[index] = contact.address || '';
      } else if (columnName.includes('date')) {
        row[index] = new Date().toLocaleDateString();
      }
    });

    return row;
  }

  /**
   * Infer column type from sample data
   */
  private inferColumnType(values: any[][], columnIndex: number): string {
    const samples = values.slice(1, 6).map(row => row[columnIndex]).filter(val => val);
    
    if (samples.length === 0) return 'string';

    // Check for email pattern
    if (samples.some(val => /\S+@\S+\.\S+/.test(val))) {
      return 'email';
    }

    // Check for phone pattern
    if (samples.some(val => /[\d\s\-\(\)\+]{7,}/.test(val))) {
      return 'phone';
    }

    // Check for URL pattern
    if (samples.some(val => /https?:\/\//.test(val))) {
      return 'url';
    }

    // Check for date pattern
    if (samples.some(val => !isNaN(Date.parse(val)))) {
      return 'date';
    }

    return 'string';
  }
}