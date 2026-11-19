// Text for the manual-setup guide served at GET / while GUIDE_MODE is "manual".
// Everything not listed here (header, the "choose how to use it" flows,
// safeguards, footer) comes from guide-locales.js.
// Keep both languages in the same shape; tests compare their keys.
export const MCP_URL = "https://mcp.tsumu.ebii.net/mcp";

const cursorConfig = `{
  "mcpServers": {
    "tsumu": {
      "url": "${MCP_URL}"
    }
  }
}`;

const antigravityConfig = `{
  "mcpServers": {
    "tsumu": {
      "serverUrl": "${MCP_URL}"
    }
  }
}`;

const geminiAdd = `gemini mcp add --transport http --scope user tsumu ${MCP_URL}`;
const claudeCodeAdd = `claude mcp add --transport http tsumu ${MCP_URL}`;

export const manualGuideMessages = {
  ja: {
    lead: "普段使っている AI アプリに Tsumu の MCP サーバーを追加すると、AI アプリから Tsumu のサイトを新しく作ったり、編集中のサイトを直接書き換えたりできます。Tsumu のアカウントは必要ありません。",
    appsTitle: "1. AIアプリに Tsumu を追加する",
    appsLead: "使っているアプリの手順に沿って、Tsumu の MCP サーバーを追加します。どのアプリでも、入力する URL は同じです。",
    urlLabel: "MCPサーバーのURL",
    urlHelp: "末尾の /mcp まで含めて入力してください。",
    jump: "手順を見る",
    clients: {
      chatgpt: {
        summary: "Web版で設定します。有料プランが必要です",
        steps: [
          {
            title: "開発者モードをオンにする",
            body: "ブラウザで chatgpt.com を開き、設定 →「アプリ」→「詳細設定」で「開発者モード」をオンにします。開発者モードは Plus・Pro・Business などの有料プランで、Web版でのみ設定できます。",
            image: "chatgpt-1",
            alt: "ChatGPT の設定画面。「詳細設定」で開発者モードがオンになっている",
          },
          {
            title: "Tsumu のアプリを作成する",
            body: "「アプリを作成」を押し、名前に「Tsumu」、MCPサーバーのURLに上の URL を入力します。認証は「OAuth」を選び、注意事項にチェックを入れて「作成」を押します。",
            image: "chatgpt-2",
            alt: "ChatGPT の「アプリを作成」ダイアログ。名前に Tsumu、URL に Tsumu の MCP サーバーが入力されている",
          },
          {
            title: "Tsumu の認可画面で許可する",
            body: "Tsumu の認可画面が開きます。どちらを選ぶかは、下の「2. 使い方を選ぶ」を見てください。",
            image: "chatgpt-3",
            alt: "ChatGPT から開いた Tsumu の認可画面",
          },
          {
            title: "チャットで Tsumu を選んで頼む",
            body: "チャットの入力欄の「＋」から Tsumu を選んでから、作りたいサイトや直したい内容を伝えます。作成したアプリは ChatGPT のデスクトップアプリやスマホアプリでも使えます。",
            image: "chatgpt-4",
            alt: "ChatGPT の入力欄の「＋」メニューで Tsumu が選ばれている",
          },
        ],
      },
      claude: {
        summary: "Web版・デスクトップ版・Claude Code",
        steps: [
          {
            title: "「カスタムコネクタを追加」を開く",
            body: "claude.ai またはデスクトップアプリで「カスタマイズ」→「コネクタ」を開き、「＋」→「カスタムコネクタを追加」を選びます。Free プランで追加できるカスタムコネクタは1つまでです。Team・Enterprise プランでは、組織のオーナーが組織設定から追加します。",
            image: "claude-1",
            alt: "Claude のコネクタ画面。「＋」メニューに「カスタムコネクタを追加」がある",
          },
          {
            title: "名前と URL を入力して追加する",
            body: "名前に「Tsumu」、リモート MCP サーバーの URL に上の URL を入力して「追加」を押します。詳細設定（OAuth クライアント ID など）は空欄のままで大丈夫です。",
            image: "claude-2",
            alt: "カスタムコネクタの追加ダイアログ。名前に Tsumu、URL に Tsumu の MCP サーバーが入力されている",
          },
          {
            title: "「連携」を押して認可する",
            body: "コネクタの一覧に Tsumu が追加されます。「連携」を押すと Tsumu の認可画面が開くので、下の「2. 使い方を選ぶ」に沿って許可します。追加したコネクタは、Web・デスクトップ・スマホのどこでも使えます。",
            image: "claude-3",
            alt: "Claude のコネクタ一覧に Tsumu が表示され、「連携」ボタンがある",
          },
          {
            title: "Claude Code の場合",
            body: "ターミナルで次のコマンドを実行してから Claude Code を起動し、/mcp で tsumu を選んで認証します。",
            code: claudeCodeAdd,
          },
        ],
      },
      cursor: {
        summary: "mcp.json に設定を追加します",
        steps: [
          {
            title: "「Tools & MCP」を開く",
            body: "Cursor Settings（Mac は Cmd+Shift+J、Windows は Ctrl+Shift+J）を開き、「Tools & MCP」→「New MCP Server」を押します。設定ファイル mcp.json が開きます。",
            image: "cursor-1",
            alt: "Cursor Settings の「Tools & MCP」画面と「New MCP Server」ボタン",
          },
          {
            title: "設定を貼り付けて保存する",
            body: "次の内容を貼り付けて保存します。ほかの MCP サーバーがすでにある場合は、mcpServers の中に \"tsumu\" の項目だけを追加してください。",
            code: cursorConfig,
            image: "cursor-2",
            alt: "Cursor で開いた mcp.json に Tsumu の設定が入っている",
          },
          {
            title: "「Connect」を押して認可する",
            body: "「Tools & MCP」に tsumu が表示されます。「Needs authentication」の横の「Connect」を押すと Tsumu の認可画面が開くので、下の「2. 使い方を選ぶ」に沿って許可します。",
            image: "cursor-3",
            alt: "Cursor の「Tools & MCP」に tsumu が表示され、「Connect」ボタンがある",
          },
        ],
      },
      gemini: {
        summary: "コマンド1つで追加できます",
        steps: [
          {
            title: "コマンドで追加する",
            body: "ターミナルで次のコマンドを実行します。--scope user を付けると、どのフォルダで Gemini CLI を起動しても Tsumu を使えます。",
            code: geminiAdd,
            image: "gemini-1",
            alt: "ターミナルで gemini mcp add コマンドを実行した結果",
          },
          {
            title: "Gemini CLI で認証する",
            body: "gemini を起動して /mcp auth tsumu を実行すると、ブラウザで Tsumu の認可画面が開きます。下の「2. 使い方を選ぶ」に沿って許可します。",
            code: "/mcp auth tsumu",
            image: "gemini-2",
            alt: "Gemini CLI で /mcp auth tsumu を実行したところ",
          },
          {
            title: "接続できたか確認する",
            body: "/mcp list を実行して、tsumu が接続済み（Ready）になっていれば完了です。",
            image: "gemini-3",
            alt: "Gemini CLI の /mcp list で tsumu が接続済みになっている",
          },
        ],
      },
      antigravity: {
        summary: "mcp_config.json に設定を追加します",
        steps: [
          {
            title: "MCP サーバーの管理画面を開く",
            body: "エージェントパネル上部の「…」→「MCP Servers」を開き、「Manage MCP Servers」を押します。Antigravity 2.0 では、左下の Settings →「Customizations」の「Installed MCP Servers」から開きます。",
            image: "antigravity-1",
            alt: "Antigravity のエージェントパネルの「…」メニューと「MCP Servers」",
          },
          {
            title: "「View raw config」を押す",
            body: "設定ファイル mcp_config.json が開きます。",
            image: "antigravity-2",
            alt: "Antigravity の「Manage MCP Servers」画面と「View raw config」",
          },
          {
            title: "設定を貼り付けて保存する",
            body: "次の内容を貼り付けて保存します。Antigravity では、URL の項目名は url ではなく serverUrl です。ほかの MCP サーバーがすでにある場合は、mcpServers の中に \"tsumu\" の項目だけを追加してください。",
            code: antigravityConfig,
            image: "antigravity-3",
            alt: "Antigravity で開いた mcp_config.json に Tsumu の設定が入っている",
          },
          {
            title: "一覧に tsumu が出たら完了",
            body: "MCP サーバーの一覧に tsumu が表示されます。AI が初めて Tsumu を使うときに認可画面が開くので、下の「2. 使い方を選ぶ」に沿って許可します。",
            image: "antigravity-4",
            alt: "Antigravity の MCP サーバー一覧に tsumu が表示されている",
          },
        ],
      },
    },
    firstTrouble: ["認可画面が開かない・AI が Tsumu を使わない", "URL が末尾の /mcp まで正しく入っているか確認してください。Cursor は url、Antigravity は serverUrl、Gemini CLI の settings.json は httpUrl と、アプリによって設定の項目名が違います。アプリを再起動するか、接続し直すと直ることがあります。"],
  },
  en: {
    lead: "Add Tsumu's MCP server to the AI app you already use, and it can build new Tsumu sites or edit the site you have open. No Tsumu account is required.",
    appsTitle: "1. Add Tsumu to your AI app",
    appsLead: "Follow the steps for your app to add Tsumu's MCP server. The URL is the same in every app.",
    urlLabel: "MCP server URL",
    urlHelp: "Include the /mcp at the end.",
    jump: "See the steps",
    clients: {
      chatgpt: {
        summary: "Set up on the web. Requires a paid plan",
        steps: [
          {
            title: "Turn on developer mode",
            body: "Open chatgpt.com in a browser and go to Settings → Apps → Advanced settings, then turn on Developer mode. Developer mode needs a paid plan such as Plus, Pro or Business and can only be set up on the web.",
            image: "chatgpt-1",
            alt: "ChatGPT settings with Developer mode turned on under Advanced settings",
          },
          {
            title: "Create the Tsumu app",
            body: "Select Create app. Enter \"Tsumu\" as the name and the URL above as the MCP server URL. Choose OAuth for authentication, check the acknowledgement and select Create.",
            image: "chatgpt-2",
            alt: "ChatGPT's Create app dialog with the name Tsumu and Tsumu's MCP server URL filled in",
          },
          {
            title: "Allow access on the Tsumu authorization page",
            body: "The Tsumu authorization page opens. See \"2. Choose how to use it\" below for which option to pick.",
            image: "chatgpt-3",
            alt: "The Tsumu authorization page opened from ChatGPT",
          },
          {
            title: "Pick Tsumu in a chat",
            body: "Choose Tsumu from the + menu in the message box, then describe the site you want or the change to make. The app also works in the ChatGPT desktop and mobile apps.",
            image: "chatgpt-4",
            alt: "Tsumu selected in the + menu of ChatGPT's message box",
          },
        ],
      },
      claude: {
        summary: "Web, desktop and Claude Code",
        steps: [
          {
            title: "Open \"Add custom connector\"",
            body: "In claude.ai or the desktop app, go to Customize → Connectors, then select + → Add custom connector. The Free plan allows one custom connector. On Team and Enterprise plans, an organization owner adds it from organization settings.",
            image: "claude-1",
            alt: "Claude's Connectors page with the + menu showing Add custom connector",
          },
          {
            title: "Enter the name and URL, then add it",
            body: "Enter \"Tsumu\" as the name and the URL above as the remote MCP server URL, then select Add. Leave the advanced settings (OAuth client ID and so on) empty.",
            image: "claude-2",
            alt: "The Add custom connector dialog with the name Tsumu and Tsumu's MCP server URL filled in",
          },
          {
            title: "Select Connect to authorize",
            body: "Tsumu appears in the connector list. Select Connect to open the Tsumu authorization page, then follow \"2. Choose how to use it\" below. The connector works on the web, desktop and mobile.",
            image: "claude-3",
            alt: "Tsumu in Claude's connector list with a Connect button",
          },
          {
            title: "For Claude Code",
            body: "Run this command in a terminal, start Claude Code, then choose tsumu in /mcp to authenticate.",
            code: claudeCodeAdd,
          },
        ],
      },
      cursor: {
        summary: "Add the server to mcp.json",
        steps: [
          {
            title: "Open Tools & MCP",
            body: "Open Cursor Settings (Cmd+Shift+J on Mac, Ctrl+Shift+J on Windows), go to Tools & MCP and select New MCP Server. This opens mcp.json.",
            image: "cursor-1",
            alt: "The Tools & MCP page in Cursor Settings with a New MCP Server button",
          },
          {
            title: "Paste the configuration and save",
            body: "Paste the following and save. If you already have other MCP servers, add only the \"tsumu\" entry inside mcpServers.",
            code: cursorConfig,
            image: "cursor-2",
            alt: "mcp.json open in Cursor with the Tsumu configuration",
          },
          {
            title: "Select Connect to authorize",
            body: "tsumu appears under Tools & MCP. Select Connect next to \"Needs authentication\" to open the Tsumu authorization page, then follow \"2. Choose how to use it\" below.",
            image: "cursor-3",
            alt: "tsumu listed under Tools & MCP in Cursor with a Connect button",
          },
        ],
      },
      gemini: {
        summary: "One command to add it",
        steps: [
          {
            title: "Add it with a command",
            body: "Run this command in a terminal. With --scope user, Tsumu is available whichever folder you start Gemini CLI in.",
            code: geminiAdd,
            image: "gemini-1",
            alt: "The result of running gemini mcp add in a terminal",
          },
          {
            title: "Authenticate in Gemini CLI",
            body: "Start gemini and run /mcp auth tsumu. The Tsumu authorization page opens in your browser; follow \"2. Choose how to use it\" below.",
            code: "/mcp auth tsumu",
            image: "gemini-2",
            alt: "Running /mcp auth tsumu in Gemini CLI",
          },
          {
            title: "Check the connection",
            body: "Run /mcp list. You're done when tsumu shows as connected (Ready).",
            image: "gemini-3",
            alt: "tsumu shown as connected in Gemini CLI's /mcp list",
          },
        ],
      },
      antigravity: {
        summary: "Add the server to mcp_config.json",
        steps: [
          {
            title: "Open MCP server management",
            body: "Select … at the top of the agent panel, open MCP Servers and select Manage MCP Servers. In Antigravity 2.0, go to Settings at the bottom left → Customizations → Installed MCP Servers.",
            image: "antigravity-1",
            alt: "The … menu of Antigravity's agent panel with MCP Servers",
          },
          {
            title: "Select View raw config",
            body: "This opens mcp_config.json.",
            image: "antigravity-2",
            alt: "Antigravity's Manage MCP Servers page with View raw config",
          },
          {
            title: "Paste the configuration and save",
            body: "Paste the following and save. Antigravity uses serverUrl, not url, for the URL. If you already have other MCP servers, add only the \"tsumu\" entry inside mcpServers.",
            code: antigravityConfig,
            image: "antigravity-3",
            alt: "mcp_config.json open in Antigravity with the Tsumu configuration",
          },
          {
            title: "Done when tsumu is listed",
            body: "tsumu appears in the MCP server list. The authorization page opens the first time the AI uses Tsumu; follow \"2. Choose how to use it\" below.",
            image: "antigravity-4",
            alt: "tsumu in Antigravity's MCP server list",
          },
        ],
      },
    },
    firstTrouble: ["The authorization page doesn't open, or the AI doesn't use Tsumu", "Check that the URL is complete, including the /mcp at the end. The setting's name differs by app: url in Cursor, serverUrl in Antigravity and httpUrl in Gemini CLI's settings.json. Restarting the app or reconnecting often helps."],
  },
};
