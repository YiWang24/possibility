/* ===== 万花筒粒子主视觉生成器 ===== */
// 确定性随机，保证每次渲染一致
function mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function svgEl(tag,attrs){const e=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const k in attrs)e.setAttribute(k,attrs[k]);return e;}

// 在 <svg viewBox="-500 -500 1000 1000"> 内绘制万花筒
function renderBloom(svg, opt){
  opt=opt||{}; const seed=opt.seed||7; const rnd=mulberry(seed);
  const R=opt.R||360;                     // 花半径
  // 按长度程序化生成花瓣路径（尖叶形）
  function petalD(len,wf){const w=len*wf;return `M0,0 C${w.toFixed(1)},${(-0.18*len).toFixed(1)} ${w.toFixed(1)},${(-0.68*len).toFixed(1)} 0,${(-len).toFixed(1)} C${(-w).toFixed(1)},${(-0.68*len).toFixed(1)} ${(-w).toFixed(1)},${(-0.18*len).toFixed(1)} 0,0 Z`;}

  // ---- defs ----
  const defs=svgEl("defs",{});
  defs.innerHTML=`
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="22%" stop-color="#dfd6ff" stop-opacity=".95"/>
      <stop offset="55%" stop-color="#8f7bff" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#7b5cff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="pOuter" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#c14dff" stop-opacity=".05"/>
      <stop offset="45%" stop-color="#7b5cff" stop-opacity=".85"/>
      <stop offset="100%" stop-color="#ff5fa8" stop-opacity=".95"/>
    </linearGradient>
    <linearGradient id="pMid" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#3d9bff" stop-opacity=".04"/>
      <stop offset="50%" stop-color="#4da6ff" stop-opacity=".8"/>
      <stop offset="100%" stop-color="#4de0ff" stop-opacity=".95"/>
    </linearGradient>
    <linearGradient id="pIn" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".2"/>
      <stop offset="100%" stop-color="#eae3ff" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7b5cff" stop-opacity=".28"/>
      <stop offset="55%" stop-color="#4d6bff" stop-opacity=".10"/>
      <stop offset="100%" stop-color="#4d6bff" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soft" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>`;
  svg.appendChild(defs);

  // ---- 外层柔光 halo ----
  svg.appendChild(svgEl("circle",{cx:0,cy:0,r:R*1.5,fill:"url(#halo)"}));

  // ---- 同心细环 + 刻度（科技感） ----
  const rings=svgEl("g",{opacity:.5});
  [1.02,1.22,1.46].forEach((k,i)=>{
    rings.appendChild(svgEl("circle",{cx:0,cy:0,r:R*k,fill:"none",
      stroke:i===1?"rgba(77,224,255,.35)":"rgba(255,255,255,.14)","stroke-width":i===1?1.4:1,
      "stroke-dasharray":i===2?"2 10":"none"}));
  });
  // 外环刻度
  const ticks=svgEl("g",{opacity:.55});
  for(let a=0;a<360;a+=6){const rad=a*Math.PI/180,r1=R*1.46,r2=R*(a%30===0?1.40:1.435);
    ticks.appendChild(svgEl("line",{x1:Math.cos(rad)*r1,y1:Math.sin(rad)*r1,x2:Math.cos(rad)*r2,y2:Math.sin(rad)*r2,
      stroke:"rgba(180,190,255,.5)","stroke-width":a%30===0?1.6:.8}));}
  rings.appendChild(ticks);
  svg.appendChild(rings);

  // ---- 数据流光弧 ----
  const arcs=svgEl("g",{fill:"none","stroke-linecap":"round",opacity:.7,filter:"url(#glow)"});
  const arcCols=["#4de0ff","#ff5fa8","#8f7bff","#4da6ff"];
  for(let i=0;i<10;i++){
    const a0=rnd()*360, sweep=40+rnd()*80, rr=R*(1.05+rnd()*0.55);
    const p0=[Math.cos(a0*Math.PI/180)*rr,Math.sin(a0*Math.PI/180)*rr];
    const p1=[Math.cos((a0+sweep)*Math.PI/180)*rr,Math.sin((a0+sweep)*Math.PI/180)*rr];
    const large=sweep>180?1:0;
    arcs.appendChild(svgEl("path",{d:`M${p0[0]},${p0[1]} A${rr},${rr} 0 ${large} 1 ${p1[0]},${p1[1]}`,
      stroke:arcCols[i%4],"stroke-width":1+rnd()*1.6,opacity:.35+rnd()*.4}));
  }
  svg.appendChild(arcs);

  // ---- 花瓣三层 ----
  function petalLayer(fold,len,wf,grad,rot,op,blur){
    const g=svgEl("g",{opacity:op}); if(blur)g.setAttribute("filter","url(#glow)");
    const d=petalD(len,wf);
    for(let i=0;i<fold;i++){
      g.appendChild(svgEl("path",{d,fill:grad,transform:`rotate(${rot+i*360/fold})`}));
    }
    return g;
  }
  svg.appendChild(petalLayer(8,R,0.14,"url(#pOuter)",0,.6,true));
  svg.appendChild(petalLayer(8,R*0.72,0.12,"url(#pMid)",22.5,.62,true));
  svg.appendChild(petalLayer(12,R*0.4,0.16,"url(#pIn)",0,.85,false));

  // ---- 粒子沿花瓣描边 + 场景漂浮粒子 ----
  const parts=svgEl("g",{});
  const pCols=["#ffffff","#4de0ff","#ff8fc2","#b9a9ff","#8fd0ff"];
  for(let i=0;i<160;i++){
    const ang=rnd()*Math.PI*2;
    // 偏向环形分布
    const band=rnd(); const rr=band<.6? R*(0.2+rnd()*0.95) : R*(1.05+rnd()*0.6);
    const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr, s=rnd()*2.2+.5;
    const c=pCols[(rnd()*pCols.length)|0];
    parts.appendChild(svgEl("circle",{cx:x.toFixed(1),cy:y.toFixed(1),r:s.toFixed(2),fill:c,
      opacity:(.25+rnd()*.7).toFixed(2)}));
    if(s>1.7)parts.setAttribute("filter","url(#glow)");
  }
  const glowParts=svgEl("g",{filter:"url(#glow)"});
  for(let i=0;i<26;i++){const ang=rnd()*Math.PI*2,rr=R*(0.3+rnd()*1.2);
    glowParts.appendChild(svgEl("circle",{cx:(Math.cos(ang)*rr).toFixed(1),cy:(Math.sin(ang)*rr).toFixed(1),
      r:(1.6+rnd()*2.4).toFixed(2),fill:pCols[(rnd()*pCols.length)|0],opacity:.9}));}
  svg.appendChild(parts); svg.appendChild(glowParts);

  // ---- 明亮核心 ----
  svg.appendChild(svgEl("circle",{cx:0,cy:0,r:R*0.5,fill:"url(#core)"}));
  svg.appendChild(svgEl("circle",{cx:0,cy:0,r:6,fill:"#fff",filter:"url(#glow)"}));
}

// 背景星座网（漂浮粒子 + 连线）
function renderMesh(svg,opt){
  opt=opt||{};const rnd=mulberry(opt.seed||3);const W=opt.w||1000,H=opt.h||1000,N=opt.n||46;
  const pts=[];for(let i=0;i<N;i++)pts.push([rnd()*W,rnd()*H]);
  const g=svgEl("g",{stroke:"rgba(140,150,230,.16)","stroke-width":.7});
  for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const dx=pts[i][0]-pts[j][0],dy=pts[i][1]-pts[j][1];
    if(dx*dx+dy*dy<(W*0.16)**2)g.appendChild(svgEl("line",{x1:pts[i][0].toFixed(1),y1:pts[i][1].toFixed(1),x2:pts[j][0].toFixed(1),y2:pts[j][1].toFixed(1)}));}
  svg.appendChild(g);
  const d=svgEl("g",{});for(const p of pts)d.appendChild(svgEl("circle",{cx:p[0].toFixed(1),cy:p[1].toFixed(1),r:(rnd()*1.6+.6).toFixed(1),fill:"rgba(180,190,255,.5)"}));
  svg.appendChild(d);
}
