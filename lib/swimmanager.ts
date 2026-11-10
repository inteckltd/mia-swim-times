export function isSwimManagerLogin(html: string, finalUrl = ""): boolean {
  if (/\/login(?:[/?#]|$)/i.test(finalUrl)) return true;
  return /<title>[^<]*login[^<]*<\/title>/i.test(html);
}
