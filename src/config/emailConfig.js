const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: '"Blood Connect" <${process.env.SMTP_USER}>',
    to: email,
    subject: "Blood Connect - Verification Code",
    text: "Your verification code is ${otp}. It will expire in 10 minutes.",
    html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Welcome to BloodConnect!</h2>
                <p>Your One-Time Password (OTP) for registration is:</p>
                <h1 style="color: #d9534f; letter-spacing: 5px;">${otp}</h1>
                <p>This code will expire in 10 minutes. Please do not share this code with anyone.</p>
            </div>
        `,
  };
  await transporter.sendMail(mailOptions);
};
module.exports = { sendOTPEmail };
