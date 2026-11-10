/**
 * Contact endpoint for the portfolio — the "server" half of the contact form.
 *
 * Setup (once):
 *   1. script.google.com → New project → paste this file (replace the starter code).
 *   2. Set RECAPTCHA_SECRET to your reCAPTCHA SECRET key (from google.com/recaptcha).
 *   3. Set TO_EMAIL to where messages should arrive.
 *   4. Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone.
 *   5. Copy the Web app URL (https://script.google.com/macros/s/.../exec) and paste
 *      it into CONTACT_ENDPOINT in src/app/compenents/contact/ContactForm.jsx.
 *
 * If you later edit this script: Manage deployments → ✏️ → Version: New version,
 * otherwise the URL keeps serving the old code.
 *
 * Contract (POST, JSON body):
 *   { firstname, lastname, tel, email, subject, message, recaptchaToken }
 * Response (JSON):
 *   { ok: true }  or  { ok: false, error: "..." }
 */

const RECAPTCHA_SECRET = 'PASTE_YOUR_RECAPTCHA_SECRET_KEY';
const TO_EMAIL = 'vidurakavinda1999@gmail.com'; // where messages arrive

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Real reCAPTCHA verification on Google's server
    const verify = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: { secret: RECAPTCHA_SECRET, response: String(data.recaptchaToken || '') },
    });
    if (!JSON.parse(verify.getContentText()).success) {
      return out({ ok: false, error: 'reCAPTCHA verification failed' });
    }

    const pick = (k, max) => String(data[k] || '').trim().slice(0, max);
    const firstname = pick('firstname', 100);
    const lastname = pick('lastname', 100);
    const email = pick('email', 200);
    const tel = pick('tel', 50);
    const subject = pick('subject', 200).replace(/[\r\n]+/g, ' ');
    const message = pick('message', 5000);
    if (!firstname || !email || !message) {
      return out({ ok: false, error: 'Missing required fields' });
    }

    MailApp.sendEmail({
      to: TO_EMAIL,
      replyTo: email,
      subject: '[Portfolio contact] ' + (subject || firstname),
      body: 'Name: ' + firstname + ' ' + lastname +
            '\nEmail: ' + email +
            '\nPhone: ' + tel +
            '\n\n' + message,
    });

    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
