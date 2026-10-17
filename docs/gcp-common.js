/* LearnSphere - Google Cloud course: shared helpers. Loaded on demand before any gcp-sNN.js section file.
   Authoring rules for gcp-sNN.js:
   - One file per section. Each file is a self-contained IIFE that adds lessons to window.LESSONS and nothing else.
   - Lesson key = 'gcp:<sectionIndex>:<lectureIndex>' using the order of the lectures in index.html (0-based).
   - Block types: p, h, ul, t (table, first row = header), flow, code, svg, note. Inline: `code` and **bold**. Do not use apostrophes inside single-quoted strings.
   - src = [[label, url]] pointing at the Google Cloud documentation.
   - Code blocks are template literals: no backticks, write \${ for a literal ${ and double any backslash. */
window.LESSONS=window.LESSONS||{};
window.GC=window.GC||{};
(function(){
const K=window.GC;
K.D='https://cloud.google.com/docs';
K.IAM='https://cloud.google.com/iam/docs/';
K.RM='https://cloud.google.com/resource-manager/docs/';
K.BILL='https://cloud.google.com/billing/docs/';
K.VPC='https://cloud.google.com/vpc/docs/';
K.NET='https://cloud.google.com/network-connectivity/docs/';
K.LB='https://cloud.google.com/load-balancing/docs/';
K.GCE='https://cloud.google.com/compute/docs/';
K.GCS='https://cloud.google.com/storage/docs/';
K.GKE='https://cloud.google.com/kubernetes-engine/docs/';
K.RUN='https://cloud.google.com/run/docs/';
K.SQL='https://cloud.google.com/sql/docs/';
K.BQ='https://cloud.google.com/bigquery/docs/';
K.OPS='https://cloud.google.com/stackdriver/docs/';
K.MON='https://cloud.google.com/monitoring/docs/';
K.LOG='https://cloud.google.com/logging/docs/';
K.SEC='https://cloud.google.com/security/';
K.SDK='https://cloud.google.com/sdk/docs/';
K.ARCH='https://cloud.google.com/architecture/';
K.dg=(w,h,B,A)=>{const t=(x,y,l)=>l.split('|').map((s,i,a)=>`<text x="${x}" y="${y+(i-(a.length-1)/2)*14}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="var(--tx)">${s}</text>`).join('');
return `<svg viewBox="0 0 ${w} ${h}" font-family="Space Grotesk,sans-serif"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>`+
B.map(([x,y,bw,bh,l,k])=>k==1?`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="none" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="${x+10}" y="${y+16}" font-size="11" fill="var(--accent)">${l}</text>`:`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="9" fill="${k==2?'color-mix(in srgb,var(--accent) 22%,var(--panel2))':'var(--panel2)'}" stroke="var(--line)"/>`+t(x+bw/2,y+bh/2,l)).join('')+
A.map(([a,b,c,d])=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#ah)"/>`).join('')+'</svg>'};
/* Row helper: a left-to-right chain of equal boxes with arrows. items: labels, hi: index to highlight, title: dashed group label. */
K.row=(items,hi,title)=>{const n=items.length,W=700,g=18,bw=Math.floor((W-40-g*(n-1))/n),y=title?44:20,H=title?130:100;
const B=[],A=[];if(title)B.push([10,8,W-20,H-16,title,1]);
items.forEach((l,i)=>{const x=20+i*(bw+g);B.push([x,y,bw,60,l,i===hi?2:0]);if(i<n-1)A.push([x+bw,y+30,x+bw+g,y+30])});
return K.dg(W,H,B,A)};
})();
