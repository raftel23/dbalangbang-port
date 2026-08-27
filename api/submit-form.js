/**
 * Secure Serverless Backend Function: /api/submit-form
 * 
 * Features:
 * 1. Honeypot Bot Trap: Silently suppresses automated spam bots.
 * 2. Server-Side IP Cooldown Rate Limiter: Blocks spam clicks by enforcing a random 1-5 minute cooldown per IP (HTTP 429).
 * 3. Protected Environment Variables: All Google Sheets credentials & logic hidden strictly on the server side.
 * 4. Multi-Layer Input Validation: Email regex verification and 200-character message cap.
 */

// Global in-memory cache for IP cooldowns across serverless invocations
global._ipCooldowns = global._ipCooldowns || new Map();

export default async function handler(req, res) {
  // Only permit POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Extract Client IP Address
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
                     req.headers['x-real-ip'] ||
                     req.socket?.remoteAddress ||
                     'unknown-client';

    const now = Date.now();

    // 1. IP Cooldown Check (Rate Limiting)
    if (global._ipCooldowns.has(clientIp)) {
      const expiry = global._ipCooldowns.get(clientIp);
      if (now < expiry) {
        const remainingSeconds = Math.ceil((expiry - now) / 1000);
        return res.status(429).json({
          error: 'cooldown',
          message: 'Message sent! Please wait a few minutes before sending another.',
          remainingSeconds
        });
      } else {
        // Clean expired record
        global._ipCooldowns.delete(clientIp);
      }
    }

    const { name, email, message, company_fax } = req.body || {};

    // 2. Honeypot Field Verification (Silent Rejection for Bots)
    if (company_fax && String(company_fax).trim() !== '') {
      console.warn(`[Honeypot Triggered] Blocked bot submission from IP: ${clientIp}`);
      // Return fake 200 OK so bots do not retry
      return res.status(200).json({ 
        success: true, 
        message: 'Inquiry received.' 
      });
    }

    // 3. Server-Side Input Sanitization & Validation
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    if (!trimmedName || trimmedName.length > 100) {
      return res.status(400).json({ error: 'Name is required (max 100 characters).' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail) || trimmedEmail.length > 150) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!trimmedMessage) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (trimmedMessage.length > 200) {
      return res.status(400).json({ error: 'Message exceeds the 200-character limit to prevent spam abuse.' });
    }

    // 4. Resolve Google Sheets Database Endpoint from Environment Variables
    const googleSheetUrl = process.env.GOOGLE_SHEET_DATABASE_URL || "https://script.google.com/macros/s/AKfycbyPxo9FvkfecJlHsfbFksaREP-0AgUtX83vfmptsKcBLMpJUYziSY48XBKb_zq_yGPrVA/exec";

    const payload = {
      timestamp: new Date().toLocaleString(),
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage
    };

    // 5. Server-to-Server dispatch to Google Apps Script / Google Sheet
    if (googleSheetUrl && googleSheetUrl.startsWith('http')) {
      await fetch(googleSheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    // 6. Set Random Cooldown Timer between 1 to 5 Minutes (60,000ms - 300,000ms)
    const minCooldownMs = 60 * 1000;   // 1 minute
    const maxCooldownMs = 300 * 1000;  // 5 minutes
    const randomCooldownMs = Math.floor(Math.random() * (maxCooldownMs - minCooldownMs + 1)) + minCooldownMs;

    global._ipCooldowns.set(clientIp, now + randomCooldownMs);

    // Prune stale cache entries if cache size grows large
    if (global._ipCooldowns.size > 1000) {
      for (const [ip, exp] of global._ipCooldowns.entries()) {
        if (now > exp) global._ipCooldowns.delete(ip);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. Denver will reach out shortly.'
    });

  } catch (error) {
    console.error('Serverless submission error:', error);
    return res.status(500).json({ error: 'Internal server error while processing message.' });
  }
}
