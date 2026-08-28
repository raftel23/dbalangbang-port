/**
 * Backend Endpoint: /api/get-availability
 * 
 * Features:
 * 1. Computes free/busy availability for the next 14 days.
 * 2. Working hours: Mon-Fri 9:00 AM to 6:00 PM (Asia/Manila UTC+8).
 * 3. Filters out busy/booked slots from Google Calendar.
 * 4. Returns clean array of available UTC ISO timestamps.
 */

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = new Date();
    const availableSlots = [];
    const hostTimezoneOffsetHours = 8; // Asia/Manila (UTC+8)

    // Generate slots for the next 14 days
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      const targetDate = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
      
      // Determine day of week in Manila time
      const utcDay = targetDate.getUTCDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (utcDay === 0 || utcDay === 6) continue;

      const year = targetDate.getUTCFullYear();
      const month = targetDate.getUTCMonth();
      const date = targetDate.getUTCDate();

      // Working hours in Manila: 9:00 AM to 6:00 PM (01:00 UTC to 10:00 UTC)
      // 30-minute intervals: 01:00, 01:30, 02:00, ..., 09:30 UTC
      for (let hour = 1; hour < 10; hour++) {
        for (let min of [0, 30]) {
          const slotDate = new Date(Date.UTC(year, month, date, hour, min, 0));
          
          // Only include future slots (at least 2 hours from now)
          if (slotDate.getTime() > (now.getTime() + 2 * 60 * 60 * 1000)) {
            availableSlots.push(slotDate.toISOString());
          }
        }
      }
    }

    // Check if Google Apps Script Webhook provides live busy slots to filter out
    const webhookUrl = process.env.GOOGLE_CALENDAR_WEBHOOK_URL || process.env.GOOGLE_SHEET_DATABASE_URL;
    let busySlots = [];

    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_busy_slots' })
        });
        const data = await response.json();
        if (data && Array.isArray(data.busySlots)) {
          busySlots = data.busySlots;
        }
      } catch (webhookErr) {
        // Fallback gracefully to default availability schedule
        console.warn('Google Calendar Free/Busy fetch fallback:', webhookErr);
      }
    }

    // Filter out busy slots if any
    const filteredSlots = availableSlots.filter(slotIso => {
      const slotTime = new Date(slotIso).getTime();
      return !busySlots.some(busyIso => {
        const busyTime = new Date(busyIso).getTime();
        return Math.abs(slotTime - busyTime) < (29 * 60 * 1000); // within 30 min window
      });
    });

    return res.status(200).json({
      success: true,
      hostTimezone: 'Asia/Manila',
      slotDurationMinutes: 30,
      availableSlots: filteredSlots
    });

  } catch (error) {
    console.error('Availability API error:', error);
    return res.status(500).json({ error: 'Internal server error while fetching availability.' });
  }
}
