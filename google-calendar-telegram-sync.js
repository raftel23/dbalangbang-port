/**
 * Google Calendar to Telegram Automation (Standalone Google Apps Script)
 * 
 * Instructions:
 * 1. Go to https://script.google.com and click "New Project".
 * 2. Paste this entire script into the editor.
 * 3. Fill in your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID below.
 * 4. Run the "testTelegramAlert" function once to verify your bot sends you a message.
 * 5. Set up an automatic Time-driven trigger (Runs every 5-10 minutes) as detailed in the instructions.
 */

// ==================== CONFIGURATION ====================
var TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN_HERE"; // e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
var TELEGRAM_CHAT_ID = "YOUR_TELEGRAM_CHAT_ID_HERE";     // e.g. 987654321 or @your_channel
// =======================================================

/**
 * Main function that checks for new calendar appointments and sends Telegram alerts.
 * Trigger this function every 5-10 minutes.
 */
function checkNewCalendarAppointments() {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN_HERE") {
    Logger.log("Error: TELEGRAM_BOT_TOKEN is not configured.");
    return;
  }

  var calendar = CalendarApp.getDefaultCalendar();
  var now = new Date();
  // Look for appointments from now up to 30 days ahead
  var futureLimit = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  var events = calendar.getEvents(now, futureLimit);

  var userProperties = PropertiesService.getUserProperties();
  var processedEventsJson = userProperties.getProperty("NOTIFIED_CALENDAR_EVENTS");
  var processedEvents = processedEventsJson ? JSON.parse(processedEventsJson) : {};

  var newEventCount = 0;

  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    var eventId = event.getId();

    // Check if we've already notified for this event
    if (!processedEvents[eventId]) {
      var title = event.getTitle() || "Strategy Session / Meeting";
      var startTime = event.getStartTime();
      var endTime = event.getEndTime();
      var description = event.getDescription() || "No additional notes provided.";
      var location = event.getLocation() || "";

      // Extract guest emails if available
      var guests = event.getGuestList();
      var guestEmails = [];
      for (var g = 0; g < guests.length; g++) {
        guestEmails.push(guests[g].getEmail());
      }
      var guestListStr = guestEmails.length > 0 ? guestEmails.join(", ") : "Direct Booking";

      // Format clean dates
      var timeZone = Session.getScriptTimeZone();
      var formattedDate = Utilities.formatDate(startTime, timeZone, "EEEE, MMM d, yyyy");
      var formattedStartTime = Utilities.formatDate(startTime, timeZone, "hh:mm a");
      var formattedEndTime = Utilities.formatDate(endTime, timeZone, "hh:mm a");

      // Build clean Telegram message
      var msg = "📅 <b>New Appointment Scheduled on Google Calendar!</b>\n\n" +
                "📌 <b>Event:</b> " + escapeHtml(title) + "\n" +
                "🗓️ <b>Date:</b> " + formattedDate + "\n" +
                "⏰ <b>Time:</b> " + formattedStartTime + " - " + formattedEndTime + " (" + timeZone + ")\n" +
                "👤 <b>Attendee(s):</b> " + escapeHtml(guestListStr) + "\n";

      if (location) {
        msg += "📍 <b>Meeting Link/Location:</b> " + escapeHtml(location) + "\n";
      }

      msg += "\n✨ <i>Automated Google Calendar Alert</i>";

      // Send to Telegram
      var success = sendTelegramMessage(msg);
      if (success) {
        processedEvents[eventId] = new Date().toISOString();
        newEventCount++;
      }
    }
  }

  // Save updated processed events list
  userProperties.setProperty("NOTIFIED_CALENDAR_EVENTS", JSON.stringify(processedEvents));
  Logger.log("Scan complete. Sent alerts for " + newEventCount + " new appointments.");
}

/**
 * Sends HTML formatted message to Telegram Bot API
 */
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
    var resCode = response.getResponseCode();
    if (resCode === 200) {
      return true;
    } else {
      Logger.log("Telegram API Error (" + resCode + "): " + response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log("UrlFetchApp Exception: " + e.toString());
    return false;
  }
}

/**
 * One-click test function to verify Telegram Bot credentials
 */
function testTelegramAlert() {
  var testMsg = "✅ <b>Telegram Bot Connected Successfully!</b>\n\n" +
                "Your Google Calendar is ready to deliver real-time appointment alerts to this chat.";
  var result = sendTelegramMessage(testMsg);
  if (result) {
    Logger.log("Test message sent successfully!");
  } else {
    Logger.log("Failed to send test message. Check your Token and Chat ID.");
  }
}

/**
 * Escapes HTML characters for Telegram parse_mode: HTML
 */
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
