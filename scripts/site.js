const SUPABASE_URL = "https://YOUR-SUPABASE-URL.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const QUESTION_CACHE_KEY = "dee_perfect_question_cache";
const OUTBOX_CACHE_KEY = "dee_perfect_question_outbox";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function isOnline() {
  return navigator.onLine;
}

function getCachedQuestions() {
  const raw = localStorage.getItem(QUESTION_CACHE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveQuestionsToCache(questions) {
  if (!Array.isArray(questions)) {
    return;
  }
  localStorage.setItem(QUESTION_CACHE_KEY, JSON.stringify(questions));
}

function getOfflineOutbox() {
  const raw = localStorage.getItem(OUTBOX_CACHE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveOfflineOutbox(items) {
  if (!Array.isArray(items)) {
    return;
  }
  localStorage.setItem(OUTBOX_CACHE_KEY, JSON.stringify(items));
}

function clearOfflineOutbox() {
  localStorage.removeItem(OUTBOX_CACHE_KEY);
}

async function fetchQuestionsFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn(
      "Supabase credentials are missing. Using cached questions when available.",
    );
    return getCachedQuestions();
  }

  const { data, error } = await supabase.from("questions").select("*");

  if (error) {
    console.error("Failed to fetch questions from Supabase:", error);
    return getCachedQuestions();
  }

  if (Array.isArray(data)) {
    saveQuestionsToCache(data);
    return data;
  }

  return getCachedQuestions();
}

async function loadQuestions() {
  if (isOnline()) {
    const questions = await fetchQuestionsFromSupabase();
    if (questions.length) {
      return questions;
    }
  }

  return getCachedQuestions();
}

function saveQuestionOffline(question) {
  if (!question || typeof question !== "object") {
    return;
  }
  const cached = getCachedQuestions();
  cached.push(question);
  saveQuestionsToCache(cached);

  const outbox = getOfflineOutbox();
  outbox.push(question);
  saveOfflineOutbox(outbox);
}

async function syncOfflineQuestions() {
  if (!isOnline()) {
    console.info("Cannot sync while offline.");
    return;
  }

  const outbox = getOfflineOutbox();
  if (!outbox.length) {
    return;
  }

  const { error } = await supabase.from("questions").insert(outbox);
  if (error) {
    console.error("Failed to sync cached questions to Supabase:", error);
    return;
  }

  clearOfflineOutbox();
  console.info("Cached questions synchronized to Supabase.");
}

async function signInUser(email, password) {
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    throw error;
  }

  return data.user;
}

async function signUpUser(fullName, email, password, role = "student") {
  if (!fullName || !email || !password) {
    throw new Error("Name, email, and password are required.");
  }

  const { data, error } = await supabase.auth.signUp(
    { email, password },
    {
      data: {
        full_name: fullName,
        role,
      },
    },
  );

  if (error) {
    throw error;
  }

  return data.user;
}

function redirectToDashboard(role = "student") {
  const page =
    role === "admin"
      ? "admin-dashboard.html"
      : role === "teacher"
        ? "teacher-dashboard.html"
        : "student-dashboard.html";

  window.location.href = page;
}

function showNotification(message, type = "info") {
  console.log(`${type.toUpperCase()}: ${message}`);
}

window.addEventListener("online", async () => {
  showNotification("Connection restored. Syncing cached questions.");
  await syncOfflineQuestions();
  await fetchQuestionsFromSupabase();
});

window.addEventListener("offline", () => {
  showNotification("Offline mode enabled. Using cached questions.");
});

function attachAuthHandlers() {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("login-email")?.value.trim();
      const password = document.getElementById("login-password")?.value;

      try {
        const user = await signInUser(email, password);
        showNotification("Login successful. Redirecting...");
        const role = user?.user_metadata?.role || "student";
        redirectToDashboard(role);
      } catch (err) {
        showNotification(err.message || "Login failed.", "error");
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const fullName = document.getElementById("signup-name")?.value.trim();
      const email = document.getElementById("signup-email")?.value.trim();
      const password = document.getElementById("signup-password")?.value;
      const confirmPassword = document.getElementById(
        "signup-confirm-password",
      )?.value;

      if (password !== confirmPassword) {
        showNotification("Passwords do not match.", "error");
        return;
      }

      try {
        await signUpUser(fullName, email, password, "student");
        showNotification(
          "Account created. Please verify your email and sign in.",
        );
      } catch (err) {
        showNotification(err.message || "Sign up failed.", "error");
      }
    });
  }
}

function initSiteNavigation() {
  const navLinks = document.querySelectorAll("[data-link-page]");
  navLinks.forEach((link) => {
    const page = link.getAttribute("data-link-page");
    if (page) {
      link.href = page;
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  attachAuthHandlers();
  initSiteNavigation();
});
