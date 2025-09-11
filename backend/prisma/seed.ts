import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@signatureSync.com' },
    update: {},
    create: {
      email: 'test@signatureSync.com',
      name: 'Test User',
      picture: 'https://via.placeholder.com/150',
      googleAccessToken: 'test-access-token',
      googleRefreshToken: 'test-refresh-token',
    },
  });

  console.log(`✅ Created test user: ${testUser.email}`);

  // Create some sample contacts
  const sampleContacts = [
    {
      firstName: 'John',
      lastName: 'Doe',
      company: 'Acme Corp',
      email: 'john.doe@acme.com',
      phone: '+1 555-123-4567',
      title: 'Software Engineer',
      website: 'https://johndoe.dev',
      linkedin: 'https://linkedin.com/in/johndoe',
      address: '123 Main St, San Francisco, CA 94105',
      confidence: 0.95,
      sheetId: 'sheet-123',
      userId: testUser.id,
    },
    {
      firstName: 'Jane',
      lastName: 'Smith',
      company: 'TechStart Inc',
      email: 'jane.smith@techstart.com',
      phone: '+1 555-987-6543',
      title: 'Product Manager',
      website: 'https://techstart.com',
      confidence: 0.88,
      sheetId: 'sheet-123',
      userId: testUser.id,
    },
    {
      firstName: 'Robert',
      lastName: 'Johnson',
      company: 'Design Studio',
      email: 'robert@designstudio.co',
      phone: '+1 555-456-7890',
      title: 'Creative Director',
      confidence: 0.92,
      sheetId: 'sheet-456',
      userId: testUser.id,
    },
  ];

  for (const contact of sampleContacts) {
    const createdContact = await prisma.contact.upsert({
      where: { 
        id: `${contact.firstName.toLowerCase()}-${contact.lastName.toLowerCase()}-${testUser.id}`
      },
      update: {},
      create: contact,
    });
    console.log(`✅ Created sample contact: ${createdContact.firstName} ${createdContact.lastName}`);
  }

  // Create some sample processing logs
  const sampleLogs = [
    {
      userId: testUser.id,
      rawSignature: 'John Doe\nSoftware Engineer\nAcme Corp\njohn.doe@acme.com\n+1 555-123-4567',
      success: true,
      processingTime: 2500,
      extractedData: {
        firstName: 'John',
        lastName: 'Doe',
        company: 'Acme Corp',
        email: 'john.doe@acme.com',
        phone: '+1 555-123-4567',
        title: 'Software Engineer',
      },
      confidence: 0.95,
    },
    {
      userId: testUser.id,
      rawSignature: 'Jane Smith\nProduct Manager\nTechStart Inc\njane.smith@techstart.com',
      success: true,
      processingTime: 1800,
      extractedData: {
        firstName: 'Jane',
        lastName: 'Smith',
        company: 'TechStart Inc',
        email: 'jane.smith@techstart.com',
        title: 'Product Manager',
      },
      confidence: 0.88,
    },
    {
      userId: testUser.id,
      rawSignature: 'Invalid signature with no contact info',
      success: false,
      error: 'Could not extract sufficient contact information',
      processingTime: 1200,
    },
  ];

  for (const log of sampleLogs) {
    const createdLog = await prisma.processingLog.create({
      data: log,
    });
    console.log(`✅ Created processing log: ${createdLog.id} (success: ${createdLog.success})`);
  }

  // Create sample sheets
  const sampleSheets = [
    {
      id: 'sheet-123',
      name: 'Business Contacts',
      url: 'https://docs.google.com/spreadsheets/d/sheet-123',
      userId: testUser.id,
    },
    {
      id: 'sheet-456',
      name: 'Design Network',
      url: 'https://docs.google.com/spreadsheets/d/sheet-456',
      userId: testUser.id,
    },
  ];

  for (const sheet of sampleSheets) {
    const createdSheet = await prisma.sheet.upsert({
      where: { id: sheet.id },
      update: {},
      create: sheet,
    });
    console.log(`✅ Created sample sheet: ${createdSheet.name}`);
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });