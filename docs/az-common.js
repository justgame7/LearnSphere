/* LearnSphere - Azure Administrator course: shared helpers. Loaded on demand before any az-sNN.js section file.
   Authoring rules for az-sNN.js:
   - One file per section. Each file is a self-contained IIFE that adds lessons to window.LESSONS and nothing else.
   - Lesson key = 'az:<sectionIndex>:<lectureIndex>' using the order of the lectures in index.html (0-based, additional lectures included).
   - Block types: p, h, ul, t (table, first row = header), flow, code, svg, note. Inline: `code` and **bold**. Do not use apostrophes inside single-quoted strings.
   - src = [[label, url]] pointing at Microsoft Learn documentation.
   - Code blocks are template literals: no backticks (use splatting, not the PowerShell backtick), write \${ for a literal ${ (Bicep interpolation) and double any backslash. */
window.LESSONS=window.LESSONS||{};
window.AZ=window.AZ||{};
(function(){
const K=window.AZ;
K.D='https://learn.microsoft.com/en-us/azure/';
K.ENTRA='https://learn.microsoft.com/en-us/entra/';
K.CLI='https://learn.microsoft.com/en-us/cli/azure/';
K.PS='https://learn.microsoft.com/en-us/powershell/azure/';
K.BICEP='https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/';
K.ARM='https://learn.microsoft.com/en-us/azure/azure-resource-manager/';
K.RBAC='https://learn.microsoft.com/en-us/azure/role-based-access-control/';
K.POLICY='https://learn.microsoft.com/en-us/azure/governance/policy/';
K.STOR='https://learn.microsoft.com/en-us/azure/storage/';
K.VM='https://learn.microsoft.com/en-us/azure/virtual-machines/';
K.NET='https://learn.microsoft.com/en-us/azure/virtual-network/';
K.MON='https://learn.microsoft.com/en-us/azure/azure-monitor/';
K.BKP='https://learn.microsoft.com/en-us/azure/backup/';
K.ASR='https://learn.microsoft.com/en-us/azure/site-recovery/';
K.KV='https://learn.microsoft.com/en-us/azure/key-vault/';
K.APP='https://learn.microsoft.com/en-us/azure/app-service/';
K.CAF='https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/';
K.WAF='https://learn.microsoft.com/en-us/azure/well-architected/';
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
