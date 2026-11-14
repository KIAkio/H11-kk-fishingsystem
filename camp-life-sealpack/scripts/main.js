// ==UserScript==
// @name 冬训营生活系统
// @author KIAkio
// @version 1.1.7
// @description 跨群点名、营地早餐、食用与饱腹系统
// ==/UserScript==
(function(){
'use strict';
const EXT='winter_camp_life',VER='1.1.7',BAG='$m地精背包数据',ATT='$m冬训营点名数据',PROFILE='$g地精档案编号表',RANK='$g冬训营点名排行';
if(seal.ext.find(EXT))return;
const ext=seal.ext.new(EXT,'KIAkio',VER);
const MENU=[['薄煎饼','可咸可甜，按照喜欢的口味添加配料吧~'],['燕麦粥','用牛奶煮制并加入蓝莓酱或蜂蜜，暖心暖胃。'],['荞麦粥','浓香黄油搭配香肠制成的咸味荞麦粥。'],['三明治','黑麦面包，黄油，加上火腿或者金枪鱼罐头，需要加一颗煎蛋也可以哦。'],['鸡蛋面糊煎饼','咸味的饼中掺杂着绿色的野菜，这个香味很难不好吃吧？'],['牛肉蔬菜面','肉和蔬菜炖了不知多久已经十分软烂，不过吃起来有点太咸了？'],['一盘杂粮','玉米，红薯，豌豆和胡萝卜，一颗鸡蛋，在角落里还配了一撮黑胡椒盐。'],['面','朴实的面，一些绿叶菜和一颗煎蛋，稳妥的搭配一定不会出错。'],['南瓜松饼','南瓜味的松饼，以及南瓜...这一块黄瓜是什么鬼？'],['鸡蛋全家','煎蛋，水煮蛋，炒蛋，温泉蛋，蒸蛋。'],['滑蛋贝果','黑麦贝果搭配黑胡椒肉肠和热腾腾的滑蛋，香气浓郁。']];
function raw(c,k){const r=seal.vars.strGet(c,k);return Array.isArray(r)?r[0]||'':''}
function uid(c){return String(c.player&&(c.player.userId||c.player.id)||'')}
function profile(c){const rawp=raw(c,PROFILE);if(!rawp)return {members:{},active:{}};try{return JSON.parse(rawp)}catch(e){throw Error('档案损坏，停止操作')}}
function prof(c){const p=profile(c),list=p.members&&p.members[uid(c)],arr=Array.isArray(list)?list:list?[list]:[];return arr.find(x=>x.id===(p.active||{})[uid(c)])||arr[0]||null}
function ok(c){return !!prof(c)}
function pname(c){const p=prof(c);return p&&p.name||c.player&&c.player.name||uid(c)}
function role(c){const p=prof(c);if(!p)throw Error('请先注册营地角色');return String(c.group&&(c.group.groupId||c.group.id)||'private')+'::'+String(p.id).padStart(3,'0')}
function read(c,k,d){if(k===BAG||k===ATT){const r=raw(c,k===BAG?'$mH11角色数据仓库':'$mH11角色点名仓库');let store={};if(r){try{store=JSON.parse(r)}catch(e){throw Error('角色存档损坏，停止操作')}}return store[role(c)]||d}
 const s=raw(c,k);if(!s)return d;try{return JSON.parse(s)}catch(e){throw Error('存档损坏，已停止操作以保护数据。')}}
function write(c,k,v){if(k===BAG||k===ATT){const key=k===BAG?'$mH11角色数据仓库':'$mH11角色点名仓库',r=raw(c,key);let store={};if(r){try{store=JSON.parse(r)}catch(e){throw Error('角色存档损坏，停止写入')}}store[role(c)]=v;seal.vars.strSet(c,key,JSON.stringify(store));return}seal.vars.strSet(c,k,JSON.stringify(v))}
function reply(c,m,t){seal.replyToSender(c,m,t)}
function cmd(n,h,fn){const x=seal.ext.newCmdItemInfo();x.name=n;x.help=h;x.solve=(c,m,a)=>{try{fn(c,m,a)}catch(e){console.log('[冬训营生活] '+e);reply(c,m,'冬训营生活系统：'+(e.message||e))}return seal.ext.newCmdExecuteResult(true)};ext.cmdMap[n]=x}
// 固定 UTC+8：北京时间无夏令时；避免 SealDice JS 沙箱缺少 Intl。
function bj(d){return new Date(d.getTime()+8*60*60*1000)}
function day(d){const x=bj(d);return x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0')+'-'+String(x.getUTCDate()).padStart(2,'0')}
function hour(d){return bj(d).getUTCHours()}
function boundary(y,m,d,h){return Date.UTC(y,m-1,d,h-8)}
function bag(c){const d=read(c,BAG,{version:3,hp:10,maxHp:10,items:{}});if(!d.items)d.items={};for(const k of ['fish','mushroom','berry','supplies','equipment','other'])if(!d.items[k])d.items[k]={};if(!Number.isFinite(+d.hp))d.hp=10;if(!Number.isFinite(+d.maxHp))d.maxHp=10;if(!Number.isFinite(+d.hunger))d.hunger=4;if(!Number.isFinite(+d.hungerUpdatedAt))d.hungerUpdatedAt=Date.now();return d}
function save(c,d){d.version=3;write(c,BAG,d)}
function sync(c){
const d=bag(c),now=Date.now(),start=Math.min(now,Number(d.hungerUpdatedAt)||now);
const startBj=bj(new Date(start)),y=startBj.getUTCFullYear(),m=startBj.getUTCMonth(),dd=startBj.getUTCDate();
const days=Math.min(370,Math.max(0,Math.ceil((now-start)/86400000)+2));
for(let i=0;i<=days;i++){
 const dt=new Date(Date.UTC(y,m,dd+i));
 for(const h of [5,10,15,20]){
  const t=boundary(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate(),h);
  if(t>start&&t<=now)d.hunger=h===5?1:Math.max(0,d.hunger-1);
 }
}
d.hungerUpdatedAt=now;
for(const [n,it] of Object.entries(d.items.other)){if(it&&it.campBreakfast&&+it.expiresAt>0&&+it.expiresAt<=now)delete d.items.other[n]}
save(c,d);return d
}
function nextEight(){const x=bj(new Date());return boundary(x.getUTCFullYear(),x.getUTCMonth()+1,x.getUTCDate()+1,8)}
function find(d,n){const names=[n,n.startsWith('营地早餐：')?n:'营地早餐：'+n];for(const name of names)for(const k of Object.keys(d.items)){if(d.items[k][name]&&+d.items[k][name].count>0)return {k,it:d.items[k][name],name}}return null}
cmd('点名','每日点名：.点名',(c,m)=>{
if(!ok(c)){reply(c,m,'尚未查询到档案，路过？');return}
const now=new Date(),local=bj(now),seconds=local.getUTCHours()*3600+local.getUTCMinutes()*60+local.getUTCSeconds();
if(seconds>14*3600){reply(c,m,'呵呵..现在可不是打卡的时候...');return}
const character=prof(c),title=character&&character.role==='教官'?'教官':character&&character.role==='教师'?'老师':'同学';
const student=pname(c)+title;
const repeatHeader='今日已打卡。\n'+pname(c)+' '+String(character.id).padStart(3,'0')+'\n🎫累计数：';
let greeting;
if(seconds<2*3600)greeting='还有这么勤奋的同学啊！';
else if(seconds<5*3600)greeting='夜深人静……🌌，只有鼾声和'+student+'打卡的声音。';
else if(seconds<6*3600+60)greeting='你见到了布里吉五点钟的太阳🌅，等等…太阳呢？';
else if(seconds<11*3600)greeting='早上好'+student+'=∨=';
else if(seconds<12*3600)greeting='上午好'+student;
else if(seconds<12*3600+120)greeting='好险！你领到了最后一份早饭🙀';
else greeting='希望你已经去领过午饭了…';
const r=read(c,ATT,{lastDate:'',count:0}),today=day(now);if(r.lastDate===today){reply(c,m,repeatHeader+r.count);return}
r.lastDate=today;r.count=(+r.count||0)+1;write(c,ATT,r);
const rank=read(c,RANK,{members:{}});rank.members[uid(c)+'::'+role(c)]={name:pname(c),count:r.count};write(c,RANK,rank);
const d=sync(c),a=MENU[Math.floor(Math.random()*MENU.length)],twice=Math.random()<.1,b=twice?MENU[Math.floor(Math.random()*MENU.length)]:null;
function add(x){const n='营地早餐：'+x[0],v=d.items.other[n]||{count:0};v.count=(+v.count||0)+1;v.description=x[1];v.campBreakfast=true;v.hungerRestore=3;v.hpRestore=1;v.expiresAt=nextEight();d.items.other[n]=v}
add(a);if(b)add(b);save(c,d);
let out='今日已打卡。'+greeting+'\n🎫累计数：'+r.count+'\n\n营地早餐：'+a[0];out+=twice?'，'+b[0]+'\n\n不知为何，领到了两份早餐，不过教官说没事可以多吃一点。留着或者分给其他同学都是很好的选择。':'\n'+a[1];reply(c,m,out)
});
cmd('点名信息','查看点名记录：.点名信息',(c,m)=>{if(!ok(c)){reply(c,m,'尚未查询到档案，路过？');return}const r=read(c,ATT,{lastDate:'',count:0});reply(c,m,'🏕️【点名记录】\n累计数：'+r.count+'\n最近打卡：'+(r.lastDate||'暂无记录'))});
cmd('点名排行','查看本群点名排行：.点名排行',(c,m)=>{const r=read(c,RANK,{members:{}}),a=Object.values(r.members).sort((x,y)=>y.count-x.count).slice(0,10);reply(c,m,'🏅【累计点名排行】\n'+(a.length?a.map((x,i)=>(i+1)+'. '+x.name+'：'+x.count+' 次').join('\n'):'暂无记录'))});
cmd('饱腹','查看饱腹值：.饱腹',(c,m)=>{if(!ok(c)){reply(c,m,'尚未查询到档案，路过？');return}const d=sync(c);reply(c,m,(d.hunger===0?'【饥饿】\n':'')+'饱腹值：'+d.hunger+' / 4')});
cmd('营地菜单','查看营地早餐菜单：.营地菜单',(c,m)=>reply(c,m,'🥣【营地早餐菜单】\n'+MENU.map(x=>'• '+x[0]+'：'+x[1]).join('\n')));
cmd('共享','分享食物：.共享 食物名称 @1—3位同学（总人数2—4人，可省略早餐前缀）',(c,m,a)=>{
 if(!ok(c)){reply(c,m,'尚未查询到档案，路过？');return}
 const firstArg=String(a.getArgN(1)||'').trim();
 const foodParts=[];
 for(let n=1;n<=12;n++){
   const part=String(a.getArgN(n)||'').trim();
   if(!part||part.startsWith('@')||part.startsWith('[CQ:at,'))break;
   foodParts.push(part);
 }
 const foodName=foodParts.join(' ').trim()||firstArg;
 if(!foodName){reply(c,m,'格式：.共享 食物名称 @同学（总人数2—4人，包含自己）');return}
 const participants=[{ctx:c,id:uid(c),name:pname(c)}],seen=new Set([uid(c)]);
 function addTarget(target){
   if(!target||!target.player)return;
   const tid=String(target.player.userId||target.player.id||'');
   if(!tid||seen.has(tid))return;
   seen.add(tid);
   participants.push({ctx:target,id:tid,name:pname(target)});
 }
 // 海豹核心通用接口：先读取第一个 @ 对象。
 if(typeof seal.getCtxProxyFirst==='function'){
   try{addTarget(seal.getCtxProxyFirst(c,a))}catch(e){console.log('[冬训营生活] 首个@解析失败：'+e)}
 }
 // 部分海豹版本支持按位置读取多个 @ 对象。
 if(typeof seal.getCtxProxyAtPos==='function'){
   for(let pos=0;pos<6;pos++){
     try{addTarget(seal.getCtxProxyAtPos(c,a,pos))}catch(e){}
   }
 }
 if(participants.length<2||participants.length>4){
   reply(c,m,'没有识别到 1—3 位不同的被@同学。请使用群聊中真正的 @ 功能，例如：.共享 燕麦粥 @同学');
   return;
 }
 for(const participant of participants){
   if(!ok(participant.ctx)){reply(c,m,'被@的同学「'+participant.name+'」尚未在当前营地注册，无法共享。');return}
 }
 const states=[];
 for(const p of participants)states.push({participant:p,data:sync(p.ctx)});
 const owner=states[0].data,found=find(owner,foodName);
 if(!found){reply(c,m,'你的背包里没有「'+foodName+'」。');return}
 if(!found.it.campBreakfast&&!Number.isFinite(Number(found.it.hungerRestore))){reply(c,m,'「'+foodName+'」尚未设置食用效果，不能分享食用。');return}
 if(Number(found.it.count)<1){reply(c,m,'「'+foodName+'」数量不足。');return}
 found.it.count--;if(found.it.count<=0)delete owner.items[found.k][found.name];
 for(let i=0;i<states.length;i++){
   const d=states[i].data,oldHp=Number(d.hp)||0;
   d.hp=Math.min(Number(d.maxHp)||10,oldHp+1);
   if(participants.length===2)d.hunger=Math.min(4,Math.max(0,(Number(d.hunger)||0)+1));
   save(states[i].participant.ctx,d);
 }
 reply(c,m,'量不大，不过每人啃一口也还不错？\n\n「'+foodName+'」已由 '+participants.map(x=>x.name).join('、')+' 一起分享。'+(participants.length===2?'\n每人饱腹值 +1，HP +1。':'\n每人 HP +1，饱腹值没有变化。'));
});
seal.ext.register(ext);console.log('[冬训营生活] v'+VER+' 已加载。');
})();