"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Loader2, X } from "lucide-react";

// ── Contact endpoint (your own Google Apps Script) ───────────────────────
// Paste your deployed Apps Script Web app URL between the quotes below.
// (script.google.com → your project → Deploy → New deployment → Web app →
//  Execute as: Me → Who has access: Anyone → copy the /exec URL.)
// The ready-to-paste script lives at google-apps-script/ContactEndpoint.gs.
// Until the URL is set, the form shows a setup notice and submissions fail
// safely with a clear message.
const CONTACT_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxvutfkU4ZoOkaB9AmZ5cibrHOmXY1p7DDZqg1hekZ5ALqRZGvh-yr_cEzwIfGKT9hdKw/exec";

// Public reCAPTCHA v2 site key. The matching secret key belongs only inside
// the Apps Script, never in this code.
const RECAPTCHA_SITE_KEY = "6LfPoRkuAAAAAPFIinCD7IKyV0BqyODUI8wKxqyo";

// reCAPTCHA widget size for the key above. The current key is registered as
// a v2 "Invisible" key, so it MUST render with size "invisible": verification
// runs automatically when the visitor submits (Google shows a challenge only
// to suspicious traffic) and the "protected by reCAPTCHA" badge shows inline.
// If the key is ever replaced with a v2 "I'm not a robot" Checkbox key,
// change this to "normal" to get the visible checkbox + pre-submit gate.
const RECAPTCHA_SIZE = "invisible";
const IS_INVISIBLE = RECAPTCHA_SIZE !== "normal";

const ENDPOINT_CONFIGURED = !CONTACT_ENDPOINT.includes(
  "AKfycby2cB5tqFi2tmcIf37ZcI7zU0FExQwxnaTUpC8I2qGs"
);

function ContactForm() {
  const formRef = useRef(null);
  const captchaRef = useRef(null);
  const widgetIdRef = useRef(null);
  const tokenResolveRef = useRef(null);
  const tokenRejectRef = useRef(null);
  const [verified, setVerified] = useState(false); // checkbox mode: ticked
  const [widgetReady, setWidgetReady] = useState(false); // widget rendered
  const [widgetError, setWidgetError] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "success" | "error", text, detail }

  useEffect(() => {
    let cancelled = false;
    let polls = 0;
    let readyQueued = false;

    const onToken = (token) => {
      if (IS_INVISIBLE) {
        if (tokenResolveRef.current) {
          tokenResolveRef.current(token);
          tokenResolveRef.current = null;
          tokenRejectRef.current = null;
        }
      } else {
        setVerified(true);
        setNotice(null);
      }
    };
    const onExpired = () => {
      if (IS_INVISIBLE) {
        if (tokenRejectRef.current) {
          tokenRejectRef.current(new Error("expired"));
          tokenResolveRef.current = null;
          tokenRejectRef.current = null;
        }
      } else {
        setVerified(false);
      }
    };

    const renderWidget = () => {
      if (cancelled || widgetIdRef.current !== null || !captchaRef.current) return true;
      const api = window.grecaptcha;
      // api.js is only a bootstrap script: grecaptcha.render() exists only
      // after the real implementation loads from gstatic, later.
      if (!api || typeof api.render !== "function") return false;
      try {
        widgetIdRef.current = api.render(captchaRef.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          size: RECAPTCHA_SIZE,
          badge: IS_INVISIBLE ? "inline" : undefined,
          theme: "dark",
          callback: onToken,
          "expired-callback": onExpired,
          "error-callback": onExpired,
        });
        setWidgetReady(true);
        setWidgetError(false);
      } catch {
        // render() threw (bad key type/domain shows Google's own error box;
        // anything else must be visible, never silent)
        setWidgetError(true);
      }
      return true;
    };

    const waitAndRender = () => {
      if (cancelled) return;
      const api = window.grecaptcha;
      // grecaptcha.ready() queues the callback until the full widget code has
      // loaded — the officially supported way to know render() is available.
      if (api && typeof api.ready === "function" && !readyQueued) {
        readyQueued = true;
        api.ready(() => {
          if (!cancelled) renderWidget();
        });
      }
      if (!renderWidget()) {
        polls += 1;
        if (polls <= 24) setTimeout(waitAndRender, 250); // safety net, ~6s
      }
    };

    const onError = () => {
      // Only warn when nothing rendered — a script error must never paint a
      // warning next to an already-working widget (e.g. grecaptcha provided
      // by an earlier/other copy of the script).
      if (!cancelled && widgetIdRef.current === null) setWidgetError(true);
    };

    const id = "vkj-recaptcha-api";
    let script = document.getElementById(id);
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", waitAndRender);
    script.addEventListener("error", onError);
    waitAndRender(); // also covers the "script already loaded" case

    // Never leave a silent empty slot: if nothing rendered after 8s, say why.
    // Deliberately NOT cancelled on unmount — if the form remounts (page churn),
    // this must still fire instead of being silently reset every time.
    setTimeout(() => {
      if (widgetIdRef.current === null) setWidgetError(true);
    }, 8000);

    return () => {
      cancelled = true;
      script.removeEventListener("load", waitAndRender);
      script.removeEventListener("error", onError);
    };
  }, []);

  // Returns a reCAPTCHA token: instantly for a completed checkbox, or after
  // Google's (usually invisible) challenge for the invisible widget.
  const requestToken = () =>
    new Promise((resolve, reject) => {
      const api = window.grecaptcha;
      if (!api || widgetIdRef.current === null) {
        reject(new Error("reCAPTCHA not ready"));
        return;
      }
      if (!IS_INVISIBLE) {
        const token = api.getResponse(widgetIdRef.current);
        if (token) resolve(token);
        else reject(new Error("not verified"));
        return;
      }
      tokenResolveRef.current = resolve;
      tokenRejectRef.current = reject;
      try {
        api.execute(widgetIdRef.current);
      } catch (error) {
        tokenResolveRef.current = null;
        tokenRejectRef.current = null;
        reject(error);
      }
    });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;

    if (!IS_INVISIBLE && !verified) {
      setNotice({
        type: "error",
        text: "Please complete the reCAPTCHA verification.",
      });
      return;
    }
    if (IS_INVISIBLE && widgetIdRef.current === null) {
      setNotice({
        type: "error",
        text: "reCAPTCHA is still loading — please try again in a moment.",
      });
      return;
    }

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    delete values["g-recaptcha-response"];

    setSending(true);
    setNotice(null);

    let token = "";
    try {
      token = await requestToken();
    } catch {
      setSending(false);
      if (!IS_INVISIBLE) setVerified(false);
      setNotice({
        type: "error",
        text: "reCAPTCHA verification failed — please try again.",
      });
      return;
    }

    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          firstname: values.firstname || "",
          lastname: values.lastname || "",
          tel: values.tel || "",
          email: values.email || "",
          subject: values.subject || "",
          message: values.message || "",
          recaptchaToken: token,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.ok) {
        setNotice({
          type: "success",
          text: "Message sent successfully!",
          detail: "Thank you for reaching out — a reply will be on its way soon.",
        });
        form.reset();
        setVerified(false);
        if (window.grecaptcha && widgetIdRef.current !== null) {
          window.grecaptcha.reset(widgetIdRef.current);
        }
      } else {
        setNotice({
          type: "error",
          text: "Message not sent — please try again.",
        });
      }
    } catch {
      setNotice({
        type: "error",
        text: ENDPOINT_CONFIGURED
          ? "Message not sent — please check your connection and try again."
          : "Form endpoint not configured yet — add your Apps Script URL to CONTACT_ENDPOINT in ContactForm.jsx.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form ref={formRef} name="contact" onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Your First Name"
          name="firstname"
          required
          className="w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,33,.96),rgba(16,22,45,.76))] px-5 py-4 text-white outline-none placeholder:text-slate-400 focus:border-violet-400/60 focus:shadow-[0_0_0_1px_rgba(167,139,250,.2),0_0_26px_rgba(99,102,241,.18)]"
        />
        <input
          type="text"
          placeholder="Your Last Name"
          name="lastname"
          required
          className="w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,33,.96),rgba(16,22,45,.76))] px-5 py-4 text-white outline-none placeholder:text-slate-400 focus:border-violet-400/60 focus:shadow-[0_0_0_1px_rgba(167,139,250,.2),0_0_26px_rgba(99,102,241,.18)]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <input
          type="tel"
          placeholder="Phone Number"
          name="tel"
          className="w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,33,.96),rgba(16,22,45,.76))] px-5 py-4 text-white outline-none placeholder:text-slate-400 focus:border-violet-400/60 focus:shadow-[0_0_0_1px_rgba(167,139,250,.2),0_0_26px_rgba(99,102,241,.18)]"
        />
        <input
          type="email"
          placeholder="Your Email"
          name="email"
          required
          className="w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,33,.96),rgba(16,22,45,.76))] px-5 py-4 text-white outline-none placeholder:text-slate-400 focus:border-violet-400/60 focus:shadow-[0_0_0_1px_rgba(167,139,250,.2),0_0_26px_rgba(99,102,241,.18)]"
        />
      </div>

      <input
        type="text"
        placeholder="Subject"
        name="subject"
        className="w-full rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,33,.96),rgba(16,22,45,.76))] px-5 py-4 text-white outline-none placeholder:text-slate-400 focus:border-violet-400/60 focus:shadow-[0_0_0_1px_rgba(167,139,250,.2),0_0_26px_rgba(99,102,241,.18)]"
      />

      <textarea
        name="message"
        rows={5}
        placeholder="Type your message"
        className="w-full resize-none rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,33,.96),rgba(16,22,45,.76))] px-5 py-4 text-white outline-none placeholder:text-slate-400 focus:border-violet-400/60 focus:shadow-[0_0_0_1px_rgba(167,139,250,.2),0_0_26px_rgba(99,102,241,.18)]"
      />

      {/* reCAPTCHA verification (invisible key → inline badge + auto check) */}
      <div className="flex flex-col items-start gap-3">
        <div ref={captchaRef} className="min-h-[78px]" />
        {widgetError ? (
          <p className="text-sm text-amber-300/90">
            reCAPTCHA could not load — it may be blocked by your network or an
            ad blocker, or the site key may be invalid. Please refresh the page
            or try another network.
          </p>
        ) : null}
        {!ENDPOINT_CONFIGURED ? (
          <p className="text-sm text-slate-400">
            Setup notice: add your Apps Script Web app URL to CONTACT_ENDPOINT in
            ContactForm.jsx to enable sending.
          </p>
        ) : null}
      </div>

      {/* notification (success / error) */}
      <div aria-live="polite">
        {notice ? (
          <div
            className={
              notice.type === "success"
                ? "flex items-start gap-3 rounded-2xl border border-green-400/30 bg-[linear-gradient(180deg,rgba(6,28,18,.92),rgba(10,38,26,.72))] px-5 py-4"
                : "flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-[linear-gradient(180deg,rgba(38,10,22,.92),rgba(52,14,30,.72))] px-5 py-4"
            }
          >
            {notice.type === "success" ? (
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#22ff5e]" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            )}
            <div className="flex-1">
              <p
                className={
                  notice.type === "success"
                    ? "text-sm font-semibold text-green-200"
                    : "text-sm font-semibold text-rose-200"
                }
              >
                {notice.text}
              </p>
              {notice.detail ? (
                <p className="mt-1 text-sm text-green-200/80">{notice.detail}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
              className="text-slate-400 transition hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={sending || (IS_INVISIBLE ? !widgetReady : !verified)}
          className="inline-flex items-center justify-center rounded-2xl border border-violet-300/20 bg-[linear-gradient(135deg,#5464ff_0%,#7d6dff_35%,#de6bc6_100%)] px-8 py-4 text-base font-semibold text-white shadow-[0_12px_34px_rgba(108,92,255,.45),0_0_22px_rgba(113,130,255,.38)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          {sending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          {sending ? "Sending..." : "Send Message"}
        </button>
      </div>
    </form>
  );
}

export default ContactForm;
