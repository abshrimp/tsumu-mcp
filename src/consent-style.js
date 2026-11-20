export const consentStyles = `
:root {
  color-scheme: light;
  --bg: #f6f8fb; --panel: #fff; --field: #f3f6fa;
  --border: #e3e8ef; --text: #202630; --muted: #5d6775;
  --accent: #0b57d0; --accent-hover: #0842a0;
}
* { box-sizing: border-box; }
html { min-height: 100%; }
body { margin: 0; color: var(--text); background: var(--bg); font: 14px/1.6 system-ui, -apple-system, 'Hiragino Sans', 'Noto Sans JP', sans-serif; -webkit-font-smoothing: antialiased; }
button, input { font: inherit; }
button { cursor: pointer; }
a { color: var(--accent); }
:is(a, button, input, summary):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.page { min-height: 100dvh; display: grid; place-items: center; padding: 28px 16px; }
.card { width: min(100%, 468px); max-height: calc(100dvh - 56px); min-height: 0; overflow-y: auto; overscroll-behavior: contain; background: var(--panel); border: 1px solid var(--border); border-radius: 18px; padding: 28px 32px 22px; box-shadow: 0 12px 40px #1629470c; }
.top, .brand, .languages, .connection, .client-identity { display: flex; align-items: center; }
.top { justify-content: space-between; gap: 12px; margin-bottom: 32px; }
.brand { gap: 9px; font-size: 15px; }
.brand-mark { display: block; width: 30px; height: 30px; flex: none; }
.languages { gap: 2px; font-size: 12px; }
.languages a { color: var(--muted); text-decoration: none; padding: 4px 8px; border-radius: 7px; }
.languages a:hover { background: var(--field); }
.languages a[aria-current='page'] { color: var(--accent); background: #eaf1fd; font-weight: 600; }
.connection { justify-content: space-between; gap: 12px; margin-bottom: 24px; }
.client-identity { min-width: 0; gap: 12px; }
.client-icon { position: relative; width: 48px; height: 48px; flex: none; display: grid; place-items: center; background: #fff; border: 1px solid var(--border); border-radius: 13px; overflow: hidden; }
.client-icon img { position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); display: block; width: 30px; height: 30px; object-fit: contain; }
.client-icon:has(img) { background: #fff; color: transparent; }
.client-icon-fallback { background: #e9eff9; color: #234e88; font-size: 23px; font-weight: 650; }
.client-text { display: grid; gap: 1px; min-width: 0; }
.client-text strong { overflow-wrap: anywhere; font-size: 16px; line-height: 1.4; }
.client-text span { overflow-wrap: anywhere; font-size: 11px; color: var(--muted); }
.connection-arrow { width: 20px; height: 20px; margin-left: auto; flex: none; fill: none; stroke: #8793a2; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.destination-icon { display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid var(--border); border-radius: 13px; flex: none; }
.destination-icon .brand-mark { width: 34px; height: 34px; }
h1 { margin: 0 0 7px; font-size: 22px; font-weight: 650; line-height: 1.4; letter-spacing: -.02em; }
.intro { color: var(--muted); font-size: 13px; margin: 0 0 24px; }
label { display: block; margin-bottom: 7px; font-weight: 600; font-size: 13px; }
.code { display: block; width: 100%; height: 46px; border-radius: 9px; border: 1px solid #cbd5e1; background: #fff; padding: 10px 12px; color: var(--text); font: 500 15px/1.4 ui-monospace, 'SF Mono', Menlo, monospace; letter-spacing: .05em; }
.code:focus { border-color: var(--accent); outline: 2px solid #b8cff6; outline-offset: 1px; }
.help { font-size: 12px; line-height: 1.7; color: var(--muted); margin: 8px 0 18px; }
.approve, .draft { display: block; width: 100%; min-height: 44px; border: 1px solid var(--accent); border-radius: 9px; font-size: 14px; font-weight: 600; padding: 10px 14px; text-align: center; }
.approve { background: var(--accent); color: #fff; }
.draft { background: #fff; color: var(--accent); }
.approve:hover { background: var(--accent-hover); }
.draft:hover { background: #edf4ff; }
.official-sites { margin: 0 0 16px; }
.official-sites[hidden], #official-site-error[hidden] { display: none; }
.official-sites h2 { margin: 0 0 12px; font-size: 14px; font-weight: 650; }
.official-edit { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 12px; color: var(--muted); }
.official-site-list { display: grid; gap: 8px; }
.official-site-item { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 50px; padding: 9px 12px; text-align: left; border: 1px solid var(--border); border-radius: 9px; background: #fff; }
.official-site-item:hover { border-color: #8db4ee; background: #f7faff; }
.official-site-item:disabled { cursor: wait; opacity: .65; }
.official-site-item strong { min-width: 0; overflow-wrap: anywhere; font-size: 13px; }
.official-site-item small { margin-left: 12px; flex: none; font-size: 11px; color: var(--muted); }
.draft-choice { margin-top: 8px; }
.code-option { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px; }
.secondary-action { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px; }
.code-option { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); }
.code-option summary { width: fit-content; cursor: pointer; color: var(--accent); font-size: 13px; font-weight: 600; padding: 8px 0; }
.code-content { padding-top: 14px; }
.secondary-action span { display: block; color: var(--muted); font-size: 12px; margin-bottom: 7px; }
.deny { display: block; margin: 16px auto 0; padding: 7px 14px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); font-size: 13px; }
.deny:hover { background: var(--field); }
.details { margin-top: 22px; padding-top: 15px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); }
.details summary { width: fit-content; color: var(--muted); cursor: pointer; }
.details dl { display: grid; gap: 12px; margin: 14px 0 0; }
.details dt { font-weight: 600; margin-bottom: 3px; }
.details dd { margin: 0; overflow-wrap: anywhere; }
.scopes { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 0; }
.scopes li { padding: 2px 7px; background: var(--field); border-radius: 5px; font: 12px/1.5 ui-monospace, Menlo, monospace; }
.restricted, .loopback { margin: 12px 0 0; line-height: 1.7; }
.loopback { color: #785300; }
.error { padding: 12px 14px; background: #fff2f2; color: #9b1c1c; border-radius: 9px; }
.error-help { color: var(--muted); font-size: 12px; }
@media (max-width: 520px) {
  .page { padding: 0; place-items: start stretch; background: #fff; }
  .card { width: 100%; min-height: 100dvh; max-height: none; overflow: visible; border: 0; border-radius: 0; padding: 24px 20px; box-shadow: none; }
  .top { margin-bottom: 30px; }
  .connection { gap: 8px; }
  .client-identity { gap: 8px; }
  .client-text strong { font-size: 15px; }
  .client-icon, .destination-icon { width: 42px; height: 42px; }
  h1 { font-size: 21px; }
}
`;
