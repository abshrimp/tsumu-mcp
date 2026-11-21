// Styles for the connection guide. Tokens follow the Tsumu editor
// (app/globals.css in abshrimp/tsumu) so the guide feels like part of Tsumu.
export const guideStyles = `
:root {
  color-scheme: light;
  --bg: #f8fafd; --panel: #fff; --field: #f0f4f9; --field-hover: #e7ecf3;
  --border: #e3e6ea; --border-strong: #c4c7c5;
  --text: #1f1f1f; --text-2: #444746; --text-3: #6b7177;
  --accent: #0b57d0; --accent-hover: #0842a0; --accent-soft: #d3e3fd; --accent-ink: #041e49;
  --warning-bg: #fffbeb; --warning-ink: #92400e;
  --radius: 8px; --radius-l: 16px;
  --shadow-1: 0 1px 2px rgba(60, 64, 67, .3), 0 1px 3px 1px rgba(60, 64, 67, .15);
  --shadow-soft: 0 12px 40px #1629470c;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 72px; }
body { margin: 0; color: var(--text); background: var(--bg); font: 15px/1.75 "Google Sans Text", "Google Sans", Roboto, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif; -webkit-font-smoothing: antialiased; word-break: auto-phrase; }
a { color: var(--accent); }
button { font: inherit; cursor: pointer; }
:is(a, button, summary):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
.skip { position: absolute; left: 12px; top: -48px; z-index: 20; padding: 8px 14px; border-radius: var(--radius); background: var(--accent); color: #fff; }
.skip:focus { top: 12px; }

.top { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
.top-inner { max-width: 1040px; margin: 0 auto; height: 56px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.brand { display: flex; align-items: center; gap: 9px; color: var(--text); text-decoration: none; font-size: 16px; font-weight: 600; }
.brand-mark { display: block; width: 28px; height: 28px; flex: none; }
.languages { display: flex; gap: 2px; font-size: 13px; }
.languages a { color: var(--text-2); text-decoration: none; padding: 4px 10px; border-radius: 999px; }
.languages a:hover { background: var(--field-hover); }
.languages a[aria-current='page'] { color: var(--accent-ink); background: var(--accent-soft); font-weight: 600; }

main { max-width: 1040px; margin: 0 auto; padding: 0 20px 64px; }
.hero { padding: 56px 0 40px; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 40px; align-items: center; }
.eyebrow { display: inline-block; margin: 0 0 12px; padding: 2px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-ink); font-size: 12px; font-weight: 600; letter-spacing: .02em; }
h1 { margin: 0 0 16px; font-size: clamp(28px, 4vw, 38px); line-height: 1.3; letter-spacing: -.02em; font-weight: 650; }
.lead { margin: 0 0 24px; color: var(--text-2); font-size: 16px; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 8px 18px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--panel); color: var(--accent); font-size: 14px; font-weight: 600; text-decoration: none; line-height: 1.4; }
.btn:hover { background: var(--field); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn svg { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
svg.gh { width: 16px; height: 16px; flex: none; fill: currentColor; stroke: none; }

.hero-apps { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-l); padding: 22px; box-shadow: var(--shadow-soft); }
.works-with { margin: 0; font-size: 13px; font-weight: 600; color: var(--text-2); }
.app-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
.app-row a { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px 5px 7px; border-radius: 999px; border: 1px solid var(--border); color: var(--text-2); font-size: 12.5px; text-decoration: none; line-height: 1.3; }
.app-row a:hover { border-color: #a8c7fa; color: var(--accent); background: #f5f9ff; }
.app-row img { display: block; width: 18px; height: 18px; }

.toc { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 8px; padding: 0; list-style: none; }
.toc a { display: inline-block; padding: 6px 14px; border-radius: 999px; background: var(--panel); border: 1px solid var(--border); color: var(--text-2); font-size: 13px; text-decoration: none; }
.toc a:hover { border-color: var(--accent-border, #a8c7fa); color: var(--accent); }

section.block { margin-top: 56px; }
h2 { margin: 0 0 8px; font-size: 24px; line-height: 1.4; letter-spacing: -.01em; font-weight: 650; }
h3 { margin: 0; font-size: 18px; line-height: 1.45; font-weight: 650; }
.section-lead { margin: 0 0 24px; color: var(--text-2); }

.apps { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 12px; }
.app { min-width: 0; display: flex; align-items: center; gap: 14px; padding: 16px 18px; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-l); }
.app-icon { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: 12px; background: var(--panel); border: 1px solid var(--border); color: var(--text); }
.app-icon img { display: block; }
.app-name { flex: 1; min-width: 0; }
.app-name strong { display: block; font-size: 16px; line-height: 1.4; }
.app-name span { display: block; font-size: 13px; color: var(--text-3); }
.soon { display: inline-flex; align-items: center; min-height: 34px; padding: 4px 12px; border-radius: 999px; background: var(--field); color: var(--text-3); font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.choice { position: relative; display: block; padding: 22px; border-radius: var(--radius-l); border: 1px solid var(--border); background: var(--panel); color: var(--text); text-decoration: none; transition: border-color .15s, box-shadow .15s; }
.choice:hover { border-color: #a8c7fa; box-shadow: var(--shadow-soft); }
.choice h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; color: var(--accent-ink); }
.choice p { margin: 0; color: var(--text-2); font-size: 14px; }
.choice .tag { display: inline-block; margin-bottom: 10px; padding: 1px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-ink); font-size: 11.5px; font-weight: 600; }
.choice .arrow { position: absolute; right: 20px; top: 22px; width: 18px; height: 18px; fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.flow { margin-top: 40px; padding: 28px; background: var(--panel); border: 1px solid var(--border); border-radius: 20px; }
.flow > h3 { font-size: 20px; margin-bottom: 20px; }
.steps { list-style: none; margin: 0; padding: 0; counter-reset: step; }
.step { counter-increment: step; display: grid; grid-template-columns: 36px minmax(0, 1fr) minmax(0, 1.05fr); gap: 0 18px; padding: 22px 0; border-top: 1px solid var(--border); }
.step:first-child { border-top: 0; padding-top: 4px; }
.step::before { content: counter(step); width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: var(--accent); color: #fff; font-weight: 700; font-size: 14px; }
.step.no-image { grid-template-columns: 36px minmax(0, 1fr); }
.step h4 { margin: 3px 0 6px; font-size: 16px; line-height: 1.5; }
.step p { margin: 0; color: var(--text-2); font-size: 14.5px; }
.step figure { margin: 0; align-self: start; }
.shot { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--border); background: var(--bg); }
.shot-narrow { max-width: 340px; }
.note { display: flex; gap: 10px; margin: 18px 0 0; padding: 12px 14px; border-radius: 10px; background: var(--warning-bg); color: var(--warning-ink); font-size: 13.5px; }
.note svg { width: 18px; height: 18px; flex: none; margin-top: 2px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.faq { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.faq details { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; }
.faq summary { list-style: none; padding: 14px 18px; font-weight: 600; cursor: pointer; display: flex; justify-content: space-between; gap: 12px; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: "+"; color: var(--text-3); font-weight: 400; font-size: 18px; line-height: 1.4; }
.faq details[open] summary::after { content: "−"; }
.faq p { margin: 0; padding: 0 18px 16px; color: var(--text-2); font-size: 14.5px; }
.safety { margin: 0; padding: 18px 22px 18px 40px; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-l); color: var(--text-2); }
.safety li + li { margin-top: 6px; }

.url-box { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 0 0 18px; padding: 16px 20px; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-l); }
.url-label { font-size: 13px; font-weight: 600; color: var(--text-2); }
.url-box .code { flex: 1 1 320px; margin: 0; }
.url-help { flex-basis: 100%; font-size: 13px; color: var(--text-3); }
.code { margin: 12px 0 0; padding: 10px 14px; overflow-x: auto; background: var(--field); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font: 13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; user-select: all; -webkit-user-select: all; }
.app-jump { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 8px; padding: 0; list-style: none; }
.app-jump a { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px 7px 10px; border-radius: 999px; background: var(--panel); border: 1px solid var(--border); color: var(--text-2); font-size: 13.5px; font-weight: 600; text-decoration: none; }
.app-jump a:hover { border-color: #a8c7fa; color: var(--accent); }
.app-jump img { display: block; width: 20px; height: 20px; }
.client { margin-top: 20px; padding: 24px 28px; background: var(--panel); border: 1px solid var(--border); border-radius: 20px; }
.client-head { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
.client-head h3 { font-size: 20px; }
.client-head .app-name span { display: block; font-size: 13px; color: var(--text-3); }

footer { border-top: 1px solid var(--border); }
.foot { max-width: 1040px; margin: 0 auto; padding: 24px 20px 40px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; color: var(--text-3); font-size: 13px; }
.foot nav { display: flex; flex-wrap: wrap; gap: 4px 18px; }
.foot a { display: inline-flex; align-items: center; gap: 6px; color: var(--text-2); text-decoration: none; }
.foot a:hover { color: var(--accent); text-decoration: underline; }

@media (max-width: 820px) {
  .hero { grid-template-columns: 1fr; gap: 28px; padding-top: 36px; }
  .choices { grid-template-columns: 1fr; }
  .flow, .client { padding: 20px 16px; }
  .step, .step.no-image { grid-template-columns: 36px minmax(0, 1fr); gap: 0 14px; }
  .step figure { grid-column: 2; margin-top: 14px; }
}
@media (max-width: 520px) {
  body { font-size: 14.5px; }
  .app { flex-wrap: wrap; }
  .app .btn, .app .soon { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition: none !important; } }
`;

/* Compact, accordion-based AI client setup (matches the supplied connection guide). */
.setup-clients { display: grid; gap: 10px; margin: 24px 0; }
.setup-client { background: var(--panel, #fff); border: 1px solid var(--border, #e3e6ea); border-radius: 16px; overflow: hidden; }
.setup-client[open] { box-shadow: 0 12px 40px #1629470c; }
.setup-client > summary { display: flex; align-items: center; gap: 14px; min-height: 78px; padding: 15px 20px; cursor: pointer; list-style: none; }
.setup-client > summary::-webkit-details-marker { display: none; }
.setup-client > summary strong { flex: 1; font-size: 16px; }
.setup-client > summary .app-icon { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 44px; height: 44px; border: 1px solid #e3e6ea; border-radius: 12px; background: #fff; }
.setup-chevron { font-size: 25px; line-height: 1; color: #6b7177; transition: transform .2s; }
.setup-client[open] .setup-chevron { transform: rotate(180deg); }
.setup-client-body { margin: 0 20px; padding: 12px 0 20px; border-top: 1px solid #e3e6ea; }
.setup-action { margin: 8px 0 14px; }
.setup-client .steps { margin: 0; padding-left: 26px; }
.setup-client .step { padding: 12px 0; }
.setup-client .step::before { flex: none; }
.setup-client .step.no-image { grid-template-columns: minmax(0,1fr); }
.setup-client .step h4 { margin: 0; }
.setup-client .code { overflow-x: auto; }
@media (max-width: 600px) {
  .setup-client > summary { padding: 12px 14px; }
  .setup-client-body { margin: 0 14px; }
}
