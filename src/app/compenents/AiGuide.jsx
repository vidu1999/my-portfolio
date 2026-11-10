'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Portfolio AI Guide — floating "Ask AI" button + glass chat panel.
 *
 * A visitor asks for something ("Show me your projects", "How can I contact
 * you?"), the assistant recognises the intent and navigates to the matching
 * portfolio page. Styling follows the site's own palette (--cyan:#76e6ff,
 * --cyan-2:#3eb7ff, glass panels, cyan glow) so it reads as part of the
 * portfolio, not as a bolted-on chatbot.
 *
 * Intent routing is keyword-based on purpose: no API keys, no external
 * service, nothing to leak on a static GitHub Pages deploy. Every intent maps
 * to a route that actually exists — the assistant can never send a visitor to
 * a made-up page. "Skills" deliberately routes to /about/, which hosts the
 * SkillsCard; there is no separate skills page and this module will not invent
 * one.
 *
 * z-index is 999 on purpose: below the projects PreviewModal (9999) and far
 * below the loading overlay (2147483000), so it never fights existing layers.
 */

// Baked in at build time ('' in dev, '/my-portfolio' in the GitHub Pages
// export). usePathname() includes it, the router strips it — so it has to be
// removed before comparing a pathname against a destination route.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const DESTINATIONS = [
  {
    id: 'skills',
    label: 'About',
    route: '/about',
    reply: "My skill set is on the About page — taking you there…",
    keywords: ['skill', 'skills', 'technology', 'technologies', 'stack', 'tech', 'programming', 'tools', 'framework', 'language', 'languages'],
  },
  {
    id: 'projects',
    label: 'Projects',
    route: '/projects',
    reply: 'Sure! Taking you to the Projects page…',
    keywords: ['project', 'projects', 'work', 'portfolio', 'apps', 'built', 'quickbite', 'snake', 'cricket', 'game', 'games'],
  },
  {
    id: 'about',
    label: 'About',
    route: '/about',
    reply: 'Sure! Taking you to the About page…',
    keywords: ['about', 'yourself', 'who are you', 'experience', 'background', 'story', 'education'],
  },
  {
    id: 'contact',
    label: 'Contact',
    route: '/contact',
    reply: 'Sure! Taking you to the Contact page…',
    keywords: ['contact', 'email', 'hire', 'reach', 'message', 'get in touch', 'touch', 'phone', 'call'],
  },
  {
    id: 'resume',
    label: 'Resume',
    route: '/resume',
    reply: 'Sure! Taking you to the Resume page…',
    keywords: ['resume', 'cv', 'curriculum'],
  },
  {
    id: 'home',
    label: 'Home',
    route: '/',
    reply: 'Sure! Taking you back to the home page…',
    keywords: ['home', 'homepage', 'start', 'main page', 'landing', 'begin'],
  },
];

const QUICK_QUESTIONS = [
  'Show me your projects',
  'What are your skills?',
  'Tell me about yourself',
  'How can I contact you?',
  'Show my resume',
];

const HELP_TEXT =
  'I can help you explore Home, About, Skills, Projects, Resume and Contact — those are the pages that exist here. Try asking me about one of them!';

export default function AiGuide() {
  const router = useRouter();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! 👋 I'm your portfolio assistant. Ask me about my projects, skills, experience or contact details.",
    },
  ]);

  const listRef = useRef(null);
  const navTimerRef = useRef(null);
  const closeTimerRef = useRef(null);

  // Clear any pending timers on unmount so they can never call setState on a
  // dead component.
  useEffect(() => () => {
    clearTimeout(navTimerRef.current);
    clearTimeout(closeTimerRef.current);
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isNavigating]);

  // Escape closes the panel.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  function sendMessage(value) {
    const question = value.trim();
    if (!question || isNavigating) return;

    // A new question supersedes any pending auto-close from a previous
    // navigation — the conversation is continuing, so keep the panel open.
    clearTimeout(closeTimerRef.current);

    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');

    const normalized = question.toLowerCase();
    const destination = DESTINATIONS.find((item) =>
      item.keywords.some((keyword) => normalized.includes(keyword))
    );

    if (!destination) {
      setMessages((prev) => [...prev, { role: 'assistant', text: HELP_TEXT }]);
      return;
    }

    // Already here — say so instead of reloading the page. Depending on the
    // router internals usePathname() may or may not include the basePath, so
    // strip it only when actually present — never blindly slice.
    let current = pathname || '/';
    if (basePath && current.startsWith(basePath)) current = current.slice(basePath.length) || '/';
    if (current !== '/') current = current.replace(/\/+$/, '');
    if (current === destination.route) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `You're already on the ${destination.label} page! Anything else?` },
      ]);
      return;
    }

    setMessages((prev) => [...prev, { role: 'assistant', text: destination.reply }]);
    setIsNavigating(true);

    // Small pause so the visitor reads the reply before the page changes.
    navTimerRef.current = setTimeout(() => {
      router.push(destination.route);
      // Navigation is done — release the input immediately so a follow-up
      // question can't be ignored while the panel winds down.
      setIsNavigating(false);
      // Close shortly after so the visitor lands on the destination page.
      closeTimerRef.current = setTimeout(() => setIsOpen(false), 700);
    }, 800);
  }

  return (
    <div className="fixed bottom-6 right-5 z-[999] flex flex-col items-end gap-3 sm:bottom-8 sm:right-8">
      {/* CHAT WINDOW */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Portfolio AI Guide"
          className="w-[min(92vw,390px)] overflow-hidden rounded-3xl border border-[#76e6ff]/30 bg-[#07111f]/90 shadow-[0_0_45px_rgba(118,230,255,0.18)] backdrop-blur-2xl"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#76e6ff]/40 bg-[#76e6ff]/10 text-2xl">
                🤖
              </div>
              <div>
                <h3 className="font-bold text-white">Portfolio AI Guide</h3>
                <p className="text-xs text-[#76e6ff]">● Online · Ready to help</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close AI assistant"
              className="rounded-full p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* MESSAGES */}
          <div
            ref={listRef}
            className="flex max-h-[330px] min-h-[190px] flex-col gap-3 overflow-y-auto p-4"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'rounded-br-sm bg-gradient-to-r from-[#3eb7ff] to-[#5f87ff] text-white'
                      : 'rounded-bl-sm border border-white/10 bg-white/[0.07] text-gray-200'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {isNavigating && (
              <p className="animate-pulse text-xs text-[#76e6ff]">
                Opening your requested page…
              </p>
            )}
          </div>

          {/* QUICK QUESTIONS */}
          {messages.length === 1 && (
            <div className="px-4 pb-3">
              <p className="mb-2 text-[10px] font-bold tracking-[0.2em] text-[#76e6ff]">
                TRY ASKING
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => sendMessage(question)}
                    className="rounded-full border border-[#76e6ff]/20 bg-[#76e6ff]/[0.06] px-3 py-2 text-xs text-cyan-100 transition hover:border-[#76e6ff]/60 hover:bg-[#76e6ff]/15"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* INPUT */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage(input);
            }}
            className="border-t border-white/10 p-3"
          >
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 p-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onFocus={() => clearTimeout(closeTimerRef.current)}
                placeholder="Ask me anything..."
                disabled={isNavigating}
                aria-label="Ask the portfolio assistant"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-gray-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isNavigating}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#76e6ff] to-[#3eb7ff] font-bold text-slate-950 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ➤
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FLOATING BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open portfolio AI assistant"
        aria-expanded={isOpen}
        className="group flex items-center gap-3 rounded-full border border-[#76e6ff]/40 bg-[#071827]/90 px-5 py-3 text-white shadow-[0_0_30px_rgba(118,230,255,0.25)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[#76e6ff] hover:shadow-[0_0_40px_rgba(118,230,255,0.4)]"
      >
        <span className="text-xl">✨</span>
        <span className="font-semibold">Ask AI</span>
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#76e6ff]" />
      </button>
    </div>
  );
}
