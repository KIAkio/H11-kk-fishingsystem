// ==UserScript==
// @name         冬训营生活系统
// @author       KIAkio
// @version      1.0.0
// @description  全局每日点名、营地早餐与共享背包联动
// ==/UserScript==
(function () {
  'use strict';
  const EXT_ID='winter_camp_life';
  const VERSION='1.0.0';
  const BAG_VAR='$m地精背包数据';
  const ATTEND_VAR='$m冬训营点名数据';
  const PROFILE_VAR='$g地精档案编号表';
  if (seal.ext.find(EXT_ID)) return;
  const ext=seal.ext.new(EXT_ID,'KIAkio',VERSION);
  const MENU=[
    ['薄煎饼','可咸可甜，按照喜欢的口味添加配料吧~'],
    ['燕麦粥','用牛奶煮制并加入蓝莓酱或蜂蜜，暖心暖胃。'],
    ['荞麦粥','浓香黄油搭配香肠制成的咸味荞麦粥。'],
    ['三明治','黑麦面包，黄油，加上火腿或者金枪鱼罐头，需要加一颗煎蛋也可以哦。'],
    ['鸡蛋面糊煎饼','咸味的饼中掺杂着绿色的野菜，这个香味很难不好吃吧？'],
    ['牛肉蔬菜面','肉和蔬菜炖了不知多久已经十分软烂，不过吃起来有点太咸了？'],
    ['一盘杂粮','玉米，红薯，豌豆和胡萝卜，一颗鸡蛋，在角落里还配了一撮黑胡椒盐。'],
    ['面','朴实的面，一些绿叶菜和一颗煎蛋，稳妥的搭配一定不会出错。'],
    ['南瓜松饼','南瓜味的松饼，以及南瓜...这一块黄瓜是什么鬼？'],
    ['鸡蛋全家','煎蛋，水煮蛋，炒蛋，温泉蛋，蒸蛋。'],
    ['滑蛋贝果','黑麦贝果搭配黑胡椒肉肠和热腾腾的滑蛋，香气浓郁。']
  ];
  function read(ctx,key){const r=seal.vars.strGet(ctx,key);return Array.isArray(r)?r[0]||'':'';}
  function write(ctx,key,val){seal.vars.strSet(ctx,key,JSON.stringify(val));}
  function parse(raw,fallback){if(!raw)return fallback;try{return JSON.parse(raw)}catch(e){throw new Error('存档数据损坏，已停止写入以保护数据。')}}
  function uid(ctx){return String(ctx.player&&(ctx.player.userId||ctx.player.id)||'').trim();}
  function dayKey(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}
  function shanghaiParts(d){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);return {h:+p.find(x=>x.type==='hour').value,m:+p.find(x=>x.type==='minute').value};}
  function reply(ctx,msg,s){seal.replyToSender(ctx,msg,s);}
  function command(name,help,fn){const c=seal.ext.newCmdItemInfo();c.name=name;c.help=help;c.solve=(ctx,msg,args)=>{try{fn(ctx,msg,args)}catch(e){console.log('[冬训营生活] '+e);reply(ctx,msg,'冬训营生活系统：'+(e.message||e))}return seal.ext.newCmdExecuteResult(true)};ext.cmdMap[name]=c;}
  function registered(ctx){const id=uid(ctx);if(!id)return false;const p=parse(read(ctx,PROFILE_VAR),{members:{}});return !!(p.members&&p.members[id]);}
  function bag(ctx){const d=parse(read(ctx,BAG_VAR),{version:2,hp:10,maxHp:10,items:{}});if(!d.items)d.items={};if(!d.items.other)d.items.other={};if(!Number.isFinite(+d.hp))d.hp=10;if(!Number.isFinite(+d.maxHp))d.maxHp=10;if(!Number.isFinite(+d.hunger))d.hunger=4;if(!Number.isFinite(+d.hungerUpdatedAt))d.hungerUpdatedAt=Date.now();return d;}
  function saveBag(ctx,d){write(ctx,BAG_VAR,d)}
  function shanghaiBoundary(y,m,day,h){return Date.UTC(y,m-1,day,h-8,0,0)}
  function processHunger(d,now){
    const start=Number(d.hungerUpdatedAt)||now;
    if(start>now){d.hungerUpdatedAt=now;return}
    // 以北京时间日历事件逐个补算；05:00 重置为 1，10/15/20 点各 -1。
    let cursor=start;
    const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'});
    const base=fmt.formatToParts(new Date(start));
    let y=+base.find(x=>x.type==='year').value,m=+base.find(x=>x.type==='month').value,day=+base.find(x=>x.type==='day').value;
    for(let offset=0;offset<=370;offset++){
      const date=new Date(Date.UTC(y,m-1,day+offset));
      const yy=date.getUTCFullYear(),mm=date.getUTCMonth()+1,dd=date.getUTCDate();
      for(const h of [5,10,15,20]){
        const t=shanghaiBoundary(yy,mm,dd,h);
        if(t>start&&t<=now){if(h===5)d.hunger=1;else d.hunger=Math.max(0,d.hunger-1)}
      }
    }
    d.hungerUpdatedAt=now;
  }
  function expireBreakfast(d,now){
    const items=d.items.other||{};
    for(const [name,it] of Object.entries(items)){
      if(it&&it.campBreakfast&&Number(it.expiresAt)>0&&Number(it.expiresAt)<=now)delete items[name];
    }
  }
  function sync(ctx){const d=bag(ctx),now=Date.now();processHunger(d,now);expireBreakfast(d,now);saveBag(ctx,d);return d}
  function nextEightAM(){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const y=+p.find(x=>x.type==='year').value,m=+p.find(x=>x.type==='month').value,d=+p.find(x=>x.type==='day').value;const now=Date.now();let t=shanghaiBoundary(y,m,d,8);if(t<=now)t=shanghaiBoundary(y,m,d+1,8);return t}
  command('点名','每日点名：.点名', (ctx,msg)=>{
    if(!registered(ctx)){reply(ctx,msg,'尚未查询到档案，路过？');return}
    const now=new Date(),p=shanghaiParts(now);
    if(p.h>=12){reply(ctx,msg,'呵呵..现在可不是打卡的时候...');return}
    const id=uid(ctx),records=parse(read(ctx,ATTEND_VAR),{lastDate:'',count:0,history:[]}),today=dayKey(now);
    if(records.lastDate===today){reply(ctx,msg,'今日已打卡。早上好呀同学~\n🎫累计数：'+records.count);return}
    records.lastDate=today;records.count=(Number(records.count)||0)+1;records.history=(records.history||[]);records.history.push({date:today,count:records.count});if(records.history.length>90)records.history=records.history.slice(-90);write(ctx,ATTEND_VAR,records);
    const d=sync(ctx),first=MENU[Math.floor(Math.random()*MENU.length)],double=Math.random()<0.10,second=double?MENU[Math.floor(Math.random()*MENU.length)]:null;
    function add(item){const n='营地早餐：'+item[0],old=d.items.other[n]||{count:0,description:item[1]};old.count=(Number(old.count)||0)+1;old.description=item[1];old.campBreakfast=true;old.hungerRestore=3;old.hpRestore=1;old.expiresAt=nextEightAM();d.items.other[n]=old}
    add(first);if(second)add(second);saveBag(ctx,d);
    let out='今日已打卡。早上好呀同学~\n🎫累计数：'+records.count+'\n\n营地早餐：'+first[0];
    if(!double)out+='\n'+first[1];else out+='，'+second[0]+'\n\n不知为何，领到了两份早餐，不过教官说没事可以多吃一点。留着或者分给其他同学都是很好的选择。';
    reply(ctx,msg,out);
  });
  command('点名信息','查看累计点名次数：.点名信息',(ctx,msg)=>{if(!registered(ctx)){reply(ctx,msg,'尚未查询到档案，路过？');return}const r=parse(read(ctx,ATTEND_VAR),{lastDate:'',count:0});reply(ctx,msg,'🏕️【点名记录】\n累计数：'+(r.count||0)+'\n最近打卡：'+(r.lastDate||'暂无记录'))});
  command('饱腹','查看饱腹值：.饱腹',(ctx,msg)=>{if(!registered(ctx)){reply(ctx,msg,'尚未查询到档案，路过？');return}const d=sync(ctx);reply(ctx,msg,(d.hunger<=0?'【饥饿】\n':'')+'饱腹值：'+d.hunger+' / 4')});
  command('营地菜单','查看营地早餐菜单：.营地菜单',(ctx,msg)=>reply(ctx,msg,'🥣【营地早餐菜单】\n'+MENU.map(x=>'• '+x[0]+'：'+x[1]).join('\n')));
  seal.ext.register(ext);
  console.log('[冬训营生活] v'+VERSION+' 已加载。');
})();
