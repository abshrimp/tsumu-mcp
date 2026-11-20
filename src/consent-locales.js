export const consentMessages = {
  en: {
    pageTitle: "Connect an AI application | Tsumu",
    title: "Connect to Tsumu",
    intro: "Enter the connection code from Tsumu to grant this application access to your site.",
    firstTimeIntro: "Choose an existing Tsumu site, enter a self-hosted connection code, or allow new-site creation.",
    chooseOfficial: "Choose a site in Tsumu",
    chooseOfficialHelp: "Select a site and its permissions in the official Tsumu editor. Only sites you approve can be accessed.",
    codeOption: "Have a connection code? Use it here",
    verifiedDomain: "Verified domain: ",
    unverifiedDomain: "Application identity not verified",
    redirect: "Return destination",
    loopback: "Authorization will return to an application running on your device.",
    scopes: "Requested permissions",
    details: "Connection details",
    restricted: "Access is limited to the paired site's permissions. A new-site-only grant cannot access existing sites.",
    code: "Connection code",
    codeHelp: "Find the code in the AI connection panel of the site you want to connect. Never use a code received from someone else.",
    approve: "Allow access",
    draftHelp: "Don't have a connection code? You can allow temporary new-site drafts without connecting an existing site.",
    draftOnly: "Allow new-site creation only",
    deny: "Cancel",
    errorTitle: "Couldn't complete the connection",
    invalidCode: "The connection code is invalid. Check the code in Tsumu and try again.",
    expiredCode: "The code has expired, has already been used, or the Tsumu editor is no longer connected. Create a new connection in Tsumu.",
    tooMany: "Too many connection attempts. Try again later.",
    invalidRequest: "This authorization request is invalid or has expired. Start the connection again in your AI application.",
    genericError: "Unable to complete authorization. Please try connecting again.",
    errorHelp: "Return to the previous page or start a new connection from your AI application."
  },
  ja: {
    pageTitle: "AIアプリとの接続 | Tsumu",
    title: "Tsumuへの接続",
    intro: "Tsumuの接続コードを入力して、このアプリにサイトへのアクセスを許可します。",
    firstTimeIntro: "公式Tsumuのサイトを選択するか、セルフホスト版の接続コードを入力してください。",
    chooseOfficial: "Tsumuでサイトを選択",
    chooseOfficialHelp: "公式Tsumuでサイトと権限を選択します。許可したサイトのみAIアプリから操作できます。",
    codeOption: "接続コードがある場合はこちら",
    verifiedDomain: "確認済みドメイン：",
    unverifiedDomain: "アプリの提供元を確認できません",
    redirect: "認証後の移動先",
    loopback: "認証後は、この端末で動作するアプリに戻ります。",
    scopes: "要求された権限",
    details: "接続の詳細",
    restricted: "アクセスできる範囲は、接続したサイトの権限に従います。新規サイト作成のみの場合、既存サイトにはアクセスできません。",
    code: "接続コード",
    codeHelp: "接続するサイトのAI接続パネルに表示されたコードを入力してください。他人から渡されたコードは使用しないでください。",
    approve: "接続を許可",
    draftHelp: "接続コードがない場合、既存サイトに接続せず、新規サイトの一時作成だけを許可できます。",
    draftOnly: "新規サイトの作成のみ許可",
    deny: "キャンセル",
    errorTitle: "接続を完了できませんでした",
    invalidCode: "接続コードが正しくありません。Tsumuに表示されたコードを確認してください。",
    expiredCode: "コードの期限が切れたか、使用済み、またはTsumuのエディターとの接続が切れています。Tsumuで接続し直してください。",
    tooMany: "接続の試行回数が多すぎます。時間をおいてお試しください。",
    invalidRequest: "認証リクエストが無効か、有効期限が切れています。AIアプリから接続をやり直してください。",
    genericError: "認証を完了できませんでした。接続をやり直してください。",
    errorHelp: "前のページに戻るか、AIアプリから新しく接続を開始してください。"
  }
};

export function consentLocale(request, submittedLanguage) {
  if (submittedLanguage === "ja" || submittedLanguage === "en") return submittedLanguage;
  const selected = new URL(request.url).searchParams.get("lang");
  if (selected === "ja" || selected === "en") return selected;
  const accepted = (request.headers.get("Accept-Language") || "")
    .split(",")
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const qualityPart = parameters.find(part => /^q=/i.test(part.trim()));
      const quality = qualityPart ? Number(qualityPart.trim().slice(2)) : 1;
      return { tag: tag.toLowerCase(), quality, index };
    })
    .filter(entry => Number.isFinite(entry.quality) && entry.quality > 0 && entry.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  for (const { tag } of accepted) {
    if (tag === "ja" || tag.startsWith("ja-")) return "ja";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return "en";
}

export function consentErrorKey(message) {
  if (message === "Invalid pairing code") return "invalidCode";
  if (message.startsWith("Too many")) return "tooMany";
  if (message.startsWith("The browser") || message.startsWith("Unable to pair") || message.startsWith("Invalid or expired")) return "expiredCode";
  return "genericError";
}
