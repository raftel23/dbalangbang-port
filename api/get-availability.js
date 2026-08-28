/**
 * Backend Endpoint: /api/get-availability
 * 
 * Features:
 * 1. Master Weekly Working Hours: Monday to Friday, 9:00 AM to 5:00 PM (Asia/Manila PHT, UTC+8).
 * 2. Queries Google Calendar freeBusy.query API for the next 14 days.
 * 3. Subtracts all busy intervals and returns only truly vacant time slots.
 * 4. Outputs clean JSON array of UTC ISO timestamps to the frontend grid.
 */

// Master Weekly Availability Schedule (Asia/Manila PHT, UTC+8)
// 9:00 AM to 5:00 PM PHT = 01:00 UTC to 09:00 UTC
const MASTER_BUSINESS_HOURS = [
  { dayOfWeek: 1, dayName: 'Monday',    startHourPHT: 9, startMinutePHT: 0, endHourPHT: 17, endMinutePHT: 0 },
  { dayOfWeek: 2, dayName: 'Tuesday',   startHourPHT: 9, startMinutePHT: 0, endHourPHT: 17, endMinutePHT: 0 },
  { dayOfWeek: 3, dayName: 'Wednesday', startHourPHT: 9, startMinutePHT: 0, endHourPHT: 17, endMinutePHT: 0 },
  { dayOfWeek: 4, dayName: 'Thursday',  startHourPHT: 9, startMinutePHT: 0, endHourPHT: 17, endMinutePHT: 0 },
  { dayOfWeek: 5, dayName: 'Friday',    startHourPHT: 9, startMinutePHT: 0, endHourPHT: 17, endMinutePHT: 0 }
];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
  }

  try {
    const now = new Date();
    const slotDurationMs = 30 * 60 * 1000; // 30 minutes
    const candidateSlots = [];

    // 1. Generate master candidate slots across the next 14 days
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      const targetDate = new Date(now.getTime() + (dayOffset * 24 * 60 * 60 * 1000));
      const utcDay = targetDate.getUTCDay();

      // Check if target day matches master business hours (Monday - Friday)
      const dayRule = MASTER_BUSINESS_HOURS.find(rule => rule.dayOfWeek === utcDay);
      if (!dayRule) continue; // Skip Saturday / Sunday

      const year = targetDate.getUTCFullYear();
      const month = targetDate.getUTCMonth();
      const date = targetDate.getUTCDate();

      // Working window: 9:00 AM to 5:00 PM PHT (01:00 UTC to 09:00 UTC)
      // Slots: 01:00, 01:30, 02:00, 02:30, 03:00, 03:30, 04:00, 04:30, 05:00, 05:30, 06:00, 06:30, 07:00, 07:30, 08:00, 08:30 UTC
      for (let utcHour = 1; utcHour < 9; utcHour++) {
        for (let min of [0, 30]) {
          const slotStart = new Date(Date.UTC(year, month, date, utcHour, min, 0));
          const slotEnd = new Date(slotStart.getTime() + slotDurationMs);

          // Only propose future slots with at least 2 hours advance notice
          if (slotStart.getTime() > (now.getTime() + 2 * 60 * 60 * 1000)) {
            candidateSlots.push({
              startIso: slotStart.toISOString(),
              startTime: slotStart.getTime(),
              endTime: slotEnd.getTime()
            });
          }
        }
      }
    }

    // 2. Query Google Calendar Free/Busy times via Google Apps Script Webhook
    const webhookUrl = process.env.GOOGLE_CALENDAR_WEBHOOK_URL || process.env.GOOGLE_SHEET_DATABASE_URL;
    let busyIntervals = [];

    if (webhookUrl && webhookUrl.startsWith('http')) {
      try {
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getTime() + (15 * 24 * 60 * 60 * 1000)).toISOString();

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'freeBusy.query',
            timeMin,
            timeMax
          })
        });

        const data = await response.json().catch(() => ({}));
        if (data && Array.isArray(data.busy)) {
          busyIntervals = data.busy;
        } else if (data && Array.isArray(data.busySlots)) {
          // Compatibility with legacy busy slot timestamps
          busyIntervals = data.busySlots.map(iso => ({
            start: iso,
            end: new Date(new Date(iso).getTime() + slotDurationMs).toISOString()
          }));
        }
      } catch (calErr) {
        console.warn('Google Calendar freeBusy query fallback:', calErr);
      }
    }

    // 3. Subtract any busy time blocks returned by Google Calendar
    const vacantSlots = candidateSlots.filter(candidate => {
      const isBusy = busyIntervals.some(busy => {
        const bStart = new Date(busy.start).getTime();
        const bEnd = new Date(busy.end).getTime();
        // Overlap condition: slotStart < busyEnd AND slotEnd > busyStart
        return (candidate.startTime < bEnd && candidate.endTime > bStart);
      });
      return !isBusy;
    }).map(c => c.startIso);

    return res.status(200).json({
      success: true,
      hostTimezone: 'Asia/Manila',
      workingHours: 'Mon-Fri 9:00 AM - 5:00 PM PHT',
      slotDurationMinutes: 30,
      availableSlots: vacantSlots
    });

  } catch (error) {
    console.error('Error in /api/get-availability:', error);
    return res.status(500).json({ error: 'Internal server error while resolving availability.' });
  }
}
