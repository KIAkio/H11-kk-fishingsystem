// ==UserScript==
// @name 冬训营生活系统
// @author KIAkio
// @version 1.1.21
// @description 跨群点名、营地早餐、食用与饱腹系统
// ==/UserScript==
(function(){
'use strict';
const EXT='winter_camp_life',VER='1.1.21',BAG='$m地精背包数据',ATT='$m冬训营点名数据',PROFILE='$g地精档案编号表',RANK='$g冬训营点名排行';
if(seal.ext.find(EXT))return;
const ext=seal.ext.new(EXT,'KIAkio',VER);
const MENU=[['薄煎饼','可咸可甜，按照喜欢的口味添加配料吧~'],['燕麦粥','用牛奶煮制并加入蓝莓酱或蜂蜜，暖心暖胃。'],['荞麦粥','浓香黄油搭配香肠制成的咸味荞麦粥。'],['三明治','黑麦面包，黄油，加上火腿或者金枪鱼罐头，需要加一颗煎蛋也可以哦。'],['鸡蛋面糊煎饼','咸味的饼中掺杂着绿色的野菜，这个香味很难不好吃吧？'],['牛肉蔬菜面','肉和蔬菜炖了不知多久已经十分软烂，不过吃起来有点太咸了？'],['一盘杂粮','玉米，红薯，豌豆和胡萝卜，一颗鸡蛋，在角落里还配了一撮黑胡椒盐。'],['面','朴实的面，一些绿叶菜和一颗煎蛋，稳妥的搭配一定不会出错。'],['南瓜松饼','南瓜味的松饼，以及南瓜...这一块黄瓜是什么鬼？'],['鸡蛋全家','煎蛋，水煮蛋，炒蛋，温泉蛋，蒸蛋。'],['滑蛋贝果','黑麦贝果搭配黑胡椒肉肠和热腾腾的滑蛋，香气浓郁。'],['蜂蜜脆底小面包','一半松软一半脆脆的外皮，浓郁的蜂蜜味，一口咬下去，幸福感油然而生。不过作为热量炸弹可不要吃太多哟。']];
function raw(c,k){const r=seal.vars.strGet(k===PROFILE||k===RANK?campContext(c):c,k);return Array.isArray(r)?r[0]||'':''}
function uid(c){return String(c.player&&(c.player.userId||c.player.id)||'')}
function campContext(c){return globalThis.H11CampProfiles?globalThis.H11CampProfiles.context(c):c}
function profile(c){if(globalThis.H11CampProfiles)return globalThis.H11CampProfiles.read(c);const rawp=raw(c,PROFILE);if(!rawp)return {members:{},active:{}};try{return JSON.parse(rawp)}catch(e){throw Error('档案损坏，停止操作')}}
function prof(c){const p=profile(c),list=p.members&&p.members[uid(c)],arr=Array.isArray(list)?list:list?[list]:[];return arr.find(x=>x.id===(p.active||{})[uid(c)])||arr[0]||null}
function ok(c){return !!prof(c)}
function pname(c){const p=prof(c);return p&&p.name||c.player&&c.player.name||uid(c)}
function role(c){const p=prof(c);if(!p)throw Error('请先注册营地角色');return (globalThis.H11CampProfiles?globalThis.H11CampProfiles.groupKey(c):String(c.group&&(c.group.groupId||c.group.id)||'private'))+'::'+String(p.id).padStart(3,'0')}
function read(c,k,d){if(k===BAG||k===ATT){const r=raw(c,k===BAG?'$mH11角色数据仓库':'$mH11角色点名仓库');let store={};if(r){try{store=JSON.parse(r)}catch(e){throw Error('角色存档损坏，停止操作')}}return store[role(c)]||d}
 const s=raw(c,k);if(!s)return d;try{return JSON.parse(s)}catch(e){throw Error('存档损坏，已停止操作以保护数据。')}}
function write(c,k,v){if(k===BAG||k===ATT){const key=k===BAG?'$mH11角色数据仓库':'$mH11角色点名仓库',r=raw(c,key);let store={};if(r){try{store=JSON.parse(r)}catch(e){throw Error('角色存档损坏，停止写入')}}store[role(c)]=v;seal.vars.strSet(c,key,JSON.stringify(store));return}seal.vars.strSet(k===RANK?campContext(c):c,k,JSON.stringify(v))}
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
  if(t>start&&t<=now)if(Number(d.hunger)<=0){
   d.hunger=0;
   d.hp=Math.max(0,Number(d.hp)-1);
  }else{
   d.hunger=h===5?1:Math.max(0,Number(d.hunger)-1);
  }
 }
}
d.hungerUpdatedAt=now;
for(const [n,it] of Object.entries(d.items.other)){
 if(!it||!it.campBreakfast)continue;
 const count=Math.max(0,Number(it.count)||0);
 let batches=Array.isArray(it.breakfastBatches)?it.breakfastBatches.filter(b=>b&&Number(b.count)>0):[{count,expiresAt:Number(it.expiresAt)||0}];
 // 背包中食用或共享可能已减少总数：从最早到期的批次扣除差额。
 batches.sort((a,b)=>(Number(a.expiresAt)||0)-(Number(b.expiresAt)||0));
 let excess=batches.reduce((sum,b)=>sum+Number(b.count),0)-count;
 for(const b of batches){if(excess<=0)break;const take=Math.min(excess,Number(b.count));b.count-=take;excess-=take}
 batches=batches.filter(b=>Number(b.count)>0&&(!Number(b.expiresAt)||Number(b.expiresAt)>now));
 it.count=batches.reduce((sum,b)=>sum+Number(b.count),0);
 if(it.count<=0)delete d.items.other[n];
 else {it.breakfastBatches=batches;it.expiresAt=Math.min(...batches.map(b=>Number(b.expiresAt)||Infinity))}
}
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
if(seconds<2*3600)greeting='还有'+pname(c)+'这么勤奋的'+title+'啊！';
else if(seconds<5*3600)greeting='夜深人静……🌌，只有鼾声和'+student+'打卡的声音。';
else if(seconds<6*3600+60)greeting=pname(c)+'见到了布里吉五点钟的太阳🌅，等等…太阳呢？';
else if(seconds<11*3600)greeting='早上好'+student+'=∨=';
else if(seconds<12*3600)greeting='上午好'+student;
else if(seconds<12*3600+120)greeting='好险！'+pname(c)+'领到了最后一份早饭🙀';
else greeting='希望'+pname(c)+'已经去领过午饭了…';
const r=read(c,ATT,{lastDate:'',count:0}),today=day(now);if(r.lastDate===today){reply(c,m,repeatHeader+r.count);return}
r.lastDate=today;r.count=(+r.count||0)+1;write(c,ATT,r);
const rank=read(c,RANK,{members:{}});rank.members[uid(c)+'::'+role(c)]={name:pname(c),count:r.count};write(c,RANK,rank);
const d=sync(c),a=MENU[Math.floor(Math.random()*MENU.length)],twice=Math.random()<.1,b=twice?MENU[Math.floor(Math.random()*MENU.length)]:null;
function add(x){
 const n='营地早餐：'+x[0],v=d.items.other[n]||{count:0};
 const oldCount=Math.max(0,Number(v.count)||0);
 const batches=Array.isArray(v.breakfastBatches)?v.breakfastBatches:[{count:oldCount,expiresAt:Number(v.expiresAt)||0}];
 const expiration=nextEight();
 batches.push({count:1,expiresAt:expiration});
 v.count=oldCount+1;v.description=x[1];v.campBreakfast=true;v.hungerRestore=3;v.hpRestore=1;
 v.breakfastBatches=batches;v.expiresAt=Math.min(...batches.filter(b=>Number(b.count)>0).map(b=>Number(b.expiresAt)||Infinity));
 d.items.other[n]=v
}
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


const SHARE_KEY='$gH11开放食物分享';
const SHARE_TYPES={鱼:'fish',鱼类:'fish',fish:'fish',蘑菇:'mushroom',mushroom:'mushroom',浆果:'berry',berry:'berry',日用品:'supplies',supplies:'supplies',训练装备:'equipment',equipment:'equipment',其他:'other',other:'other',早餐:'other',营地早餐:'other'};
function shareGroup(c){return c.group&&c.group.groupId&&String(c.group.groupId)!=='private'}
function shareLoad(c){
 const v=seal.vars.strGet(c,SHARE_KEY),s=Array.isArray(v)?v[0]:'';
 if(!s)return {nextId:1,offers:[],selections:{}};
 let x;try{x=JSON.parse(s)}catch(e){throw Error('群分享存档损坏')}
 if(x&&Array.isArray(x.offers))return {nextId:Number(x.nextId)||1,offers:x.offers,selections:x.selections||{}};
 // 将旧版单份分享转换为多份结构，保留剩余量和已领取名单。
 if(x&&x.food&&Number(x.remaining)>0)return {nextId:2,offers:[Object.assign({id:1},x)],selections:{}};
 return {nextId:1,offers:[],selections:{}};
}
function shareSave(c,d){seal.vars.strSet(c,SHARE_KEY,JSON.stringify(d))}
function argsAll(a){const p=[];for(let i=1;i<=20;i++){const x=String(a.getArgN(i)||'').trim();if(!x)break;p.push(x)}return p}
function shareEffect(total){return total===2?'❤️ HP +1，饱腹 +1':'❤️ HP +1，饱腹不变'}
function activeOffers(d){return d.offers.filter(x=>x&&Number(x.remaining)>0)}
function shareName(x){return String(x||'').replace(/^营地早餐：/,'')}
function shareMatch(a,b){return shareName(a)===shareName(b)}
function clearSelections(d,id){for(const key of Object.keys(d.selections))if(Number(d.selections[key])===Number(id))delete d.selections[key]}
cmd('分享','群内随机分享：。分享 种类 名称',(c,m,a)=>{
 if(!shareGroup(c)){reply(c,m,'请在群聊中分享。');return}
 if(!ok(c)){reply(c,m,'请先注册营地角色。');return}
 const xs=argsAll(a),kind=SHARE_TYPES[xs[0]],name=xs.slice(1).join(' ').trim();
 if(!kind||!name){reply(c,m,'格式：。分享 种类 名称\n例如：。分享 早餐 蜂蜜脆底小面包');return}
 const d=sync(c);
 if(d.dead||d.hp<=0){reply(c,m,'当前无法行动，不能分享食物。');return}
 const match=find(d,name);
 if(!match){reply(c,m,'背包中没有「'+name+'」。请先用。背包确认物品名称和数量。');return}
 const {k:actualKind,it,name:actual}=match;
 if(kind!=='other'&&kind!==actualKind){reply(c,m,'物品分类不匹配，请使用背包中对应的种类。');return}
 const isBreakfast=Boolean(it.campBreakfast)||MENU.some(x=>x[0]===shareName(actual));
 const hasFoodEffect=(it.hungerRestore!=null&&Number.isFinite(Number(it.hungerRestore)))||(it.hpRestore!=null&&Number.isFinite(Number(it.hpRestore)));
 if(!isBreakfast&&!hasFoodEffect){reply(c,m,'「'+name+'」尚未设置食用效果，无法分享。');return}
 const state=shareLoad(c),total=2+Math.floor(Math.random()*3),food=shareName(actual);
 it.count=Number(it.count)-1;if(it.count<=0)delete d.items[actualKind][actual];
 save(c,d);
 const id=state.nextId++;
 state.offers.push({id,food,actual,category:actualKind,owner:pname(c),ownerId:uid(c),ownerRole:role(c),total,remaining:total,claimed:[],createdAt:Date.now()});
 shareSave(c,state);
 reply(c,m,'有缘人可以掰一口'+pname(c)+'的'+food+'\n状态影响：'+shareEffect(total)+'\n剩余数量：'+total);
});
cmd('好饿','随机闻到群内正在分享的一份食物：。好饿',(c,m)=>{
 if(!shareGroup(c)){reply(c,m,'请在群聊中使用。');return}
 if(!ok(c)){reply(c,m,'请先注册营地角色。');return}
 const state=shareLoad(c),offers=activeOffers(state);
 if(!offers.length){reply(c,m,'空气中没有可以分享的食物香气。');return}
 const chosen=offers[Math.floor(Math.random()*offers.length)];
 state.selections[uid(c)]=chosen.id;shareSave(c,state);
 reply(c,m,'空气中似乎有'+chosen.food+'的香气');
});
const BITE_LINES=[
 (n,f)=>n+'吃了一口'+f,
 (n,f)=>n+'享用了一部分'+f,
 (n,f)=>n+'闻到了'+f+'的香味',
 (n,f)=>'果然别人的东西最好吃',
 (n,f)=>n+'选择也来蹭一口',
 (n,f)=>'有不蹭一口'+f+'的概率吗？'+n+'的答案是否定的。'
];
cmd('掰一口','直接领取指定食物：。掰一口 食物名；或先。好饿再。掰一口',(c,m,a)=>{
 if(!shareGroup(c)){reply(c,m,'请在群聊中使用。');return}
 if(!ok(c)){reply(c,m,'请先注册营地角色。');return}
 const state=shareLoad(c),name=argsAll(a).join(' ').trim().replace(/^(早餐|营地早餐|其他)\s+/,'');
 let sh;
 if(name){
   // 指定食物时无需嗅闻；同名多份分享按发布时间优先领取尚未吃过的一份。
   const matches=activeOffers(state).filter(x=>shareMatch(x.food,name));
   if(!matches.length){reply(c,m,'当前没有正在分享的「'+name+'」。');return}
   sh=matches.find(x=>!(x.claimed||[]).includes(uid(c)));
   if(!sh){reply(c,m,'你已经吃过所有正在分享的「'+name+'」啦。');return}
 }else{
   const selected=state.selections[uid(c)];
   if(selected==null){reply(c,m,'请发送。掰一口 食物名，或先发送。好饿。');return}
   sh=state.offers.find(x=>Number(x.id)===Number(selected)&&Number(x.remaining)>0);
   if(!sh){delete state.selections[uid(c)];shareSave(c,state);reply(c,m,'刚才闻到的食物已经没有了，请重新发送。好饿，或指定食物名称。');return}
   if((sh.claimed||[]).includes(uid(c))){reply(c,m,'你已经掰过这份食物啦，试试其他食物。');return}
 }
 const d=sync(c);
 if(d.dead||d.hp<=0){reply(c,m,'当前无法行动，不能掰一口。');return}
 d.hp=Math.min(Number(d.maxHp)||10,Number(d.hp)+1);
 if(sh.total===2)d.hunger=Math.min(4,Math.max(0,Number(d.hunger)||0)+1);
 save(c,d);
 sh.claimed=sh.claimed||[];sh.claimed.push(uid(c));sh.remaining--;
 delete state.selections[uid(c)];
 if(sh.remaining<=0)clearSelections(state,sh.id);
 shareSave(c,state);
 const line=BITE_LINES[Math.floor(Math.random()*BITE_LINES.length)](pname(c),sh.food);
 reply(c,m,line+'\n状态影响：'+shareEffect(sh.total)+'\n剩余数量：'+sh.remaining);
});
cmd('饿炸了ok？','清空当前群所有尚未领取完的共享食物：。饿炸了ok？',(c,m)=>{
 if(!shareGroup(c)){reply(c,m,'请在群聊中使用。');return}
 const state=shareLoad(c);
 // 仅清空当前群的开放分享及嗅闻目标；不返还物品，也不回滚已领取效果。
 state.offers=[];
 state.selections={};
 shareSave(c,state);
 reply(c,m,'所有正在待命的好心食物都被吸入了黑洞之中……🌌🌪️');
});
const RECALL_LINES=[
 f=>f+'的香味消失在空气中',
 f=>f+'的香味消失在人群中',
 f=>'一份'+f+'消散了'
];
cmd('撤回','撤回自己正在分享的指定食物：。撤回 食物名',(c,m,a)=>{
 if(!shareGroup(c)){reply(c,m,'请在群聊中使用。');return}
 if(!ok(c)){reply(c,m,'请先注册营地角色。');return}
 const name=argsAll(a).join(' ').trim().replace(/^(早餐|营地早餐|其他)\s+/,'');
 if(!name){reply(c,m,'格式：。撤回 食物名\n例如：。撤回 蜂蜜脆底小面包');return}
 const state=shareLoad(c);
 const matches=activeOffers(state).filter(x=>x.ownerId===uid(c)&&shareMatch(x.food,name));
 if(!matches.length){reply(c,m,'没有找到你正在分享的「'+name+'」。');return}
 // 同名多份时撤回最近发布的一份；不影响其他同名分享。
 const sh=matches[matches.length-1];
 sh.remaining=0;clearSelections(state,sh.id);
 // 未有人领取时，完整返还原物品；已有领取则不返还，避免复制物品。
 if(!(sh.claimed||[]).length){
   const d=sync(c),category=sh.category||'other',itemName=sh.actual||sh.food;
   const it=d.items[category][itemName]||{count:0};
   it.count=Number(it.count||0)+1;
   if(category==='other'&&MENU.some(x=>x[0]===shareName(itemName))){
     it.campBreakfast=true;it.hungerRestore=3;it.hpRestore=1;
     const expiration=nextEight();
     const batches=Array.isArray(it.breakfastBatches)?it.breakfastBatches:[];
     batches.push({count:1,expiresAt:expiration});
     it.breakfastBatches=batches;it.expiresAt=expiration;
   }
   d.items[category][itemName]=it;save(c,d);
 }
 shareSave(c,state);
 reply(c,m,RECALL_LINES[Math.floor(Math.random()*RECALL_LINES.length)](sh.food));
});

seal.ext.register(ext);console.log('[冬训营生活] v'+VER+' 已加载。');
})();