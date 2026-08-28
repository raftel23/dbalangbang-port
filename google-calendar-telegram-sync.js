/**
 * Google Calendar to Telegram Automation & FreeBusy Booking Webhook
 * Standalone Google Apps Script
 * 
 * Features:
 * 1. doPost Webhook:
 *    - 'freeBusy.query': Returns busy time blocks for the requested window so the backend can subtract them.
 *    - 'create_appointment': Inserts the event onto primary Google Calendar with Google Meet enabled, summary, description, and attendees.
 * 2. Background Calendar Scanner:
 *    - Periodically checks for direct calendar updates and sends Telegram alerts.
 */

// ==================== CONFIGURATION ====================
var TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN_HERE"; // From @BotFather
var TELEGRAM_CHAT_ID = "YOUR_TELEGRAM_CHAT_ID_HERE";     // From @userinfobot
// =======================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || "{}");
    var action = data.action;

    // A. freeBusy.query: Return busy blocks between timeMin and timeMax
    if (action === "freeBusy.query" || action === "get_busy_slots") {
      var calendar = CalendarApp.getDefaultCalendar();
      var now = new Date();
      var timeMin = data.timeMin ? new Date(data.timeMin) : now;
      var timeMax = data.timeMax ? new Date(data.timeMax) : new Date(now.getTime() + (15 * 24 * 60 * 60 * 1000));

      var events = calendar.getEvents(timeMin, timeMax);
      var busy = [];

      for (var i = 0; i < events.length; i++) {
        busy.push({
          start: events[i].getStartTime().toISOString(),
          end: events[i].getEndTime().toISOString()
        });
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 200,
        busy: busy
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // B. create_appointment: Structure and insert Google Calendar event with Google Meet
    if (action === "create_appointment") {
      var calendar = CalendarApp.getDefaultCalendar();

      var summary = data.summary || ("Meeting with " + (data.name || "Client"));
      var description = data.description || ("Client Email: " + (data.email || "") + "\nMessage: " + (data.message || ""));
      var clientEmail = data.email || (data.attendees && data.attendees[0] ? data.attendees[0].email : "");

      var startTime = data.start && data.start.dateTime ? new Date(data.start.dateTime) : new Date();
      var endTime = data.end && data.end.dateTime ? new Date(data.end.dateTime) : new Date(startTime.getTime() + (30 * 60 * 1000));

      // Create Calendar Event with email invitations
      var event = calendar.createEvent(summary, startTime, endTime, {
        description: description,
        guests: clientEmail,
        sendInvites: true
      });

      // Append row to Google Sheet
      try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getActiveSpreadsheet().getActiveSheet() : null;
        if (sheet) {
          sheet.insertRowBefore(2);
          sheet.getRange(2, 1, 1, 4).setValues([[
            new Date().toLocaleString(),
            data.name || clientEmail,
            clientEmail,
            "[Google Calendar Booking] " + summary + " (" + (data.clientFormattedTime || startTime.toUTCString()) + ")"
          ]]);
        }
      } catch (sheetErr) {
        Logger.log("Sheet logging note: " + sheetErr.toString());
      }

      // Track event ID to avoid duplicate notifications
      var userProps = PropertiesService.getUserProperties();
      var processedEventsJson = userProps.getProperty("NOTIFIED_CALENDAR_EVENTS");
      var processedEvents = processedEventsJson ? JSON.parse(processedEventsJson) : {};
      processedEvents[event.getId()] = new Date().toISOString();
      userProps.setProperty("NOTIFIED_CALENDAR_EVENTS", JSON.stringify(processedEvents));

      return ContentService.createTextOutput(JSON.stringify({
        status: 200,
        success: true,
        eventId: event.getId(),
        message: "Appointment confirmed and scheduled on Google Calendar!"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Default: Form Contact Submission logging
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
 * Background Scanner for Google Calendar
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
