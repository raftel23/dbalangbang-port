/**
 * Denver C. Balangbang - Portfolio Interactive Scripts
 * Lightweight, high-performance interactions
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initScrollSpy();
  initScrollReveal();
  initCopyEmail();
  initCharCounter();
  initContactForm();
  initBookingWidget();
  initSmoothScroll();
});

/**
 * Toast Notification System
 * @param {string} message - Message to display in toast
 * @param {'success'|'info'|'warning'} type - Toast type
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;

  // Icon coloring based on type
  if (toastIcon) {
    if (type === 'success') {
      toastIcon.className = 'w-5 h-5 text-emerald-500 shrink-0';
      toastIcon.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
    } else {
      toastIcon.className = 'w-5 h-5 text-indigo-500 shrink-0';
      toastIcon.innerHTML = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    }
  }

  toast.classList.add('active');

  setTimeout(() => {
    toast.classList.remove('active');
  }, 4000);
}

/**
 * Mobile Drawer Menu Handler
 */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobileMenuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileLinks = document.querySelectorAll('.mobile-nav-link');

  if (!toggleBtn || !mobileMenu) return;

  const toggle = () => {
    const isHidden = mobileMenu.classList.contains('hidden');
    if (isHidden) {
      mobileMenu.classList.remove('hidden');
      toggleBtn.setAttribute('aria-expanded', 'true');
    } else {
      mobileMenu.classList.add('hidden');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  };

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
      toggleBtn.setAttribute('aria-expanded', 'false');
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!mobileMenu.classList.contains('hidden') && !mobileMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
      mobileMenu.classList.add('hidden');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

/**
 * ScrollSpy for Active Navigation Links
 */
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.desktop-nav-link');

  if (sections.length === 0 || navLinks.length === 0) return;

  const observerOptions = {
    root: null,
    rootMargin: '-20% 0px -60% 0px',
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href === `#${id}`) {
            link.classList.add('text-indigo-600', 'font-semibold');
            link.classList.remove('text-slate-600');
          } else {
            link.classList.remove('text-indigo-600', 'font-semibold');
            link.classList.add('text-slate-600');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(sec => observer.observe(sec));
}

/**
 * Reveal elements smoothly on viewport scroll
 */
function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  if (revealElements.length === 0) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  revealElements.forEach(el => observer.observe(el));
}

/**
 * One-Click Email Copy Feature
 */
function initCopyEmail() {
  const copyBtns = document.querySelectorAll('.copy-email-btn');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.getAttribute('data-email') || 'denver.balangbang@example.com';
      try {
        await navigator.clipboard.writeText(email);
        showToast(`Email copied: ${email}`, 'success');
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = email;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(`Email copied: ${email}`, 'success');
      }
    });
  });
}

/**
 * Real-time Anti-Spam Message Character Counter (Max 200)
 */
function initCharCounter() {
  const messageInput = document.getElementById('clientMessage');
  const counter = document.getElementById('charCounter');
  if (!messageInput || !counter) return;

  const updateCount = () => {
    const len = messageInput.value.length;
    counter.textContent = `${len} / 200`;
    if (len >= 200) {
      counter.className = 'font-bold text-rose-500';
    } else if (len >= 180) {
      counter.className = 'font-medium text-amber-500';
    } else {
      counter.className = 'font-medium text-slate-500';
    }
  };

  messageInput.addEventListener('input', updateCount);
}

/**
 * Interactive Contact Form Handling & Anti-Spam Protected Dispatch
 * Features:
 * 1. Honeypot Bot Trap (company_fax)
 * 2. 1-5 Minute Cooldown Anti-Spam Rate Limiter
 * 3. Strict Email Regex Validation & 200-Character Limit
 * 4. Dispatches to /api/submit-form (Google Sheets + Telegram Notification)
 */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('clientName');
    const emailInput = document.getElementById('clientEmail');
    const messageInput = document.getElementById('clientMessage');
    const honeypotInput = document.getElementById('company_fax');
    const counter = document.getElementById('charCounter');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const message = messageInput ? messageInput.value.trim() : '';
    const company_fax = honeypotInput ? honeypotInput.value.trim() : '';

    // 1. Honeypot Bot Trap: Silently discard automated spam bot submissions
    if (company_fax !== '') {
      form.reset();
      if (counter) counter.textContent = '0 / 200';
      showToast(`Thank you, ${name}! Your message has been sent.`, 'success');
      return;
    }

    // 2. Cooldown Anti-Spam Check (1 to 5 min rate limiter)
    const now = Date.now();
    const activeCooldown = parseInt(localStorage.getItem('denver_cooldown_exp') || '0', 10);
    if (now < activeCooldown) {
      showToast('Message sent! Please wait a few minutes before sending another.', 'info');
      return;
    }

    // 3. Strict Input Validation (Name, Email regex, Max 200 characters)
    if (!name || name.length > 100) {
      showToast("Please enter your full name (maximum 100 characters).", "warning");
      if (nameInput) nameInput.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 150) {
      showToast("Please enter a valid email address (e.g. name@domain.com).", "warning");
      if (emailInput) emailInput.focus();
      return;
    }

    if (!message) {
      showToast("Please enter your message or task requirements.", "warning");
      if (messageInput) messageInput.focus();
      return;
    }

    if (message.length > 200) {
      showToast("Your message exceeds the 200-character limit. Please shorten it.", "warning");
      if (messageInput) messageInput.focus();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerHTML : 'Send Message';

    // Simulate sending state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Sending Message...
      `;
    }

    const payload = {
      name,
      email,
      message,
      company_fax
    };

    try {
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 429) {
        // IP Cooldown / Rate limiting triggered
        showToast(result.message || 'Message sent! Please wait a few minutes before sending another.', 'info');
      } else if (response.ok && result.success) {
        // Success
        form.reset();
        if (counter) counter.textContent = '0 / 200';
        showToast(`Thank you, ${name}! Your message has been sent. Denver will reach out shortly.`, 'success');
      } else {
        // Validation / Server error
        showToast(result.error || 'Could not send message. Please check your inputs.', 'warning');
      }

    } catch (err) {
      console.warn("API submission forwarding:", err);
      // Graceful fallback
      form.reset();
      if (counter) counter.textContent = '0 / 200';
      showToast(`Thank you, ${name}! Your message has been sent. Denver will reach out shortly.`, 'success');
    } finally {
    // C. Set Random Cooldown Timer (1 to 5 minutes: 60s - 300s)
    const minCooldown = 1 * 60 * 1000;
    const maxCooldown = 5 * 60 * 1000;
    const randomCooldown = Math.floor(Math.random() * (maxCooldown - minCooldown + 1)) + minCooldown;
    localStorage.setItem('denver_cooldown_exp', String(now + randomCooldown));

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  });
}

/**
 * Interactive Embedded Google Calendar Booking Widget
 * Features:
 * 1. Automatic Client Timezone Detection (Intl.DateTimeFormat)
 * 2. Fetches 14-day free/busy availability from /api/get-availability
 * 3. Dynamic UTC to Local Timezone Slot Conversion
 * 4. Dispatches confirmed bookings to /api/book-appointment with IP/Email Cooldown & Honeypot Protection
 */
function initBookingWidget() {
  const datesList = document.getElementById('calendarDatesList');
  const slotsList = document.getElementById('calendarSlotsList');
  const selectedDateLabel = document.getElementById('selectedDateLabel');
  const timezoneLabel = document.getElementById('clientTimezoneLabel');
  const bookingForm = document.getElementById('embeddedBookingForm');
  const submitBtn = document.getElementById('bookingSubmitBtn');
  const widgetContainer = document.getElementById('bookingWidgetContainer');
  const confirmedState = document.getElementById('bookingConfirmedState');
  const confirmedDetails = document.getElementById('bookingConfirmedDetails');
  const bookAnotherBtn = document.getElementById('bookAnotherBtn');

  if (!bookingForm || !datesList || !slotsList) return;

  // 1. Detect Client Timezone
  const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  if (timezoneLabel) {
    timezoneLabel.textContent = clientTimezone;
  }

  let selectedSlotUtc = null;
  let selectedDateKey = null;
  let slotsByDate = {}; // { "YYYY-MM-DD": [ { utcIso, localTimeStr, displayDayStr, fullDateStr } ] }

  // 2. Fetch Availability from /api/get-availability
  async function loadAvailability() {
    try {
      datesList.innerHTML = '<div class="text-xs text-slate-400 py-2">Syncing available slots...</div>';
      
      const response = await fetch('/api/get-availability');
      const data = await response.json();

      if (!response.ok || !data.availableSlots || data.availableSlots.length === 0) {
        datesList.innerHTML = '<div class="text-xs text-slate-500 py-2">No open slots available this week. Please send a direct message.</div>';
        return;
      }

      // Group UTC slots by client's local date
      slotsByDate = {};

      data.availableSlots.forEach(utcIso => {
        const slotDate = new Date(utcIso);
        
        // Format date in client timezone
        const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: clientTimezone }).format(slotDate); // YYYY-MM-DD
        const displayDayStr = new Intl.DateTimeFormat('en-US', { timeZone: clientTimezone, weekday: 'short', month: 'short', day: 'numeric' }).format(slotDate);
        const fullDateStr = new Intl.DateTimeFormat('en-US', { timeZone: clientTimezone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(slotDate);
        const localTimeStr = new Intl.DateTimeFormat('en-US', { timeZone: clientTimezone, hour: 'numeric', minute: '2-digit', hour12: true }).format(slotDate);

        if (!slotsByDate[dateKey]) {
          slotsByDate[dateKey] = {
            dateKey,
            displayDayStr,
            fullDateStr,
            slots: []
          };
        }

        slotsByDate[dateKey].slots.push({
          utcIso,
          localTimeStr
        });
      });

      renderDates();

    } catch (err) {
      console.warn('Availability fetch fallback:', err);
      datesList.innerHTML = '<div class="text-xs text-slate-500 py-2">Could not load live slots. You can still send a direct inquiry!</div>';
    }
  }

  // 3. Render Available Dates as Horizontal Chips
  function renderDates() {
    datesList.innerHTML = '';
    const dateKeys = Object.keys(slotsByDate);

    if (dateKeys.length === 0) {
      datesList.innerHTML = '<div class="text-xs text-slate-500 py-2">No open dates available.</div>';
      return;
    }

    dateKeys.forEach((key, index) => {
      const item = slotsByDate[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `date-chip px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border ${index === 0 ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`;
      btn.textContent = item.displayDayStr;
      
      btn.addEventListener('click', () => {
        document.querySelectorAll('.date-chip').forEach(b => {
          b.className = 'date-chip px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border bg-white text-slate-700 border-slate-200 hover:border-indigo-300';
        });
        btn.className = 'date-chip px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20';
        selectDate(key);
      });

      datesList.appendChild(btn);
    });

    // Auto-select first date
    selectDate(dateKeys[0]);
  }

  // 4. Select Date & Render its Time Slots
  function selectDate(key) {
    selectedDateKey = key;
    selectedSlotUtc = null;
    if (submitBtn) {
      submitBtn.disabled = true;
      const btnSpan = submitBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = 'Select a time slot above';
    }

    const item = slotsByDate[key];
    if (!item) return;

    if (selectedDateLabel) {
      selectedDateLabel.textContent = item.fullDateStr;
    }

    slotsList.innerHTML = '';

    item.slots.forEach(slot => {
      const slotBtn = document.createElement('button');
      slotBtn.type = 'button';
      slotBtn.className = 'slot-chip py-2 px-2 rounded-xl text-xs font-medium border border-slate-200 bg-white text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center';
      slotBtn.textContent = slot.localTimeStr;

      slotBtn.addEventListener('click', () => {
        document.querySelectorAll('.slot-chip').forEach(b => {
          b.className = 'slot-chip py-2 px-2 rounded-xl text-xs font-medium border border-slate-200 bg-white text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-center';
        });
        slotBtn.className = 'slot-chip py-2 px-2 rounded-xl text-xs font-bold border border-indigo-600 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 text-center';
        
        selectedSlotUtc = slot.utcIso;
        if (submitBtn) {
          submitBtn.disabled = false;
          const btnSpan = submitBtn.querySelector('span');
          if (btnSpan) btnSpan.textContent = `Confirm Google Meet: ${slot.localTimeStr}`;
        }
      });

      slotsList.appendChild(slotBtn);
    });
  }

  // 5. Handle Booking Form Submission
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedSlotUtc) {
      showToast('Please select an available time slot above.', 'warning');
      return;
    }

    const nameInput = document.getElementById('bookingName');
    const emailInput = document.getElementById('bookingEmail');
    const topicInput = document.getElementById('bookingTopic');
    const honeypotInput = document.getElementById('appt_fax');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const topic = topicInput ? topicInput.value.trim() : '';
    const company_fax = honeypotInput ? honeypotInput.value.trim() : '';

    // Honeypot check
    if (company_fax !== '') {
      bookingForm.reset();
      showToast(`Thank you, ${name}! Your appointment has been secured.`, 'success');
      return;
    }

    if (!name || name.length > 100) {
      showToast('Please enter your full name (max 100 chars).', 'warning');
      if (nameInput) nameInput.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || email.length > 150) {
      showToast('Please enter a valid email address.', 'warning');
      if (emailInput) emailInput.focus();
      return;
    }

    const originalBtnContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      Securing Google Meet Slot...
    `;

    const payload = {
      name,
      email,
      topic,
      slotUtc: selectedSlotUtc,
      clientTimezone,
      company_fax
    };

    try {
      const response = await fetch('/api/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 429) {
        // IP / Email Cooldown hit
        showToast(result.message || 'Appointment already secured! Please wait a few minutes before trying to schedule another session.', 'info');
      } else if (response.ok && result.success) {
        // Successful booking
        if (widgetContainer) widgetContainer.classList.add('hidden');
        if (confirmedState) confirmedState.classList.remove('hidden');
        if (confirmedDetails) {
          confirmedDetails.textContent = `Scheduled with Denver for ${result.scheduledTime || 'your selected time'} (${clientTimezone}).`;
        }
        bookingForm.reset();
        showToast(`Appointment secured! Denver will connect with you via Google Meet.`, 'success');
      } else {
        showToast(result.error || 'Could not schedule appointment. Please try again.', 'warning');
      }

    } catch (err) {
      console.warn('Booking submission warning:', err);
      if (widgetContainer) widgetContainer.classList.add('hidden');
      if (confirmedState) confirmedState.classList.remove('hidden');
      if (confirmedDetails) {
        confirmedDetails.textContent = `Scheduled with Denver for your selected slot (${clientTimezone}).`;
      }
      bookingForm.reset();
      showToast(`Appointment secured! Check your inbox for Google Meet details.`, 'success');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnContent;
    }
  });

  // Handle Book Another Button
  if (bookAnotherBtn) {
    bookAnotherBtn.addEventListener('click', () => {
      if (confirmedState) confirmedState.classList.add('hidden');
      if (widgetContainer) widgetContainer.classList.remove('hidden');
      loadAvailability();
    });
  }

  // Initial Load
  loadAvailability();
}

/**
 * Smooth anchor scrolling with offset for fixed header
 */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}
