/**
 * Final Appointment Booking Endpoint: /api/book-appointment
 * 
 * Features:
 * 1. Honeypot Bot Trap: Silently drops spam bot submissions.
 * 2. IP & Email Cooldown Shield (1-to-5 mins): Intercepts rapid repeated bookings with HTTP 429.
 * 3. Google Sheets Logging: Appends appointment details to Google Sheet database.
 * 4. Google Calendar Direct Event Insertion: Schedules confirmed meeting on primary calendar.
 * 5. Telegram Bot Notification: Instant alert detailing Client Name, Email, Scheduled Time, and Local Timezone.
 */

// Global in-memory cache for IP & Email appointment cooldowns
global._appointmentCooldowns = global._appointmentCooldowns || new Map();

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // 1. Extract Client IP Address
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
                     req.headers['x-real-ip'] ||
                     req.socket?.remoteAddress ||
                     'unknown-client';

    const { name, email, slotUtc, clientTimezone, topic, notes, company_fax } = req.body || {};

    const now = Date.now();

    // 2. Honeypot Verification (Silent Trap for Automated Bots)
    if (company_fax && String(company_fax).trim() !== '') {
      console.warn(`[Honeypot Triggered] Blocked bot appointment from IP: ${clientIp}`);
      return res.status(200).json({ success: true, message: 'Appointment secured.' });
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.toLowerCase().trim() : '';
    const trimmedTimezone = typeof clientTimezone === 'string' ? clientTimezone.trim() : 'UTC';
    const trimmedTopic = typeof topic === 'string' && topic.trim() ? topic.trim() : '30-Min Strategy & Discovery Call';
    const trimmedNotes = typeof notes === 'string' ? notes.trim() : '';

    // 3. IP & Email Cooldown Rate Limiting (1-to-5 minutes)
    const ipKey = `ip:${clientIp}`;
    const emailKey = trimmedEmail ? `email:${trimmedEmail}` : null;

    const ipExpiry = global._appointmentCooldowns.get(ipKey);
    const emailExpiry = emailKey ? global._appointmentCooldowns.get(emailKey) : null;

    if ((ipExpiry && now < ipExpiry) || (emailExpiry && now < emailExpiry)) {
      const activeExpiry = Math.max(ipExpiry || 0, emailExpiry || 0);
      const remainingSeconds = Math.ceil((activeExpiry - now) / 1000);

      console.warn(`[Appointment Cooldown Blocked] Intercepted request from IP: ${clientIp}, Email: ${trimmedEmail} (Active for ${remainingSeconds}s)`);

      return res.status(429).json({
        error: 'cooldown',
        message: 'Appointment already secured! Please wait a few minutes before trying to schedule another session.',
        remainingSeconds
      });
    }

    // 4. Input Validation
    if (!trimmedName || trimmedName.length > 100) {
      return res.status(400).json({ error: 'Full name is required (max 100 characters).' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail) || trimmedEmail.length > 150) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!slotUtc) {
      return res.status(400).json({ error: 'Please select an available time slot.' });
    }

    const appointmentStartTime = new Date(slotUtc);
    if (isNaN(appointmentStartTime.getTime())) {
      return res.status(400).json({ error: 'Invalid time slot selected.' });
    }

    const appointmentEndTime = new Date(appointmentStartTime.getTime() + (30 * 60 * 1000)); // 30 mins

    // Format display dates in Client Timezone and Manila Timezone
    let clientFormattedTime = '';
    let manilaFormattedTime = '';

    try {
      clientFormattedTime = new Intl.DateTimeFormat('en-US', {
        timeZone: trimmedTimezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      }).format(appointmentStartTime);
    } catch {
      clientFormattedTime = appointmentStartTime.toUTCString();
    }

    try {
      manilaFormattedTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      }).format(appointmentStartTime);
    } catch {
      manilaFormattedTime = appointmentStartTime.toUTCString();
    }

    // 5. Append to Google Sheet Database
    const databaseWebhookUrl = process.env.GOOGLE_SHEET_DATABASE_URL || process.env.GOOGLE_CALENDAR_WEBHOOK_URL;
    const bookingPayload = {
      action: 'create_appointment',
      timestamp: new Date().toLocaleString(),
      name: trimmedName,
      email: trimmedEmail,
      scheduledTimeUtc: slotUtc,
      clientFormattedTime,
      manilaFormattedTime,
      clientTimezone: trimmedTimezone,
      topic: trimmedTopic,
      notes: trimmedNotes,
      message: `[Scheduled Video Call] ${clientFormattedTime} (${trimmedTimezone})`
    };

    if (databaseWebhookUrl && databaseWebhookUrl.startsWith('http')) {
      try {
        await fetch(databaseWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingPayload)
        });
      } catch (dbErr) {
        console.warn('Google Sheet database / Calendar webhook warning:', dbErr);
      }
    }

    // 6. Telegram Bot Notification Dispatch
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (telegramToken && telegramChatId) {
      try {
        const telegramMessage = `📅 <b>New Appointment Scheduled via Landing Page!</b>\n\n` +
                                `👤 <b>Client Name:</b> ${escapeHtml(trimmedName)}\n` +
                                `📧 <b>Client Email:</b> ${escapeHtml(trimmedEmail)}\n` +
                                `🗓️ <b>Client Local Time:</b> ${escapeHtml(clientFormattedTime)}\n` +
                                `🌐 <b>Client Timezone:</b> ${escapeHtml(trimmedTimezone)}\n` +
                                `🇵🇭 <b>Denver's Time (PHT):</b> ${escapeHtml(manilaFormattedTime)}\n` +
                                `📌 <b>Topic:</b> ${escapeHtml(trimmedTopic)}\n` +
                                (trimmedNotes ? `📝 <b>Notes:</b> ${escapeHtml(trimmedNotes)}\n` : '') +
                                `\n✨ <i>Automatically logged in Google Calendar & Google Sheets</i>`;

        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: telegramMessage,
            parse_mode: 'HTML'
          })
        });
      } catch (tgErr) {
        console.warn('Telegram appointment notification dispatch warning:', tgErr);
      }
    }

    // 7. Enforce Randomized 1-to-5 Minute Cooldown on both IP and Email
    const minCooldownMs = 1 * 60 * 1000;  // 1 minute (60s)
    const maxCooldownMs = 5 * 60 * 1000;  // 5 minutes (300s)
    const randomCooldownMs = Math.floor(Math.random() * (maxCooldownMs - minCooldownMs + 1)) + minCooldownMs;
    const cooldownExpiry = now + randomCooldownMs;

    global._appointmentCooldowns.set(ipKey, cooldownExpiry);
    if (emailKey) {
      global._appointmentCooldowns.set(emailKey, cooldownExpiry);
    }

    // Prune stale cache entries if cache size grows
    if (global._appointmentCooldowns.size > 1000) {
      for (const [key, exp] of global._appointmentCooldowns.entries()) {
        if (now > exp) global._appointmentCooldowns.delete(key);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Appointment successfully confirmed for ${clientFormattedTime}! Check your email for the Google Meet details.`,
      scheduledTime: clientFormattedTime
    });

  } catch (error) {
    console.error('Appointment booking serverless error:', error);
    return res.status(500).json({ error: 'Internal server error while confirming appointment.' });
  }
}
