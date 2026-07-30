/* ===== 扁平 Riso 插画元件库 ===== */
(function(){
const SVGNS="http://www.w3.org/2000/svg";
function E(tag,attrs,kids){const e=document.createElementNS(SVGNS,tag);
  for(const k in attrs)e.setAttribute(k,attrs[k]);
  if(kids)kids.forEach(c=>e.appendChild(c));return e;}
const C={cream:"#FBEFC8",cream2:"#F6E2A8",paper:"#FFFDF6",teal:"#3EC6BD",tealD:"#2A9E97",tealL:"#86D9D1",
  mint:"#52CE8B",mustard:"#F9B233",mustardD:"#E8982A",coral:"#FF5D6C",coralD:"#E84258",
  sky:"#9DC1E8",skyD:"#6E9BD1",ink:"#26261f",skin:"#F4C79B",skin2:"#E0A878"};

const FLAT={
  C,E,
  defs(svg){
    const d=E("defs");
    d.innerHTML=`
      <filter id="sticker" x="-25%" y="-25%" width="150%" height="150%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="9" result="d"/>
        <feFlood flood-color="#FFFDF6"/><feComposite in2="d" operator="in" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="stickerThin" x="-25%" y="-25%" width="150%" height="150%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="5" result="d"/>
        <feFlood flood-color="#FFFDF6"/><feComposite in2="d" operator="in" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="softsh" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="10" stdDeviation="0" flood-color="#26261f" flood-opacity="0.10"/>
      </filter>`;
    svg.appendChild(d);
  },
  // 太阳放射线
  rays(cx,cy,R,n,cols){
    const g=E("g",{});
    for(let i=0;i<n;i++){
      const a0=(i/n)*Math.PI*2, a1=((i+0.5)/n)*Math.PI*2;
      const p=`M${cx},${cy} L${cx+Math.cos(a0)*R},${cy+Math.sin(a0)*R} L${cx+Math.cos(a1)*R},${cy+Math.sin(a1)*R} Z`;
      g.appendChild(E("path",{d:p,fill:cols[i%cols.length]}));
    }
    return g;
  },
  // 扁平万花筒花（品牌图形）
  flower(cx,cy,R,c1,c2,core){
    const g=E("g",{transform:`translate(${cx},${cy})`,filter:"url(#sticker)"});
    const fold=8;
    function petal(len,w,col,rot){
      const d=`M0,0 C${w},${-0.35*len} ${w},${-0.85*len} 0,${-len} C${-w},${-0.85*len} ${-w},${-0.35*len} 0,0 Z`;
      return E("path",{d,fill:col,transform:`rotate(${rot})`});
    }
    for(let i=0;i<fold;i++)g.appendChild(petal(R,R*0.34,c1,i*360/fold));
    for(let i=0;i<fold;i++)g.appendChild(petal(R*0.66,R*0.28,c2,i*360/fold+22.5));
    g.appendChild(E("circle",{r:R*0.2,fill:core}));
    g.appendChild(E("circle",{r:R*0.09,fill:C.paper}));
    return g;
  },
  star(cx,cy,r,col){
    const pts=[];for(let i=0;i<10;i++){const rr=i%2?r*0.44:r;const a=-Math.PI/2+i*Math.PI/5;
      pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);}
    return E("path",{d:"M"+pts.map(p=>p[0].toFixed(1)+","+p[1].toFixed(1)).join("L")+"Z",fill:col,filter:"url(#stickerThin)"});
  },
  cloud(cx,cy,s,col){
    const g=E("g",{transform:`translate(${cx},${cy}) scale(${s})`,filter:"url(#stickerThin)"});
    [[-30,4,26],[0,-6,32],[30,4,26]].forEach(c=>g.appendChild(E("circle",{cx:c[0],cy:c[1],r:c[2],fill:col})));
    g.appendChild(E("rect",{x:-42,y:0,width:84,height:22,rx:11,fill:col}));
    return g;
  },
  // 通用小人
  person(x,y,s,o){o=o||{};const shirt=o.shirt||C.coral,pants=o.pants||C.skyD,hair=o.hair||C.ink,skin=o.skin||C.skin,shoe=o.shoe||C.mustard;
    const g=E("g",{transform:`translate(${x},${y}) scale(${s})`,filter:"url(#sticker)"});
    // 腿
    g.appendChild(E("rect",{x:-20,y:-58,width:16,height:56,rx:7,fill:pants}));
    g.appendChild(E("rect",{x:4,y:-58,width:16,height:56,rx:7,fill:pants}));
    // 鞋
    g.appendChild(E("rect",{x:-22,y:-10,width:20,height:12,rx:5,fill:shoe}));
    g.appendChild(E("rect",{x:2,y:-10,width:20,height:12,rx:5,fill:shoe}));
    // 身体
    g.appendChild(E("path",{d:"M-26,-118 Q-28,-64 -22,-58 L22,-58 Q28,-64 26,-118 Q0,-132 -26,-118 Z",fill:shirt}));
    // 手臂
    g.appendChild(E("rect",{x:-34,y:-116,width:13,height:52,rx:6,fill:shirt}));
    g.appendChild(E("rect",{x:21,y:-116,width:13,height:52,rx:6,fill:shirt}));
    g.appendChild(E("circle",{cx:-28,cy:-62,r:7,fill:skin}));
    g.appendChild(E("circle",{cx:28,cy:-62,r:7,fill:skin}));
    // 头
    g.appendChild(E("circle",{cx:0,cy:-142,r:23,fill:skin}));
    g.appendChild(E("path",{d:"M-23,-150 Q-20,-172 0,-170 Q22,-172 23,-148 Q14,-160 0,-158 Q-12,-160 -23,-150 Z",fill:hair}));
    return g;
  },
  // 小图标（viewBox 建议 -40 -40 80 80）
  icon(name){
    const g=E("g",{filter:"url(#stickerThin)"});const a=(t,at)=>g.appendChild(E(t,at));
    switch(name){
      case "chart": a("rect",{x:-26,y:-4,width:14,height:30,rx:4,fill:C.teal});
        a("rect",{x:-7,y:-20,width:14,height:46,rx:4,fill:C.coral});
        a("rect",{x:12,y:-12,width:14,height:38,rx:4,fill:C.mustard});break;
      case "cards": a("rect",{x:-26,y:-20,width:34,height:46,rx:7,fill:C.sky,transform:"rotate(-12 -9 3)"});
        a("rect",{x:-6,y:-22,width:34,height:46,rx:7,fill:C.coral,transform:"rotate(10 11 1)"});
        a("circle",{cx:11,cy:1,r:8,fill:C.paper});break;
      case "mic": a("rect",{x:-11,y:-28,width:22,height:38,rx:11,fill:C.coral});
        a("path",{d:"M-18,2 a18,18 0 0 0 36,0",fill:"none",stroke:C.tealD,"stroke-width":5});
        a("rect",{x:-3,y:14,width:6,height:12,rx:3,fill:C.tealD});
        a("rect",{x:-13,y:24,width:26,height:6,rx:3,fill:C.tealD});break;
      case "sun": a("circle",{cx:0,cy:0,r:16,fill:C.mustard});
        for(let i=0;i<8;i++){const an=i*Math.PI/4;a("rect",{x:-2.5,y:-33,width:5,height:11,rx:2.5,fill:C.mustard,transform:`rotate(${i*45})`});}break;
      case "cloud": a("circle",{cx:-14,cy:2,r:14,fill:C.sky});a("circle",{cx:6,cy:-6,r:18,fill:C.sky});
        a("circle",{cx:20,cy:4,r:12,fill:C.sky});a("rect",{x:-24,y:4,width:48,height:14,rx:7,fill:C.sky});break;
      case "rain": a("circle",{cx:-12,cy:-6,r:13,fill:C.skyD});a("circle",{cx:8,cy:-12,r:16,fill:C.skyD});
        a("rect",{x:-22,y:-4,width:42,height:12,rx:6,fill:C.skyD});
        [[-12,14],[2,18],[14,12]].forEach(p=>a("rect",{x:p[0],y:p[1],width:5,height:14,rx:2.5,fill:C.teal}));break;
      case "chat": a("path",{d:"M-28,-20 h56 a8,8 0 0 1 8,8 v18 a8,8 0 0 1 -8,8 h-30 l-14,12 v-12 h-4 a8,8 0 0 1 -8,-8 v-18 a8,8 0 0 1 8,-8 Z",fill:C.coral});
        [[-14,-3],[0,-3],[14,-3]].forEach(p=>a("circle",{cx:p[0],cy:p[1],r:3.5,fill:C.paper}));break;
      case "cap": a("path",{d:"M0,-22 L34,-8 L0,6 L-34,-8 Z",fill:C.ink});
        a("path",{d:"M-20,-2 v16 a20,10 0 0 0 40,0 v-16",fill:C.coral});
        a("rect",{x:32,y:-8,width:3,height:22,fill:C.ink});a("circle",{cx:33.5,cy:16,r:5,fill:C.mustard});break;
      case "heart": a("path",{d:"M0,22 C-30,2 -26,-24 -8,-24 C-2,-24 0,-18 0,-14 C0,-18 2,-24 8,-24 C26,-24 30,2 0,22 Z",fill:C.coral});break;
      case "compass": a("circle",{cx:0,cy:0,r:28,fill:C.teal});a("circle",{cx:0,cy:0,r:28,fill:"none",stroke:C.paper,"stroke-width":4});
        a("path",{d:"M0,-18 L8,0 L0,18 L-8,0 Z",fill:C.coral});a("circle",{cx:0,cy:0,r:4,fill:C.paper});break;
    }
    return g;
  }
};
window.FLAT=FLAT;
})();
