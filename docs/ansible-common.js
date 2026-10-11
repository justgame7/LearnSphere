/* LearnSphere - Ansible course: shared helpers. Loaded on demand before any ansible-sNN.js section file.
   Authoring rules for ansible-sNN.js:
   - One file per section. Each file is a self-contained IIFE that adds lessons to window.LESSONS and nothing else.
   - Lesson key = 'ansible:<sectionIndex>:<lectureIndex>' using the order of the lectures in index.html (0-based, additional lectures included).
   - Block types: p, h, ul, t (table, first row = header), flow, code, svg, note. Inline: `code` and **bold**. Do not use apostrophes inside single-quoted strings.
   - src = [[label, url]] pointing at docs.ansible.com or the ansible.readthedocs.io project documentation.
   - Code blocks are template literals: no backticks, write \${ for a literal ${ and double any backslash. Jinja braces are safe. */
window.LESSONS=window.LESSONS||{};
window.AN=window.AN||{};
(function(){
const K=window.AN;
K.D='https://docs.ansible.com/ansible/latest/';
K.UG=K.D+'user_guide/';
K.CLI=K.D+'cli/';
K.MOD=K.D+'collections/';
K.PB=K.UG+'playbooks_intro.html';
K.INV=K.UG+'intro_inventory.html';
K.DEV=K.D+'dev_guide/';
K.INST=K.D+'installation_guide/';
K.GAL=K.D+'galaxy/';
K.AWX='https://ansible.readthedocs.io/projects/awx/en/latest/';
K.AWXU=K.AWX+'userguide/';
K.EDA='https://ansible.readthedocs.io/projects/rulebook/en/stable/';
K.MOL='https://ansible.readthedocs.io/projects/molecule/';
K.LINT='https://ansible.readthedocs.io/projects/lint/';
K.NAV='https://ansible.readthedocs.io/projects/navigator/';
K.BLD='https://ansible.readthedocs.io/projects/builder/';
/* Diagram helper. boxes: [x,y,w,h,label,kind] kind 0 plain, 1 dashed group (label top-left), 2 highlighted. Use | in a label for a line break.
   arrows: [x1,y1,x2,y2]. Labels must not contain angle brackets or ampersands. */
K.dg=(w,h,B,A)=>{const t=(x,y,l)=>l.split('|').map((s,i,a)=>`<text x="${x}" y="${y+(i-(a.length-1)/2)*14}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="var(--tx)">${s}</text>`).join('');
return `<svg viewBox="0 0 ${w} ${h}" font-family="Space Grotesk,sans-serif"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>`+
B.map(([x,y,bw,bh,l,k])=>k==1?`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="none" stroke="var(--accent)" stroke-dasharray="5 4"/><text x="${x+10}" y="${y+16}" font-size="11" fill="var(--accent)">${l}</text>`:`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="9" fill="${k==2?'color-mix(in srgb,var(--accent) 22%,var(--panel2))':'var(--panel2)'}" stroke="var(--line)"/>`+t(x+bw/2,y+bh/2,l)).join('')+
A.map(([a,b,c,d])=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#ah)"/>`).join('')+'</svg>'};
})();
