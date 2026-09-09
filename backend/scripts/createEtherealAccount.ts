import nodemailer from 'nodemailer';

async function generateEtherealAccount() {
  console.log('⏳ Generating Ethereal SMTP test account credentials...');
  try {
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

generateEtherealAccount();
