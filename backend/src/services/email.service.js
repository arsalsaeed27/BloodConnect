const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail(toEmail, otpCode, purpose) {
  let subject;
  let intro;

  if (purpose === 'registration') {
    subject = 'Verify your Blood Connect account';
    intro = 'Use the code below to verify your account and complete your registration.';
  } else if (purpose === 'forgot_password') {
    subject = 'Blood Connect password reset';
    intro = 'Use the code below to reset your password.';
  } else {
    throw new Error(`Unknown OTP purpose: ${purpose}`);
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Blood Connect</h2>
      <p>${intro}</p>
      <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 24px 0;">
        ${otpCode}
      </p>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: toEmail,
    subject,
    html,
  });
}

async function sendDonationNotificationEmail(adminEmails, donorName, donorBloodGroup) {
  const subject = `Donation recorded — ${donorBloodGroup} donor`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Blood Connect</h2>
      <p><strong>${donorName}</strong> (blood group <strong>${donorBloodGroup}</strong>) has just recorded a blood donation.</p>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: adminEmails,
    subject,
    html,
  });
}

module.exports = { sendOtpEmail, sendDonationNotificationEmail };
