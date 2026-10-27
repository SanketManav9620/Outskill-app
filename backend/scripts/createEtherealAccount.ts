import nodemailer from 'nodemailer';

/**
 * ============================================================================
 * ETHEREAL SMTP SANDBOX ACCOUNT GENERATOR SCRIPT (createEtherealAccount.ts)
 * ============================================================================
 * WHAT THIS SCRIPT DOES:
 * - Automatically contacts the Ethereal Mail API to generate a temporary test SMTP inbox.
 * - Prints the generated credentials (host, port, user, pass) and the webmail portal URL.
 * 
 * WHEN TO RUN:
 * Run `npm run create-ethereal` during initial workspace setup to populate `.env`.
 */
async function generateEtherealAccount() {
  console.log('⏳ Generating Ethereal SMTP test account credentials...');
  try {
    // 1. Request test account creation from Nodemailer Ethereal sandbox service
    const testAccount = await nodemailer.createTestAccount();

    console.log('\n==================================================');
    console.log('🎉 ETHEREAL SMTP TEST ACCOUNT CREATED SUCCESSFULLY');
    console.log('==================================================');
    console.log(`ETHEREAL_HOST=${testAccount.smtp.host}`);
    console.log(`ETHEREAL_PORT=${testAccount.smtp.port}`);
    console.log(`ETHEREAL_USER=${testAccount.user}`);
    console.log(`ETHEREAL_PASS=${testAccount.pass}`);
    console.log('==================================================');
    console.log(`Ethereal Web Portal: ${testAccount.web || 'https://ethereal.email'}`);
    console.log('==================================================\n');
  } catch (error) {
    console.error('❌ Failed to generate Ethereal test account:', error);
    process.exit(1);
  }
}

// Execute script immediately
generateEtherealAccount();

