/* LearnSphere - Redis course: shared helpers. Loaded on demand before any redis-sNN.js section file.
   Authoring rules for redis-sNN.js:
   - One file per section. Each file is a self-contained IIFE that adds lessons to window.LESSONS and nothing else.
   - Lesson key = 'redis:<sectionIndex>:<lectureIndex>' using the order of the lectures in index.html (0-based).
   - Block types: p, h, ul, t (table, first row = header), flow, code, svg, note. Inline: `code` and **bold**. Do not use apostrophes inside single-quoted strings.
   - src = [[label, url]] pointing at redis.io documentation (Redis 8 is the baseline, other versions are marked in the text).
   - Code blocks are template literals: no backticks, write \${ for a literal ${ and double any backslash. */
window.LESSONS=window.LESSONS||{};
window.RD=window.RD||{};
(function(){
const K=window.RD;
K.D='https://redis.io/docs/latest/';
K.CMD=K.D+'commands/';
K.DT=K.D+'develop/data-types/';
K.OPS=K.D+'operate/oss_and_stack/';
K.MGT=K.OPS+'management/';
K.GS=K.D+'develop/get-started/';
K.INT=K.D+'develop/interact/';
K.CL=K.D+'develop/clients/';
/* Diagram helper. boxes: [x,y,w,h,label,kind] kind 0 plain, 1 dashed group (label top-left), 2 highlighted. Use | in a label for a line break.
   arrows: [x1,y1,x2,y2]. Labels must not contain angle brackets or ampersands. */
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
