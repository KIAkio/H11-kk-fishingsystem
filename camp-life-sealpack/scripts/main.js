// ==UserScript==
// @name 冬训营生活系统
// @author KIAkio
// @version 1.0.2
// @description 跨群点名、营地早餐、食用与饱腹系统
// ==/UserScript==
(function(){
'use strict';
const EXT='winter_camp_life',VER='1.0.2',BAG='$m地精背包数据',ATT='$m冬训营点名数据',PROFILE='$g地精档案编号表',RANK='$g冬训营点名排行';
if(seal.ext.find(EXT))return;
const ext=seal.ext.new(EXT,'KIAkio',VER);
const MENU=[['薄煎饼','可咸可甜，按照喜欢的口味添加配料吧~'],['燕麦粥','用牛奶煮制并加入蓝莓酱或蜂蜜，暖心暖胃。'],['荞麦粥','浓香黄油搭配香肠制成的咸味荞麦粥。'],['三明治','黑麦面包，黄油，加上火腿或者金枪鱼罐头，需要加一颗煎蛋也可以哦。'],['鸡蛋面糊煎饼','咸味的饼中掺杂着绿色的野菜，这个香味很难不好吃吧？'],['牛肉蔬菜面','肉和蔬菜炖了不知多久已经十分软烂，不过吃起来有点太咸了？'],['一盘杂粮','玉米，红薯，豌豆和胡萝卜，一颗鸡蛋，在角落里还配了一撮黑胡椒盐。'],['面','朴实的面，一些绿叶菜和一颗煎蛋，稳妥的搭配一定不会出错。'],['南瓜松饼','南瓜味的松饼，以及南瓜...这一块黄瓜是什么鬼？'],['鸡蛋全家','煎蛋，水煮蛋，炒蛋，温泉蛋，蒸蛋。'],['滑蛋贝果','黑麦贝果搭配黑胡椒肉肠和热腾腾的滑蛋，香气浓郁。']];
function raw(c,k){const r=seal.vars.strGet(c,k);return Array.isArray(r)?r[0]||'':''}
function read(c,k,d){const s=raw(c,k);if(!s)return d;try{return JSON.parse(s)}catch(e){throw Error('存档损坏，已停止操作以保护数据。')}}
function write(c,k,v){seal.vars.strSet(c,k,JSON.stringify(v))}
function uid(c){return String(c.player&&(c.player.userId||c.player.id)||'')}
function prof(c){const p=read(c,PROFILE,{members:{}});return p.members&&p.members[uid(c)]}
function ok(c){const p=prof(c);return !!(p&&(typeof p==='string'||p.id||p.name))}
function pname(c){const p=prof(c);return p&&p.name||c.player&&c.player.name||uid(c)}
function reply(c,m,t){seal.replyToSender(c,m,t)}
function cmd(n,h,fn){const x=seal.ext.newCmdItemInfo();x.name=n;x.help=h;x.solve=(c,m,a)=>{try{fn(c,m,a)}catch(e){console.log('[冬训营生活] '+e);reply(c,m,'冬训营生活系统：'+(e.message||e))}return seal.ext.newCmdExecuteResult(true)};ext.cmdMap[n]=x}
function day(d){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return p.find(x=>x.type==='year').value+'-'+p.find(x=>x.type==='month').value+'-'+p.find(x=>x.type==='day').value}
function hour(d){return +new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',hourCycle:'h23'}).format(d)}
function boundary(y,m,d,h){return Date.UTC(y,m-1,d,h-8)}
function bag(c){const d=read(c,BAG,{version:3,hp:10,maxHp:10,items:{}});if(!d.items)d.items={};for(const k of ['fish','mushroom','berry','supplies','equipment','other'])if(!d.items[k])d.items[k]={};if(!Number.isFinite(+d.hp))d.hp=10;if(!Number.isFinite(+d.maxHp))d.maxHp=10;if(!Number.isFinite(+d.hunger))d.hunger=4;if(!Number.isFinite(+d.hungerUpdatedAt))d.hungerUpdatedAt=Date.now();return d}
function save(c,d){d.version=3;write(c,BAG,d)}
function sync(c){const d=bag(c),now=Date.now(),start=d.hungerUpdatedAt,parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(start)),y=+parts.find(x=>x.type==='year').value,m=+parts.find(x=>x.type==='month').value,dd=+parts.find(x=>x.type==='day').value;
for(let i=0;i<=370;i++){const dt=new Date(Date.UTC(y,m-1,dd+i));for(const h of [5,10,15,20]){const t=boundary(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate(),h);if(t>start&&t<=now)d.hunger=h===5?1:Math.max(0,d.hunger-1)}}
d.hungerUpdatedAt=now;for(const [n,it] of Object.entries(d.items.other)){if(it&&it.campBreakfast&&+it.expiresAt>0&&+it.expiresAt<=now)delete d.items.other[n]}save(c,d);return d}
function nextEight(){const now=new Date(),p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),y=+p.find(x=>x.type==='year').value,m=+p.find(x=>x.type==='month').value,d=+p.find(x=>x.type==='day').value;let t=boundary(y,m,d,8);return t<=Date.now()?boundary(y,m,d+1,8):t}
function find(d,n){for(const k of Object.keys(d.items)){if(d.items[k][n]&&+d.items[k][n].count>0)return {k,it:d.items[k][n]}}return null}
cmd('点名','每日点名：.点名',(c,m)=>{
if(!ok(c)){reply(c,m,'尚未查询到档案，路过？');return}
const now=new Date();if(hour(now)>=12){reply(c,m,'呵呵..现在可不是打卡的时候...');return}
const r=read(c,ATT,{lastDate:'',count:0}),today=day(now);if(r.lastDate===today){reply(c,m,'今日已打卡。早上好呀同学~\n🎫累计数：'+r.count);return}
r.lastDate=today;r.count=(+r.count||0)+1;write(c,ATT,r);
const rank=read(c,RANK,{members:{}});rank.members[uid(c)]={name:pname(c),count:r.count};write(c,RANK,rank);
const d=sync(c),a=MENU[Math.floor(Math.random()*MENU.length)],twice=Math.random()<.1,b=twice?MENU[Math.floor(Math.random()*MENU.length)]:null;
function add(x){const n='营地早餐：'+x[0],v=d.items.other[n]||{count:0};v.count=(+v.count||0)+1;v.description=x[1];v.campBreakfast=true;v.hungerRestore=3;v.hpRestore=1;v.expiresAt=nextEight();d.items.other[n]=v}
add(a);if(b)add(b);save(c,d);
let out='今日已打卡。早上好呀同学~\n🎫累计数：'+r.count+'\n\n营地早餐：'+a[0];out+=twice?'，'+b[0]+'\n\n不知为何，领到了两份早餐，不过教官说没事可以多吃一点。留着或者分给其他同学都是很好的选择。':'\n'+a[1];reply(c,m,out)
});
cmd('点名信息','查看点名记录：.点名信息',(c,m)=>{if(!ok(c)){reply(c,m,'尚未查询到档案，路过？');return}const r=read(c,ATT,{lastDate:'',count:0});reply(c,m,'🏕️【点名记录】\n累计数：'+r.count+'\n最近打卡：'+(r.lastDate||'暂无记录'))});
cmd('点名排行','查看本群点名排行：.点名排行',(c,m)=>{const r=read(c,RANK,{members:{}}),a=Object.values(r.members).sort((x,y)=>y.count-x.count).slice(0,10);reply(c,m,'🏅【累计点名排行】\n'+(a.length?a.map((x,i)=>(i+1)+'. '+x.name+'：'+x.count+' 次').join('\n'):'暂无记录'))});
cmd('食用','食用背包中的食物：.食用 食物名称',(c,m,a)=>{if(!ok(c)){reply(c,m,'尚未查询到档案，路过？');return}const n=String(a.getArgN(1)||'').trim();if(!n){reply(c,m,'请指定食物名称。');return}const d=sync(c),f=find(d,n);if(!f){reply(c,m,'背包里没有「'+n+'」。');return}if(!f.it.campBreakfast&&!Number.isFinite(Number(f.it.hungerRestore))){reply(c,m,'「'+n+'」尚未设置食用效果。');return}f.it.count--;if(f.it.count<=0)delete d.items[f.k][n];const old=d.hp;d.hp=Math.min(d.maxHp,d.hp+(Number(f.it.hpRestore)||1));d.hunger=Math.min(4,d.hunger+(Number(f.it.hungerRestore)|| (f.it.campBreakfast?3:0)));save(c,d);reply(c,m,'🍽️ 你食用了「'+n+'」。\n❤️ HP：'+old+' → '+d.hp+' / '+d.maxHp+'\n饱腹值：'+d.hunger+' / 4')});
cmd('饱腹','查看饱腹值：.饱腹',(c,m)=>{if(!ok(c)){reply(c,m,'尚未查询到档案，路过？');return}const d=sync(c);reply(c,m,(d.hunger===0?'【饥饿】\n':'')+'饱腹值：'+d.hunger+' / 4')});
cmd('营地菜单','查看营地早餐菜单：.营地菜单',(c,m)=>reply(c,m,'🥣【营地早餐菜单】\n'+MENU.map(x=>'• '+x[0]+'：'+x[1]).join('\n')));
cmd('共享','分享食物：.共享 食物名称 @1—3位同学（总人数2—4人）',(c,m,a)=>{
 if(!ok(c)){reply(c,m,'尚未查询到档案，路过？');return}
 const foodName=String(a.getArgN(1)||'').trim();
 if(!foodName){reply(c,m,'格式：.共享 营地早餐：食物名称 @同学（总人数2—4人，包含自己）');return}
 if(typeof seal.getCtxProxyAtPos!=='function'){reply(c,m,'当前海豹核心版本不支持多成员分享，请升级核心。');return}
 const participants=[{ctx:c,id:uid(c),name:pname(c)}],seen=new Set([uid(c)]);
 for(let pos=0;pos<3;pos++){
   let target=null;try{target=seal.getCtxProxyAtPos(c,a,pos)}catch(e){target=null}
   if(!target||!target.player||!target.player.userId)continue;
   const tid=String(target.player.userId);
   if(seen.has(tid))continue;
   seen.add(tid);participants.push({ctx:target,id:tid,name:target.player.name||tid});
 }
 if(participants.length<2||participants.length>4){reply(c,m,'请 @ 1—3 位同学，分享总人数必须为 2—4 人（包含你自己）。');return}
 const states=[];
 for(const p of participants)states.push({participant:p,data:sync(p.ctx)});
 const owner=states[0].data,found=find(owner,foodName);
 if(!found){reply(c,m,'你的背包里没有「'+foodName+'」。');return}
 if(!found.it.campBreakfast&&!Number.isFinite(Number(found.it.hungerRestore))){reply(c,m,'「'+foodName+'」尚未设置食用效果，不能分享食用。');return}
 if(Number(found.it.count)<1){reply(c,m,'「'+foodName+'」数量不足。');return}
 found.it.count--;if(found.it.count<=0)delete owner.items[found.k][foodName];
 for(let i=0;i<states.length;i++){
   const d=states[i].data,oldHp=Number(d.hp)||0;
   d.hp=Math.min(Number(d.maxHp)||10,oldHp+1);
   if(participants.length===2)d.hunger=Math.min(4,Math.max(0,(Number(d.hunger)||0)+1));
   save(states[i].participant.ctx,d);
 }
 reply(c,m,'量不大，不过每人啃一口也还不错？\\n\\n「'+foodName+'」已由 '+participants.map(x=>x.name).join('、')+' 一起分享。'+(participants.length===2?'\\n每人饱腹值 +1，HP +1。':'\\n每人 HP +1，饱腹值没有变化。'));
});
seal.ext.register(ext);console.log('[冬训营生活] v'+VER+' 已加载。');
})();