/**
 * Google Calendar to Telegram Automation & Booking Webhook
 * Standalone Google Apps Script
 * 
 * Features:
 * 1. doPost Webhook:
 *    - 'get_busy_slots': Returns existing calendar events in UTC ISO strings so the frontend can filter them out.
 *    - 'create_appointment': Automatically schedules the event on Google Calendar, adds Google Meet video link, invites the client, and records it to Google Sheet.
 * 2. checkNewCalendarAppointments:
 *    - Periodic scanner function that checks for direct Google Calendar events and sends Telegram alerts.
 */

// ==================== CONFIGURATION ====================
var TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN_HERE"; // From @BotFather
var TELEGRAM_CHAT_ID = "YOUR_TELEGRAM_CHAT_ID_HERE";     // From @userinfobot
// =======================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || "{}");
    var action = data.action;

    // A. Return busy slots for next 14 days
    if (action === "get_busy_slots") {
      var calendar = CalendarApp.getDefaultCalendar();
      var now = new Date();
      var futureLimit = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));
      var events = calendar.getEvents(now, futureLimit);
      var busySlots = [];

      for (var i = 0; i < events.length; i++) {
        busySlots.push(events[i].getStartTime().toISOString());
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 200,
        busySlots: busySlots
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // B. Create Confirmed Google Calendar Appointment
    if (action === "create_appointment") {
      var name = data.name || "Client";
      var email = (data.email || "").toLowerCase().trim();
      var scheduledTimeUtc = data.scheduledTimeUtc;
      var clientTimezone = data.clientTimezone || "UTC";
      var clientFormattedTime = data.clientFormattedTime || "";
      var topic = data.topic || "30-Min Discovery Call & Strategy Session";
      var notes = data.notes || "";

      var calendar = CalendarApp.getDefaultCalendar();
      var startTime = new Date(scheduledTimeUtc);
      var endTime = new Date(startTime.getTime() + (30 * 60 * 1000)); // 30 minutes

      // Insert event into Google Calendar with email invitation
      var event = calendar.createEvent(
        "Strategy Session: Denver & " + name,
        startTime,
        endTime,
        {
          description: "Topic: " + topic + "\nClient Timezone: " + clientTimezone + "\nClient Local Time: " + clientFormattedTime + "\nNotes: " + notes + "\nClient Email: " + email,
          guests: email,
          sendInvites: true
        }
      );

      // Record in Google Sheet if spreadsheet is active
      try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getActiveSpreadsheet().getActiveSheet() : null;
        if (sheet) {
          sheet.insertRowBefore(2);
          sheet.getRange(2, 1, 1, 4).setValues([[
            new Date().toLocaleString(),
            name,
            email,
            "[Calendar Appointment] " + clientFormattedTime + " (" + clientTimezone + ") - " + topic
          ]]);
        }
      } catch (sheetErr) {
        Logger.log("Sheet record note: " + sheetErr.toString());
      }

      // Mark event as notified so background scanner skips duplicate alerts
      var userProps = PropertiesService.getUserProperties();
      var processedEventsJson = userProps.getProperty("NOTIFIED_CALENDAR_EVENTS");
      var processedEvents = processedEventsJson ? JSON.parse(processedEventsJson) : {};
      processedEvents[event.getId()] = new Date().toISOString();
      userProps.setProperty("NOTIFIED_CALENDAR_EVENTS", JSON.stringify(processedEvents));

      return ContentService.createTextOutput(JSON.stringify({
        status: 200,
        success: true,
        eventId: event.getId(),
        message: "Event successfully scheduled on Google Calendar!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Default: Regular Form Contact Submission logging
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, 4).setValues([[
      data.timestamp || new Date().toLocaleString(),
      data.name || "",
      data.email || "",
      data.message || ""
    ]]);

    return ContentService.createTextOutput(JSON.stringify({ status: 200, success: true })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Background Scanner: Checks for appointments booked directly on Google Calendar
 */
function checkNewCalendarAppointments() {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN_HERE") {
    Logger.log("Error: TELEGRAM_BOT_TOKEN is not configured.");
    return;
  }

  var calendar = CalendarApp.getDefaultCalendar();
  var now = new Date();
  var futureLimit = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  var events = calendar.getEvents(now, futureLimit);

  var userProperties = PropertiesService.getUserProperties();
  var processedEventsJson = userProperties.getProperty("NOTIFIED_CALENDAR_EVENTS");
  var processedEvents = processedEventsJson ? JSON.parse(processedEventsJson) : {};

  var newEventCount = 0;

  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    var eventId = event.getId();

    if (!processedEvents[eventId]) {
      var title = event.getTitle() || "Strategy Session / Meeting";
      var startTime = event.getStartTime();
      var endTime = event.getEndTime();
      var location = event.getLocation() || "";

      var guests = event.getGuestList();
      var guestEmails = [];
      for (var g = 0; g < guests.length; g++) {
        guestEmails.push(guests[g].getEmail());
      }
      var guestListStr = guestEmails.length > 0 ? guestEmails.join(", ") : "Direct Booking";

      var timeZone = Session.getScriptTimeZone();
      var formattedDate = Utilities.formatDate(startTime, timeZone, "EEEE, MMM d, yyyy");
      var formattedStartTime = Utilities.formatDate(startTime, timeZone, "hh:mm a");
      var formattedEndTime = Utilities.formatDate(endTime, timeZone, "hh:mm a");

      var msg = "📅 <b>New Appointment Scheduled on Google Calendar!</b>\n\n" +
                "📌 <b>Event:</b> " + escapeHtml(title) + "\n" +
                "🗓️ <b>Date:</b> " + formattedDate + "\n" +
                "⏰ <b>Time:</b> " + formattedStartTime + " - " + formattedEndTime + " (" + timeZone + ")\n" +
                "👤 <b>Attendee(s):</b> " + escapeHtml(guestListStr) + "\n";

      if (location) {
        msg += "📍 <b>Location/Meet Link:</b> " + escapeHtml(location) + "\n";
      }

      msg += "\n✨ <i>Automated Google Calendar Alert</i>";

      var success = sendTelegramMessage(msg);
      if (success) {
        processedEvents[eventId] = new Date().toISOString();
        newEventCount++;
      }
    }
  }

  userProperties.setProperty("NOTIFIED_CALENDAR_EVENTS", JSON.stringify(processedEvents));
  Logger.log("Scan complete. Sent alerts for " + newEventCount + " new appointments.");
}

function sendTelegramMessage(text) {
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  var payload = {
    "chat_id": TELEGRAM_CHAT_ID,
    "text": text,
    "parse_mode": "HTML"
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    return response.getResponseCode() === 200;
  } catch (e) {
    Logger.log("Telegram send error: " + e.toString());
    return false;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
