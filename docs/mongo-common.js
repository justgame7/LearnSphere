/* LearnSphere - MongoDB course: shared helpers. Loaded on demand before any mongo-sNN.js section file.
   Authoring rules for mongo-sNN.js:
   - One file per section. Each file is a self-contained IIFE that adds lessons to window.LESSONS and nothing else.
   - Lesson key = 'mongo:<sectionIndex>:<lectureIndex>' using the order of the lectures in index.html (0-based, additional lectures included).
   - Quiz key = window.QUIZZES['mongo:<sectionIndex>'] in mongo-qNN.js.
   - Block types: p, h, ul, t (table, first row = header), flow, code, svg, note. Inline: `code` and **bold**. Do not use apostrophes inside single-quoted strings.
   - src = [[label, url]] pointing at mongodb.com/docs (MongoDB 8.0 is the baseline, other versions are marked in the text).
   - Code blocks are template literals: no backticks, no ${ and double any backslash. */
window.LESSONS=window.LESSONS||{};
window.MONGO=window.MONGO||{};
(function(){
const M=window.MONGO;
M.D='https://www.mongodb.com/docs/';
M.MAN=M.D+'manual/';                       /* Server manual */
M.ATLAS=M.D+'atlas/';                      /* Atlas */
M.SH=M.D+'mongodb-shell/';                 /* mongosh */
M.TOOLS=M.D+'database-tools/';             /* mongodump, mongorestore ... */
M.REL=M.MAN+'release-notes/';              /* Release notes */
M.LC='https://www.mongodb.com/legal/support-policy/lifecycles';
/* Diagram helper. boxes: [x,y,w,h,label,kind] kind 0 plain, 1 dashed group (label top-left), 2 highlighted. Use | in a label for a line break.
   arrows: [x1,y1,x2,y2]. */
M.dg=(w,h,B,A)=>{const t=(x,y,l)=>l.split('|').map((s,i,a)=>`<text x="${x}" y="${y+(i-(a.length-1)/2)*14}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="var(--tx)">${s}</text>`).join('');
return `<svg viewBox="0 0 ${w} ${h}" font-family="Space Grotesk,sans-serif"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>`+
B.map(([x,y,bw,bh,l,k])=>k==1?`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="none" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="${x+10}" y="${y+16}" font-size="11" fill="var(--accent)">${l}</text>`:`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="9" fill="${k==2?'color-mix(in srgb,var(--accent) 22%,var(--panel2))':'var(--panel2)'}" stroke="var(--line)"/>`+t(x+bw/2,y+bh/2,l)).join('')+
A.map(([a,b,c,d])=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#ah)"/>`).join('')+'</svg>'};
})();
