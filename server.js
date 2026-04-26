const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');
const { google } = require('googleapis');

const app  = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════
app.use(express.json());
app.use(cors({
  origin: [
    'https://cgc-lko.42web.io',
    'http://localhost',
    'http://127.0.0.1'
  ]
}));

// Rate limiting — spam se bachao
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Bahut zyada requests. 15 min baad try karo.' }
});
app.use('/api/', limiter);

// ══════════════════════════════
//  EMAIL SETUP
// ══════════════════════════════
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ══════════════════════════════
//  GOOGLE SHEETS SETUP
// ══════════════════════════════
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

const credentials = {
  type: 'service_account',
  project_id:   process.env.GCP_PROJECT_ID,
  private_key:  process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GCP_CLIENT_EMAIL,
};

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

// Google Sheet mein row add karne ka function
async function addToSheet(sheetName, rowData) {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData]
      }
    });
    console.log(`✅ Sheet mein add ho gaya: ${sheetName}`);
    return true;
  } catch (err) {
    console.error('❌ Sheet error:', err.message);
    return false;
  }
}

// ══════════════════════════════
//  HEALTH CHECK
// ══════════════════════════════
app.get('/', (req, res) => {
  res.json({ 
    status: 'CGC Backend chal raha hai! ✅',
    version: '2.0',
    features: ['Email', 'Google Sheets']
  });
});

// ══════════════════════════════
//  API 1: CONTACT FORM
// ══════════════════════════════
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body;

  // 1. Validation
  if (!name || !email || !message) {
    return res.status(400).json({ 
      success: false, 
      message: 'Name, email aur message required hai.' 
    });
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  try {
    // 2. Google Sheet mein save karo
    await addToSheet('Contacts', [
      timestamp,
      'Contact Form',
      name,
      email,
      phone || 'N/A',
      '',
      '',
      message,
      'New'
    ]);

    // 3. Admin ko email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'tiwarisundarm68@gmail.com',
      subject: `📩 New Contact: ${name}`,
      html: `
        <div style="font-family:Arial;max-width:600px;margin:auto;border:2px solid #001a56;border-radius:10px;overflow:hidden">
          <div style="background:#001a56;color:#ffcc00;padding:20px;text-align:center">
            <h2>📩 New Contact Form</h2>
          </div>
          <div style="padding:20px">
            <table border="1" cellpadding="10" width="100%" style="border-collapse:collapse;font-size:14px">
              <tr><td width="35%"><b>Name</b></td><td>${name}</td></tr>
              <tr><td><b>Email</b></td><td>${email}</td></tr>
              <tr><td><b>Phone</b></td><td>${phone || 'N/A'}</td></tr>
              <tr><td><b>Message</b></td><td>${message}</td></tr>
              <tr><td><b>Time</b></td><td>${timestamp}</td></tr>
            </table>
          </div>
        </div>
      `
    });

    // 4. User ko confirmation
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: '✅ City Group of Colleges — Message Received!',
      html: `
        <div style="font-family:Arial;max-width:600px;margin:auto;border:2px solid #001a56;border-radius:10px;overflow:hidden">
          <div style="background:#001a56;color:#ffcc00;padding:20px;text-align:center">
            <h2>🎓 City Group of Colleges</h2>
          </div>
          <div style="padding:20px">
            <h3>Namaste ${name}!</h3>
            <p>Aapka message humein mil gaya. Hum <b>24 ghante</b> mein reply karenge.</p>
            <br>
            <p>📞 <b>8177001081</b></p>
            <p>✉️ <b>info@cglko.com</b></p>
            <p>🌐 cgc-lko.42web.io</p>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: 'Message bhej diya gaya! ✅' });

  } catch (error) {
    console.error('Contact API error:', error);
    res.status(500).json({ success: false, message: 'Error aaya. Baad mein try karo.' });
  }
});

// ══════════════════════════════
//  API 2: APPLICATION FORM
// ══════════════════════════════
app.post('/api/apply', async (req, res) => {
  const { 
    contact_type, college, application_type, submission_mode,
    student_name, student_email, student_phone
  } = req.body;

  // 1. Validation
  if (!student_name || !student_email) {
    return res.status(400).json({ 
      success: false, 
      message: 'Name aur email required hai.' 
    });
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  try {
    // 2. Google Sheet mein save karo
    await addToSheet('Applications', [
      timestamp,
      'Application Form',
      student_name,
      student_email,
      student_phone || 'N/A',
      college,
      application_type,
      contact_type,
      'Pending'
    ]);

    // 3. Admin ko email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'tiwarisundarm68@gmail.com',
      subject: `📋 New Application: ${student_name} — ${college}`,
      html: `
        <div style="font-family:Arial;max-width:600px;margin:auto;border:2px solid #001a56;border-radius:10px;overflow:hidden">
          <div style="background:#001a56;color:#ffcc00;padding:20px;text-align:center">
            <h2>📋 New Application Form</h2>
          </div>
          <div style="padding:20px">
            <table border="1" cellpadding="10" width="100%" style="border-collapse:collapse;font-size:14px">
              <tr><td width="40%"><b>Student Name</b></td><td>${student_name}</td></tr>
              <tr><td><b>Email</b></td><td>${student_email}</td></tr>
              <tr><td><b>Phone</b></td><td>${student_phone || 'N/A'}</td></tr>
              <tr><td><b>Contact Type</b></td><td>${contact_type}</td></tr>
              <tr><td><b>College</b></td><td>${college}</td></tr>
              <tr><td><b>Application Type</b></td><td>${application_type}</td></tr>
              <tr><td><b>Submission Mode</b></td><td>${submission_mode}</td></tr>
              <tr><td><b>Time</b></td><td>${timestamp}</td></tr>
            </table>
          </div>
        </div>
      `
    });

    // 4. Student ko confirmation
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: student_email,
      subject: '🎓 Application Received — City Group of Colleges',
      html: `
        <div style="font-family:Arial;max-width:600px;margin:auto;border:2px solid #001a56;border-radius:10px;overflow:hidden">
          <div style="background:#001a56;color:#ffcc00;padding:20px;text-align:center">
            <h2>🎓 City Group of Colleges</h2>
          </div>
          <div style="padding:20px">
            <h3>Namaste ${student_name}!</h3>
            <p>Aapki application <b>${college}</b> ke liye successfully receive ho gayi!</p>
            <p>Humari team <b>2-3 working days</b> mein aapse contact karegi.</p>
            <br>
            <p>📞 <b>8177001081</b></p>
            <p>✉️ <b>info@cglko.com</b></p>
          </div>
        </div>
      `
    });

    res.json({ success: true, message: 'Application submit ho gayi! ✅' });

  } catch (error) {
    console.error('Application API error:', error);
    res.status(500).json({ success: false, message: 'Error aaya. Baad mein try karo.' });
  }
});

// ══════════════════════════════
//  API 3: COURSE SEARCH
// ══════════════════════════════
app.post('/api/search', (req, res) => {
  const { department, campus } = req.body;

  const courses = {
    'Law':        ['LLB (3 Year)', 'LLB (5 Year Integrated)', 'LLM'],
    'Management': ['BBA', 'MBA', 'PGDM', 'BCA', 'MCA'],
    'Nursing':    ['B.Sc Nursing', 'GNM', 'ANM'],
    'Pharmacy':   ['B.Pharma', 'D.Pharma', 'M.Pharma'],
    'ITI':        ['Diploma in IT', 'Diploma in CS', 'Diploma in Optometry']
  };

  const results = courses[department] || [];
  res.json({ 
    success: true, 
    department, 
    campus, 
    courses: results,
    total: results.length
  });
});

// ══════════════════════════════
//  SERVER START
// ══════════════════════════════
app.listen(PORT, () => {
  console.log(`✅ CGC Server chal raha hai port ${PORT} pe`);
  console.log(`🌐 Health check: http://localhost:${PORT}`);
});
