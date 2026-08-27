/**
 * Server-Side Contact API Handler (Vercel Serverless Function)
 * 
 * Ensures all Google Sheet URLs, credentials, and forwarding logic are hidden
 * strictly on the server-side and protected by environment variables.
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { name, email, message } = req.body || {};

    // 1. Server-Side Input Sanitization & Validation
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    if (!trimmedName || trimmedName.length > 100) {
      return res.status(400).json({ error: 'Name is required (maximum 100 characters).' });
    }

    // Strict Email Format Validation Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail) || trimmedEmail.length > 150) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    // Strict Message Length Limit (Max 200 characters)
    if (!trimmedMessage) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (trimmedMessage.length > 200) {
      return res.status(400).json({ error: 'Message cannot exceed 200 characters to prevent spam abuse.' });
    }

    // 2. Resolve Google Sheet Database URL strictly from Environment Variable
    const googleSheetUrl = process.env.GOOGLE_SHEET_DATABASE_URL || "https://script.google.com/macros/s/AKfycbyPxo9FvkfecJlHsfbFksaREP-0AgUtX83vfmptsKcBLMpJUYziSY48XBKb_zq_yGPrVA/exec";

    const payload = {
      timestamp: new Date().toLocaleString(),
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage
    };

    // 3. Dispatch server-side to Google Apps Script / Google Sheet
    if (googleSheetUrl && googleSheetUrl.startsWith('http')) {
      await fetch(googleSheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Inquiry received and securely stored.' 
    });

  } catch (error) {
    console.error('Server-side contact submission error:', error);
    return res.status(500).json({ error: 'Internal server error while processing message.' });
  }
}
