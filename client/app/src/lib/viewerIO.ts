// Download e área de transferência compatíveis com o visualizador de artefatos
// (onde links <a download> são bloqueados) e com um site comum.
declare global { interface Window { claude?: any } }

let downloadsPromise: Promise<any> | null = null;
function getDownloads() {
  if (!downloadsPromise) {
    downloadsPromise = (async () => {
      try { return window.claude?.use ? await window.claude.use("downloads") : null; } catch { return null; }
    })();
  }
  return downloadsPromise;
}
if (typeof window !== "undefined") setTimeout(() => { getDownloads(); }, 0);

export async function saveTextFile(filename: string, content: string): Promise<boolean> {
  const downloads = await getDownloads();
  if (downloads) {
    try {
      await downloads.save({ filename, data: new Blob(["﻿" + content], { type: "text/plain;charset=utf-8" }) });
      return true;
    } catch (e: any) {
      // recusado pelo usuário ou indisponível
      return false;
    }
  }
  const blob = new Blob(["﻿" + content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function copyText(text: string): Promise<boolean> {
  const fallback = () => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  };
  try {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => fallback());
    }
  } catch {}
  return Promise.resolve(fallback());
}
