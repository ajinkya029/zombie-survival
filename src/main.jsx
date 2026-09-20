import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Crosshair, Heart, Shield, Skull, Zap, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import "./styles.css";

const W = 960, H = 540;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a,b) => Math.random()*(b-a)+a;
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

function App(){
  const canvasRef = useRef(null);
  const keys = useRef({});
  const mouse = useRef({x: W/2, y:H/2, down:false});
  const raf = useRef(null);
  const last = useRef(0);
  const game = useRef(null);
  const [status,setStatus] = useState("menu");
  const [hud,setHud] = useState({wave:1, score:0, kills:0, hp:100, ammo:12, reserve:72, progress:0});
  const [muted,setMuted] = useState(false);

  const reset = () => {
    game.current = {
      player:{x:W/2,y:H/2,r:16,hp:100,ammo:12,reserve:72,reload:0,fire:0,inv:0},
      zombies:[], bullets:[], particles:[], pickups:[], wave:1, spawned:0, spawnTimer:0,
      score:0,kills:0, waveDelay:0, shake:0, paused:false
    };
    setHud({wave:1,score:0,kills:0,hp:100,ammo:12,reserve:72,progress:0});
  };
  const start = () => { reset(); setStatus("playing"); last.current=0; };
  const shoot = (g) => {
    const p=g.player;
    if(p.reload>0 || p.fire>0) return;
    if(p.ammo<=0){ if(p.reserve>0)p.reload=.8; return; }
    const a=Math.atan2(mouse.current.y-p.y,mouse.current.x-p.x);
    p.ammo--; p.fire=.16;
    g.bullets.push({x:p.x+Math.cos(a)*20,y:p.y+Math.sin(a)*20,vx:Math.cos(a)*780,vy:Math.sin(a)*780,r:4,life:1});
    for(let i=0;i<3;i++)g.particles.push({x:p.x+Math.cos(a)*25,y:p.y+Math.sin(a)*25,vx:rand(-60,60)+Math.cos(a)*rand(40,100),vy:rand(-60,60)+Math.sin(a)*rand(40,100),life:.25,color:"#ffd166"});
  };
  const spawn = (g) => {
    const side=Math.floor(rand(0,4)); let x,y;
    if(side===0){x=rand(0,W);y=-30}else if(side===1){x=W+30;y=rand(0,H)}else if(side===2){x=rand(0,W);y=H+30}else{x=-30;y=rand(0,H)}
    const elite=Math.random()<Math.min(.08,g.wave*.012);
    g.zombies.push({x,y,r:elite?23:17,hp:elite?4:1,max:elite?4:1,speed:(elite?35:rand(42,62))+g.wave*2,elite,hit:0});
  };
  const update = (g,dt) => {
    const p=g.player;
    if(g.waveDelay>0){g.waveDelay-=dt; if(g.waveDelay<=0){g.wave++;g.spawned=0;} }
    const target=8+g.wave*4;
    if(g.spawned<target && g.waveDelay<=0){g.spawnTimer-=dt;if(g.spawnTimer<=0){spawn(g);g.spawned++;g.spawnTimer=Math.max(.18,.8-g.wave*.025);}}
    if(g.spawned>=target && g.zombies.length===0 && g.waveDelay<=0)g.waveDelay=2.2;
    let dx=(keys.current.d||keys.current.arrowright?1:0)-(keys.current.a||keys.current.arrowleft?1:0);
    let dy=(keys.current.s||keys.current.arrowdown?1:0)-(keys.current.w||keys.current.arrowup?1:0);
    if(dx||dy){const n=Math.hypot(dx,dy);p.x+=dx/n*190*dt;p.y+=dy/n*190*dt;}
    p.x=clamp(p.x,25,W-25);p.y=clamp(p.y,25,H-25);
    p.fire=Math.max(0,p.fire-dt);p.inv=Math.max(0,p.inv-dt);
    if(p.reload>0){p.reload-=dt;if(p.reload<=0){let take=Math.min(12-p.ammo,p.reserve);p.ammo+=take;p.reserve-=take;}}
    if(mouse.current.down)shoot(g);
    g.bullets.forEach(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;});
    g.bullets=g.bullets.filter(b=>b.life>0&&b.x>-20&&b.x<W+20&&b.y>-20&&b.y<H+20);
    g.zombies.forEach(z=>{
      const a=Math.atan2(p.y-z.y,p.x-z.x);z.x+=Math.cos(a)*z.speed*dt;z.y+=Math.sin(a)*z.speed*dt;z.hit=Math.max(0,z.hit-dt);
      if(distance(z,p)<z.r+p.r&&p.inv<=0){p.hp-=z.elite?18:9;p.inv=.55;g.shake=8;}
    });
    g.bullets.forEach(b=>g.zombies.forEach(z=>{
      if(distance(b,z)<b.r+z.r&&z.hp>0){z.hp--;b.life=0;z.hit=.1;g.particles.push({x:z.x,y:z.y,vx:rand(-100,100),vy:rand(-100,100),life:.35,color:z.elite?"#ff7b72":"#b7e36b"});if(z.hp<=0){g.score+=z.elite?100:25;g.kills++;if(Math.random()<.12)g.pickups.push({x:z.x,y:z.y,type:"med"});}}
    }));
    g.zombies=g.zombies.filter(z=>z.hp>0);
    g.pickups=g.pickups.filter(item=>{if(distance(item,p)<25){if(item.type==="med")p.hp=clamp(p.hp+20,0,100);return false;}return true;});
    g.particles.forEach(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;q.vx*=.96;q.vy*=.96;});g.particles=g.particles.filter(q=>q.life>0);
    g.shake=Math.max(0,g.shake-dt*25);
    if(p.hp<=0)setStatus("gameover");
    setHud({wave:g.wave,score:g.score,kills:g.kills,hp:Math.round(p.hp),ammo:p.ammo,reserve:p.reserve,progress:Math.min(100,g.spawned/target*100)});
  };
  const draw = (ctx,g) => {
    ctx.save();
    if(g.shake)ctx.translate(rand(-g.shake,g.shake),rand(-g.shake,g.shake));
    ctx.fillStyle="#0b1016";ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="rgba(116,145,160,.10)";ctx.lineWidth=1;
    for(let x=0;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // arena accents
    ctx.strokeStyle="rgba(90,220,170,.25)";ctx.lineWidth=2;ctx.strokeRect(18,18,W-36,H-36);
    g.pickups.forEach(i=>{ctx.fillStyle="#7cf29a";ctx.beginPath();ctx.arc(i.x,i.y,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="#092014";ctx.fillRect(i.x-2,i.y-6,4,12);ctx.fillRect(i.x-6,i.y-2,12,4);});
    g.particles.forEach(q=>{ctx.globalAlpha=Math.max(0,q.life*3);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x,q.y,rand(1,4),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;});
    g.bullets.forEach(b=>{ctx.fillStyle="#ffe29a";ctx.shadowBlur=12;ctx.shadowColor="#ffd166";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;});
    g.zombies.forEach(z=>{
      ctx.save();ctx.translate(z.x,z.y);const a=Math.atan2(g.player.y-z.y,g.player.x-z.x);ctx.rotate(a);
      ctx.fillStyle=z.elite?"#7d293d":"#385b46";ctx.beginPath();ctx.arc(0,0,z.r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=z.hit>0?"#fff1e6":"#9dc7a4";ctx.beginPath();ctx.arc(0,-3,z.r*.72,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#151b20";ctx.fillRect(2,-8,5,4);ctx.fillRect(2,3,5,4);
      ctx.fillStyle="#d85b5b";ctx.fillRect(-z.r,-z.r-8,z.r*2,3);ctx.fillStyle="#7cf29a";ctx.fillRect(-z.r,-z.r-8,z.r*2*(z.hp/z.max),3);
      ctx.restore();
    });
    const p=g.player;const a=Math.atan2(mouse.current.y-p.y,mouse.current.x-p.x);
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);
    ctx.fillStyle="#d5e4ec";ctx.fillRect(5,-5,25,10);ctx.fillStyle="#5ac8b0";ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#eaf7ff";ctx.beginPath();ctx.arc(5,-5,5,0,Math.PI*2);ctx.fill();ctx.restore();
    if(p.inv>0){ctx.strokeStyle="#fff1a8";ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,24,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    // crosshair
    ctx.strokeStyle="#d9fff2";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(mouse.current.x,mouse.current.y,10,0,Math.PI*2);ctx.moveTo(mouse.current.x-16,mouse.current.y);ctx.lineTo(mouse.current.x-5,mouse.current.y);ctx.moveTo(mouse.current.x+5,mouse.current.y);ctx.lineTo(mouse.current.x+16,mouse.current.y);ctx.moveTo(mouse.current.x,mouse.current.y-16);ctx.lineTo(mouse.current.x,mouse.current.y-5);ctx.moveTo(mouse.current.x,mouse.current.y+5);ctx.lineTo(mouse.current.x,mouse.current.y+16);ctx.stroke();
  };
  useEffect(()=>{
    const down=e=>{keys.current[e.key.toLowerCase()]=true;if(e.key===" "){e.preventDefault();shoot(game.current)}};
    const up=e=>keys.current[e.key.toLowerCase()]=false;
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)};
  },[]);
  useEffect(()=>{
    const c=canvasRef.current,ctx=c.getContext("2d");
    const resize=()=>{const scale=Math.min(window.innerWidth*.94/W,(window.innerHeight*.72)/H);c.style.width=W*scale+"px";c.style.height=H*scale+"px";};
    resize();window.addEventListener("resize",resize);
    const loop=t=>{const dt=Math.min(.033,(t-(last.current||t))/1000);last.current=t;if(status==="playing"&&game.current)update(game.current,dt);if(game.current)draw(ctx,game.current);raf.current=requestAnimationFrame(loop)};raf.current=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(raf.current);window.removeEventListener("resize",resize)};
  },[status]);
  const pointer=e=>{const r=canvasRef.current.getBoundingClientRect();mouse.current.x=(e.clientX-r.left)/r.width*W;mouse.current.y=(e.clientY-r.top)/r.height*H;};
  return <main>
    <header><div className="brand"><Skull size={25}/> ZOMBIE<span>SURVIVAL</span></div><div className="tag">NIGHTFALL PROTOCOL // 01</div></header>
    <section className="game-shell">
      <div className="topbar"><div><small>WAVE</small><b>{hud.wave.toString().padStart(2,"0")}</b></div><div className="progress"><div style={{width:hud.progress+"%"}}/></div><div className="stats"><span><Skull size={15}/>{hud.kills}</span><span><Zap size={15}/>{hud.score}</span></div></div>
      <canvas ref={canvasRef} width={W} height={H} onMouseMove={pointer} onMouseDown={e=>{pointer(e);mouse.current.down=true}} onMouseUp={()=>mouse.current.down=false} onMouseLeave={()=>mouse.current.down=false}/>
      <div className="bottom-hud"><div className="health"><Heart size={18}/><div><label>VITALS</label><div className="bar"><i style={{width:hud.hp+"%"}}/></div></div><strong>{hud.hp}%</strong></div><div className="ammo"><Crosshair size={20}/><strong>{hud.ammo}<small> / {hud.reserve}</small></strong>{game.current?.player.reload>0&&<em>RELOADING</em>}</div></div>
      {status==="menu"&&<div className="overlay"><div className="panel"><div className="eyebrow">EMERGENCY BROADCAST // 23:47</div><h1>LAST ONE<br/><span>STANDING.</span></h1><p>Survive the night. Clear every wave. Trust no shadow.</p><button onClick={start}><Play size={18}/> START SURVIVAL</button><div className="controls">WASD / ARROWS <span>MOVE</span> • MOUSE <span>AIM & FIRE</span> • SPACE <span>FIRE</span></div></div></div>}
      {status==="gameover"&&<div className="overlay"><div className="panel"><div className="eyebrow danger">SIGNAL LOST</div><h1>YOU<br/><span>FELL.</span></h1><p>The horde has reclaimed the city.</p><div className="result"><div><small>WAVE</small><b>{hud.wave}</b></div><div><small>KILLS</small><b>{hud.kills}</b></div><div><small>SCORE</small><b>{hud.score}</b></div></div><button onClick={start}><RotateCcw size={18}/> TRY AGAIN</button></div></div>}
    </section>
    <footer><span>© 2026 NIGHTFALL SYSTEMS</span><span>STATUS: <b className="live">LIVE</b></span><button onClick={()=>setMuted(!muted)}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>}</button></footer>
  </main>
}
createRoot(document.getElementById("root")).render(<App/>);