/** Keep the private follow-up block (including its partial opening fence) off screen. */
export function visibleStreamText(raw:string){
 const markers=['```salesbuddy-followups','```salesbuddy-navigator'];const first=Math.min(...markers.map(m=>raw.indexOf(m)).filter(i=>i>=0));if(Number.isFinite(first))return raw.slice(0,first).trimEnd();
 for(const marker of markers){
 for(let n=Math.min(marker.length-1,raw.length);n>0;n--)if(raw.endsWith(marker.slice(0,n)))return raw.slice(0,-n);}
 return raw;
}
