export const PASSWORD_RESET_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Arial', sans-serif;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: #4F46E5;
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 40px 30px;
    }
    .content p {
      color: #555;
      font-size: 15px;
      line-height: 1.6;
      margin: 10px 0;
    }
    .otp-box {
      background: #f8f9ff;
      border: 2px solid #4F46E5;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
    }
    .otp-code {
      font-size: 36px;
      font-weight: bold;
      color: #4F46E5;
      letter-spacing: 5px;
      margin: 10px 0;
    }
    .expiry {
      color: #e74c3c;
      font-size: 14px;
      margin-top: 10px;
    }
    .warning {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px 15px;
      margin: 20px 0;
      font-size: 14px;
      color: #856404;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #888;
      font-size: 13px;
      border-top: 1px solid #e0e0e0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Reset</h1>
    </div>
    
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset your password for <strong>{{email}}</strong></p>
      
      <div class="otp-box">
        <div style="font-size: 14px; color: #666; margin-bottom: 10px;">Your OTP Code</div>
        <div class="otp-code">{{otp}}</div>
        <div class="expiry">⏱️ Valid for 2 minutes only</div>
      </div>
      
      <div class="warning">
        <strong>⚠️ Security Alert:</strong> If you didn't request this, please ignore this email.
      </div>
      
      <p style="color: #888; font-size: 13px;">This is an automated message, please do not reply.</p>
    </div>
    
    <div class="footer">
      © {{FOOTER_YEAR}} {{FOOTER_BRAND}}. All rights reserved.<br>
      Need help? Contact marqum987@gmail.com
    </div>
  </div>
</body>
</html>
`;

export const APPOINTMENT_BOOKING_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #0d9488; color: white; padding: 28px; text-align: center; }
    .content { padding: 32px 28px; color: #555; line-height: 1.6; }
    .footer { background: #f8f9fa; padding: 16px; text-align: center; color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Appointment confirmed</h1></div>
    <div class="content">
      <p>Hello <strong>{{patientName}}</strong>,</p>
      <p>Your appointment with <strong>Dr. {{doctorName}}</strong> is confirmed for <strong>{{when}}</strong>.</p>
      <p>Reservation: <strong>{{reservationNumber}}</strong></p>
      <p>Please find your booking details attached as a PDF. Keep it for your records and present it at the clinic if asked.</p>
    </div>
    <div class="footer">© {{FOOTER_YEAR}} {{FOOTER_BRAND}}</div>
  </div>
</body>
</html>
`;

export const APPOINTMENT_INVOICE_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #4F46E5; color: white; padding: 28px; text-align: center; }
    .content { padding: 32px 28px; color: #555; line-height: 1.6; }
    .footer { background: #f8f9fa; padding: 16px; text-align: center; color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Payment received</h1></div>
    <div class="content">
      <p>Hello <strong>{{patientName}}</strong>,</p>
      <p>We have recorded payment for your visit with <strong>Dr. {{doctorName}}</strong> on <strong>{{when}}</strong>.</p>
      <p>Reservation: <strong>{{reservationNumber}}</strong></p>
      <p>Your invoice is attached as a PDF for your records.</p>
    </div>
    <div class="footer">© {{FOOTER_YEAR}} {{FOOTER_BRAND}}</div>
  </div>
</body>
</html>
`;

export const ACCOUNT_VERIFICATION_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #0d9488; color: white; padding: 28px; text-align: center; }
    .content { padding: 32px 28px; color: #555; line-height: 1.6; }
    .otp-box { background: #f0fdfa; border: 2px solid #0d9488; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 36px; font-weight: bold; color: #0d9488; letter-spacing: 5px; }
    .footer { background: #f8f9fa; padding: 16px; text-align: center; color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Verify your email</h1></div>
    <div class="content">
      <p>Hello,</p>
      <p>Use this code to verify your <strong>{{email}}</strong> account at {{FOOTER_BRAND}}:</p>
      <div class="otp-box">
        <div class="otp-code">{{otp}}</div>
        <p style="margin:12px 0 0;color:#666;font-size:14px;">Valid for {{minutes}} minutes</p>
      </div>
      <p style="font-size:13px;color:#888;">If you did not create an account, ignore this email.</p>
    </div>
    <div class="footer">© {{FOOTER_YEAR}} {{FOOTER_BRAND}}</div>
  </div>
</body>
</html>
`;