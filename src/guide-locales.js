// Text for the public connection guide served at GET /.
// Keep both languages in the same shape; tests compare their keys.
export const guideMessages = {
  ja: {
    pageTitle: "AIアプリとの接続方法 | Tsumu",
    description: "ChatGPT・Claude・Cursor・Gemini CLI・Google Antigravity から Tsumu のサイトを作成・編集するための接続方法です。",
    skip: "本文へ移動",
    eyebrow: "Tsumu × AI",
    title: "AIアプリから、Tsumuのサイトを作る・編集する",
    lead: "Tsumu のプラグインを入れると、普段使っている AI アプリから Tsumu のサイトを新しく作ったり、編集中のサイトを直接書き換えたりできます。Tsumu のアカウントは必要ありません。",
    worksWith: "対応しているAIアプリ",
    openTsumu: "Tsumuを開く",
    viewSource: "GitHub で見る",
    tocLabel: "目次",
    tocApps: "AIアプリに追加する",
    tocNew: "新しいサイトを作る",
    tocEdit: "既存のサイトを編集する",
    tocTrouble: "うまくいかないとき",

    appsTitle: "1. AIアプリにプラグインを追加する",
    appsLead: "使っているアプリのプラグインを入れれば、準備は完了です。",
    getPlugin: "プラグインを入手",
    comingSoon: "準備中",
    chatgptSummary: "ChatGPT と Codex",
    claudeSummary: "Claude（Web・デスクトップ）と Claude Code",
    cursorSummary: "AIコードエディタ",
    geminiSummary: "ターミナルで使う Gemini",
    antigravitySummary: "Google のエージェント型開発環境",

    chooseTitle: "2. 使い方を選ぶ",
    chooseLead: "AI が初めて Tsumu を使うときに、Tsumu の認可画面が開きます。ここでの選び方で、AI ができることが変わります。",
    newCardTitle: "新しいサイトを作る",
    newCardBody: "接続コードは不要です。AI が作ったサイトを、一度だけ使えるリンクから Tsumu に取り込みます。",
    editCardTitle: "既存のサイトを編集する",
    editCardBody: "Tsumu で表示した接続コードを入力します。開いているサイトを、AI が直接読んだり編集したりします。",
    recommendedFirst: "はじめての方に",

    newTitle: "新しいサイトを AI に作ってもらう",
    newSteps: [
      {
        title: "「新規サイトの作成のみ許可」を押す",
        body: "認可画面で、接続先のアプリ名とドメインを確認してから押します。この許可では、既存のサイトにはアクセスできません。このブラウザで接続コードを発行したことがある場合、このボタンはコードの入力欄の下に表示されます。",
        image: "consent-new",
        alt: "Tsumu の認可画面。「新規サイトの作成のみ許可」ボタンと、接続コードの入力欄を開くリンクがある",
      },
      {
        title: "作りたいサイトを AI に伝える",
        body: "「パン屋のサイトを作って」のように頼むと、AI がサイトを組み立て、最後に Tsumu で開くための一時リンクを返します。",
      },
      {
        title: "リンクを開いて Tsumu に取り込む",
        body: "リンクを開くと、新しいサイトとして Tsumu に取り込まれ、そのまま編集できます。リンクは1時間で失効し、取り込みが終わるとサーバーから一時データが削除されます。",
        image: "import",
        alt: "Tsumu の「サイトを取り込み中」の表示",
      },
    ],
    newNote: "一時リンクは、開いた人が誰でもサイトを取り込めるパスワードのようなものです。他の人と共有しないでください。",

    editTitle: "Tsumu で開いているサイトを AI に編集してもらう",
    editSteps: [
      {
        title: "Tsumu でサイトを開き、「AIと接続（MCP）」を選ぶ",
        body: "編集したいサイトを Tsumu で開き、右上の「…」メニューから「AIと接続（MCP）」を選びます。",
        image: "menu",
        alt: "Tsumu のエディタ右上のメニュー。「AIと接続（MCP）」が選ばれている",
      },
      {
        title: "権限を選んで「接続を開始」を押す",
        body: "AI に編集もさせる場合は「編集を許可する」をオンにします。オフにすると閲覧だけになります。公開やアセットの削除は、どちらの場合もできません。ダイアログの下から、各AIアプリのプラグインや接続方法も開けます。",
        image: "modal",
        alt: "「AIと接続（MCP）」ダイアログ。「編集を許可する」のチェックボックス、「接続を開始」ボタン、AIアプリのプラグインへのリンク",
      },
      {
        title: "接続コードを確認する",
        body: "接続コードが表示されます。コードは一度だけ使え、10分で失効します。",
        image: "connected",
        alt: "接続中のダイアログ。接続コードと、AIアプリのプラグインへのリンクが表示されている",
      },
      {
        title: "認可画面で接続コードを入力する",
        body: "AI が Tsumu を使おうとすると認可画面が開きます。Tsumu で接続コードを発行したあとは、最初からコードの入力欄が表示されるので、コードを入力して「接続を許可」を押します。入力欄が見当たらない場合は「接続コードがある場合はこちら」を開いてください。",
        image: "consent-code",
        alt: "接続コードを発行したあとの認可画面。接続コードの入力欄と「接続を許可」ボタンがある",
      },
      {
        title: "Tsumu のタブを開いたまま AI に頼む",
        body: "AI は Tsumu のタブを通してサイトを読み書きするため、使っている間はタブを閉じないでください。接続は1時間で切れます。終わったら「接続を解除して失効」を押します。",
      },
    ],
    editNote: "接続コードは他の人に教えないでください。他の人から渡されたコードも入力しないでください。",

    troubleTitle: "うまくいかないとき",
    trouble: [
      ["認可画面が開かない・AI が Tsumu を使わない", "プラグインが有効になっているか確認してください。アプリを再起動するか、プラグインを入れ直すと直ることがあります。"],
      ["「接続コードが正しくありません」と表示される", "コードは10分で失効し、一度しか使えません。Tsumu の「AIと接続（MCP）」で接続し直し、新しいコードを入力してください。"],
      ["AI がサイトを見つけられない", "接続した Tsumu のタブが開いたままか確認してください。タブを閉じたり、別のサイトに移ったりすると接続が切れます。"],
      ["AI が編集できない", "「編集を許可する」をオンにして接続し直してください。閲覧のみの接続では編集できません。"],
      ["AI が新しいサイトを作ったのに編集できない", "新しく作られたサイトは、元の接続とは別のサイトです。そのサイトを Tsumu で開き、もう一度「AIと接続（MCP）」から接続してください。"],
    ],

    securityTitle: "安全のための仕組み",
    security: [
      "接続は1つのサイトだけが対象で、Tsumu で選んだ権限の範囲でしか操作できません。",
      "Tsumu のサーバーはサイトのデータを保存せず、AI とブラウザのタブとの間で中継するだけです。",
      "接続はいつでも Tsumu の「接続を解除して失効」で取り消せます。",
    ],

    footerPrivacy: "プライバシーポリシー",
    footerSource: "ソースコード",
    footerLicense: "Tsumu は MIT ライセンスのオープンソースです。",
  },
  en: {
    pageTitle: "Connect an AI app | Tsumu",
    description: "Connect ChatGPT, Claude, Cursor, Gemini CLI or Google Antigravity to create and edit Tsumu sites.",
    skip: "Skip to content",
    eyebrow: "Tsumu × AI",
    title: "Create and edit Tsumu sites from your AI app",
    lead: "The Tsumu plugin lets the AI app you already use build new Tsumu sites or edit the site you have open. No Tsumu account is required.",
    worksWith: "Works with",
    openTsumu: "Open Tsumu",
    viewSource: "View on GitHub",
    tocLabel: "Contents",
    tocApps: "Add to your AI app",
    tocNew: "Create a new site",
    tocEdit: "Edit an existing site",
    tocTrouble: "Troubleshooting",

    appsTitle: "1. Add the plugin to your AI app",
    appsLead: "Install the plugin for the app you use. That's all the setup you need.",
    getPlugin: "Get the plugin",
    comingSoon: "Coming soon",
    chatgptSummary: "ChatGPT and Codex",
    claudeSummary: "Claude (web and desktop) and Claude Code",
    cursorSummary: "AI code editor",
    geminiSummary: "Gemini in your terminal",
    antigravitySummary: "Google's agentic development platform",

    chooseTitle: "2. Choose how to use it",
    chooseLead: "The first time your AI uses Tsumu, the Tsumu authorization page opens. What you choose there decides what the AI can do.",
    newCardTitle: "Create a new site",
    newCardBody: "No connection code needed. The AI builds a site and you import it into Tsumu with a one-time link.",
    editCardTitle: "Edit an existing site",
    editCardBody: "Enter a connection code shown in Tsumu. The AI reads and edits the site you have open.",
    recommendedFirst: "Good place to start",

    newTitle: "Have the AI build a new site",
    newSteps: [
      {
        title: "Select \"Allow new-site creation only\"",
        body: "Check the app name and domain on the authorization page first. This permission cannot access any existing site. If you have issued a connection code in this browser before, this button appears below the code field.",
        image: "consent-new",
        alt: "The Tsumu authorization page with an \"Allow new-site creation only\" button and a link to enter a connection code",
      },
      {
        title: "Describe the site you want",
        body: "Ask something like \"Build a website for a bakery\". The AI builds the site and finishes by giving you a one-time link that opens it in Tsumu.",
      },
      {
        title: "Open the link to import it into Tsumu",
        body: "Opening the link imports it into Tsumu as a new site, ready to edit. The link expires after one hour, and the temporary copy is deleted from the server after the import.",
        image: "import",
        alt: "Tsumu showing \"Importing site\"",
      },
    ],
    newNote: "Anyone who opens the one-time link can import the site, so treat it like a password and don't share it.",

    editTitle: "Have the AI edit the site open in Tsumu",
    editSteps: [
      {
        title: "Open the site in Tsumu and choose \"MCP connection\"",
        body: "Open the site you want to edit in Tsumu, then choose \"MCP connection\" from the \"…\" menu at the top right.",
        image: "menu",
        alt: "The menu at the top right of the Tsumu editor with \"MCP connection\" highlighted",
      },
      {
        title: "Choose a permission and select \"Start connection\"",
        body: "Turn on \"Allow editing\" to let the AI make changes; leave it off for read-only access. Publishing and deleting assets are never allowed. The bottom of the dialog links to each AI app's plugin or setup steps.",
        image: "modal",
        alt: "The MCP connection dialog with an \"Allow editing\" checkbox, a \"Start connection\" button and links to AI app plugins",
      },
      {
        title: "Find the connection code",
        body: "A connection code appears. It works only once and expires after 10 minutes.",
        image: "connected",
        alt: "The connected dialog showing a connection code and links to AI app plugins",
      },
      {
        title: "Enter the code on the authorization page",
        body: "When the AI starts using Tsumu, the authorization page opens. Once you have issued a code in Tsumu, the code field appears right away: enter the code and select \"Allow access\". If you don't see the field, open \"Have a connection code? Use it here\".",
        image: "consent-code",
        alt: "The authorization page after a code was issued, with a connection code field and an \"Allow access\" button",
      },
      {
        title: "Keep the Tsumu tab open while you work",
        body: "The AI reads and writes the site through your Tsumu tab, so keep it open. The connection ends after one hour. When you're done, select \"Disconnect and revoke\".",
      },
    ],
    editNote: "Never share your connection code, and never enter a code someone else gave you.",

    troubleTitle: "Troubleshooting",
    trouble: [
      ["The authorization page doesn't open, or the AI doesn't use Tsumu", "Check that the plugin is enabled. Restarting the app or reinstalling the plugin often helps."],
      ["\"The connection code is invalid\"", "Codes expire after 10 minutes and work only once. Start a new connection from \"MCP connection\" in Tsumu and enter the new code."],
      ["The AI can't find the site", "Make sure the connected Tsumu tab is still open. Closing the tab or switching to another site ends the connection."],
      ["The AI can't make changes", "Reconnect with \"Allow editing\" turned on. A read-only connection can't edit."],
      ["The AI created a new site but can't edit it", "A newly created site is separate from the original connection. Open it in Tsumu and connect again from \"MCP connection\"."],
    ],

    securityTitle: "Built-in safeguards",
    security: [
      "Each connection covers one site and only the permission you chose in Tsumu.",
      "Tsumu's server doesn't store your site. It only relays requests between the AI and your browser tab.",
      "You can revoke a connection at any time with \"Disconnect and revoke\" in Tsumu.",
    ],

    footerPrivacy: "Privacy policy",
    footerSource: "Source code",
    footerLicense: "Tsumu is open source under the MIT License.",
  },
};
