/**
 * 打开招标原文件：接口要带登录令牌，不能直接用 <a href>，所以先取回再交给浏览器。
 * PDF、图片、文本在新标签页打开，其余格式下载。新标签页先同步开出来，避免被拦截弹窗。
 */
export async function openTenderFile(bidId: string, fileId: string, name: string) {
  const inline = /\.(pdf|txt|md|csv|jpe?g|png|gif|webp)$/i.test(name);
  const tab = inline ? window.open('', '_blank') : null;
  try {
    const r = await fetch(`/api/bids/${encodeURIComponent(bidId)}/tender/files/${encodeURIComponent(fileId)}`, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('sb-token') || '') } });
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message || `打开失败（${r.status}）`);
    const url = URL.createObjectURL(await r.blob());
    if (tab) tab.location.href = url;
    else { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) { tab?.close(); throw e; }
}
