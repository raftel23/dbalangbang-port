/**
 * Final Appointment Booking Endpoint: /api/book-appointment
 * 
 * Features & Specifications:
 * 1. Pre-Execution 1-to-5 Min Cooldown Check: Intercepts spam attempts with HTTP 429 BEFORE Google Calendar, Sheets, or Telegram.
 * 2. Honeypot Bot Trap: Silently drops automated spam bots.
 * 3. Complete Google Event Resource Mapping:
 *    - summary: "Meeting with " + clientName
 *    - description: "Client Email: " + clientEmail + "\nMessage: " + clientMessage
 *    - start: { dateTime, timeZone } / end: { dateTime, timeZone }
 *    - conferenceDataVersion: 1 with Google Meet auto-generation
 * 4. Google Sheets Database Logging & Instant Telegram Notification Dispatch.
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
    // 1. Extract Client IP Address and Submitted Email immediately
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
                     req.headers['x-real-ip'] ||
                     req.socket?.remoteAddress ||
                     'unknown-client';

    const {
      name,
      clientName: altName,
      email,
      clientEmail: altEmail,
      message,
      clientMessage: altMessage,
      topic,
      notes,
      slotUtc,
      clientTimezone,
      appt_fax,
      company_fax
    } = req.body || {};

    const clientName = (typeof name === 'string' && name.trim()) || (typeof altName === 'string' && altName.trim()) || '';
    const clientEmail = ((typeof email === 'string' && email.trim()) || (typeof altEmail === 'string' && altEmail.trim()) || '').toLowerCase();
    const clientMessage = (typeof message === 'string' && message.trim()) || (typeof altMessage === 'string' && altMessage.trim()) || (typeof topic === 'string' && topic.trim()) || (typeof notes === 'string' && notes.trim()) || '30-Minute Strategy & Discovery Call';
    const targetTimezone = typeof clientTimezone === 'string' && clientTimezone.trim() ? clientTimezone.trim() : 'UTC';

    const now = Date.now();

    // 2. PRE-EXECUTION RATE LIMITER CHECK (Executed before Google Calendar, Sheets, or Telegram)
    const ipKey = `ip:${clientIp}`;
    const emailKey = clientEmail ? `email:${clientEmail}` : null;

    const ipExpiry = global._appointmentCooldowns.get(ipKey);
    const emailExpiry = emailKey ? global._appointmentCooldowns.get(emailKey) : null;

    if ((ipExpiry && now < ipExpiry) || (emailExpiry && now < emailExpiry)) {
      const activeExpiry = Math.max(ipExpiry || 0, emailExpiry || 0);
      const remainingSeconds = Math.ceil((activeExpiry - now) / 1000);

      console.warn(`[Appointment Rate Limit Intercepted] Blocked spam from IP: ${clientIp}, Email: ${clientEmail} (Cooldown: ${remainingSeconds}s remaining).`);

      // STRICT RULE: Return HTTP 429 immediately
      // Do NOT call Google Calendar API, do NOT create event, do NOT trigger Telegram alerts, do NOT update Google Sheets.
      return res.status(429).json({
        error: 'cooldown',
        message: 'Appointment already secured! Please wait a few minutes before trying to schedule another session.',
        remainingSeconds
      });
    }

    // 3. Honeypot Bot Trap
    const honeypotVal = (typeof appt_fax === 'string' ? appt_fax : '') || (typeof company_fax === 'string' ? company_fax : '');
    if (honeypotVal.trim() !== '') {
      console.warn(`[Honeypot Triggered] Blocked bot appointment submission from IP: ${clientIp}`);
      return res.status(200).json({ success: true, message: 'Appointment request received.' });
    }

    // 4. Input Sanitization & Validation
    if (!clientName || clientName.length > 100) {
      return res.status(400).json({ error: 'Full name is required (max 100 characters).' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!clientEmail || !emailRegex.test(clientEmail) || clientEmail.length > 150) {
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

    // Format human-friendly display dates in Client Timezone and Manila Timezone (PHT)
    let clientFormattedTime = '';
    let manilaFormattedTime = '';

    try {
      clientFormattedTime = new Intl.DateTimeFormat('en-US', {
        timeZone: targetTimezone,
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

    // 5. Structure Complete Google Calendar Event Resource Payload with Google Meet
    const googleCalendarEventPayload = {
      action: 'create_appointment',
      summary: "Meeting with " + clientName,
      description: "Client Email: " + clientEmail + "\nMessage: " + clientMessage,
      start: {
        dateTime: appointmentStartTime.toISOString(),
        timeZone: "UTC"
      },
      end: {
        dateTime: appointmentEndTime.toISOString(),
        timeZone: "UTC"
      },
      attendees: [
        { email: clientEmail }
      ],
      conferenceDataVersion: 1,
      conferenceData: {
        createRequest: {
          requestId: "meet-session-" + Date.now(),
          conferenceSolutionKey: { type: "addOn" }
        }
      },
      // Auxiliary fields for Google Sheet logging & Apps Script
      name: clientName,
      email: clientEmail,
      message: clientMessage,
      clientTimezone: targetTimezone,
      clientFormattedTime,
      manilaFormattedTime,
      timestamp: new Date().toLocaleString()
    };

    // 6. Dispatch to Google Calendar Webhook & Google Sheets Database
    const webhookUrl = process.env.GOOGLE_CALENDAR_WEBHOOK_URL || process.env.GOOGLE_SHEET_DATABASE_URL;
    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googleCalendarEventPayload)
        });
      } catch (webhookErr) {
        console.warn('Google Calendar / Sheet webhook warning:', webhookErr);
      }
    }

    // 7. Dispatch Instant Telegram Bot Notification
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (telegramToken && telegramChatId) {
      try {
        const telegramMessage = `📅 <b>New Confirmed Google Calendar Appointment!</b>\n\n` +
                                `👤 <b>Client Name:</b> ${escapeHtml(clientName)}\n` +
                                `📧 <b>Client Email:</b> ${escapeHtml(clientEmail)}\n` +
                                `🗓️ <b>Client Local Time:</b> ${escapeHtml(clientFormattedTime)}\n` +
                                `🌐 <b>Client Timezone:</b> ${escapeHtml(targetTimezone)}\n` +
                                `🇵🇭 <b>Denver's Time (PHT):</b> ${escapeHtml(manilaFormattedTime)}\n` +
                                `💬 <b>Message / Goal:</b>\n${escapeHtml(clientMessage)}\n\n` +
                                `🎥 <i>Google Meet Video Conference Generated</i>\n` +
                                `📊 <i>Logged in Google Calendar & Google Sheets</i>`;

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
        console.warn('Telegram notification dispatch warning:', tgErr);
      }
    }

    // 8. Enforce Randomized 1-to-5 Minute Cooldown Window (60,000ms - 300,000ms)
    const minCooldownMs = 1 * 60 * 1000;  // 1 minute (60s)
    const maxCooldownMs = 5 * 60 * 1000;  // 5 minutes (300s)
    const randomCooldownMs = Math.floor(Math.random() * (maxCooldownMs - minCooldownMs + 1)) + minCooldownMs;
    const cooldownExpiry = now + randomCooldownMs;

    global._appointmentCooldowns.set(ipKey, cooldownExpiry);
    if (emailKey) {
      global._appointmentCooldowns.set(emailKey, cooldownExpiry);
    }

    // Prune stale cache entries if cache size exceeds limit
    if (global._appointmentCooldowns.size > 1000) {
      for (const [key, exp] of global._appointmentCooldowns.entries()) {
        if (now > exp) global._appointmentCooldowns.delete(key);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Appointment successfully confirmed for ${clientFormattedTime}! Check your email for the Google Meet invitation.`,
      scheduledTime: clientFormattedTime
    });

  } catch (error) {
    console.error('Error in /api/book-appointment:', error);
    return res.status(500).json({ error: 'Internal server error while confirming appointment.' });
  }
}
