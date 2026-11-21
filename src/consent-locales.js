export const consentMessages = {
  en: {
    pageTitle: "Connect an AI application | Tsumu",
    title: "Connect to Tsumu",
    intro: "Review the application and choose which access to allow.",
    existingSite: "Connect existing sites",
    newSite: "Create a new site",
    newSiteHelp: "Does not grant access to existing sites",
    unverifiedShort: "Identity not verified",
    approveSelectedSites: "Allow access to selected sites",
    chooseOfficial: "Choose a site",
    allowEdit: "Allow editing",
    codeOption: "Enter a connection code",
    verifiedDomain: "Verified domain: ",
    unverifiedDomain: "Application identity not verified",
    redirect: "Return destination",
    loopback: "Authorization will return to an application running on your device.",
    scopes: "Requested permissions",
    details: "Connection details",
    restricted: "Access is limited to the paired site's permissions. A new-site-only grant cannot access existing sites.",
    code: "Connection code",
    codeHelp: "Enter the code shown in your Tsumu editor.",
    approve: "Allow access",
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
    intro: "接続元のアプリを確認し、許可する操作を選択してください。",
    existingSite: "既存のサイトを接続",
    newSite: "新しいサイトを作成",
    newSiteHelp: "既存サイトへのアクセスは許可されません",
    unverifiedShort: "提供元は未検証",
    approveSelectedSites: "選択したサイトへの接続を許可",
    chooseOfficial: "サイトを選択",
    allowEdit: "編集を許可",
    codeOption: "接続コードを入力",
    verifiedDomain: "確認済みドメイン：",
    unverifiedDomain: "アプリの提供元を確認できません",
    redirect: "認証後の移動先",
    loopback: "認証後は、この端末で動作するアプリに戻ります。",
    scopes: "要求された権限",
    details: "接続の詳細",
    restricted: "アクセスできる範囲は、接続したサイトの権限に従います。新規サイト作成のみの場合、既存サイトにはアクセスできません。",
    code: "接続コード",
    codeHelp: "Tsumuのエディターに表示されたコードを入力してください。",
    approve: "接続を許可",
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
