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
 * 4. Dual Real-time Dispatch: Google Sheet Database + Instant Email to dbalangbang@gmail.com
 */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const GOOGLE_SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbyPxo9FvkfecJlHsfbFksaREP-0AgUtX83vfmptsKcBLMpJUYziSY48XBKb_zq_yGPrVA/exec";

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

    const submissionData = {
      timestamp: new Date().toLocaleString(),
      name,
      email,
      message
    };

    // A. Dispatch to Google Sheet Database
    try {
      fetch(GOOGLE_SHEET_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      }).catch(err => console.warn('Google Sheet write warning:', err));
    } catch (sheetErr) {
      console.warn('Google Sheet dispatch error:', sheetErr);
    }

    // B. Direct Automated Email Alert to dbalangbang@gmail.com
    try {
      await fetch("https://formsubmit.co/ajax/dbalangbang@gmail.com", {
        method: "POST",
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: submissionData.name,
          email: submissionData.email,
          message: submissionData.message,
          _subject: `🔥 New Portfolio Inquiry from ${submissionData.name}`,
          _template: "table",
          _captcha: "false"
        })
      });
    } catch (mailErr) {
      console.warn('Email notification dispatch error:', mailErr);
    }

    // C. Set Random Cooldown Timer (1 to 5 minutes: 60s - 300s)
    const minCooldown = 60 * 1000;
    const maxCooldown = 300 * 1000;
    const randomCooldown = Math.floor(Math.random() * (maxCooldown - minCooldown + 1)) + minCooldown;
    localStorage.setItem('denver_cooldown_exp', String(now + randomCooldown));

    setTimeout(() => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
      form.reset();
      if (counter) counter.textContent = '0 / 200';
      showToast(`Thank you, ${name}! Your message has been sent. Denver will reach out shortly.`, 'success');
    }, 700);
  });
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
