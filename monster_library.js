// ==UserScript==
// @name         H11 怪物库
// @author       Faye
// @version      1.0.0
// @description  独立怪物、遭遇和副本资料库
// @timestamp    1763300000
// ==/UserScript==
(function () {
  const NAME = 'H11 怪物库';
  let ext = seal.ext.find(NAME);
  if (!ext) { ext = seal.ext.new(NAME, 'Faye', '1.0.0'); seal.ext.register(ext); }
  const initial = {
    monsters: {
      M001:{name:'灰林狼',hp:18,armor:1,speed:65,attack:55,defense:35,damage:'1D6',xp:5},
      M002:{name:'腐枝傀儡',hp:28,armor:3,speed:25,attack:45,defense:50,damage:'1D8',xp:8},
      M003:{name:'迷雾游魂',hp:14,armor:0,speed:70,attack:60,defense:45,damage:'1D4+2',xp:7},
      M004:{name:'洞穴巨蛛',hp:22,armor:2,speed:55,attack:50,defense:40,damage:'1D6+1',xp:6}
    },
    zones: {
      '灰林': {encounterChance:45, events:[{text:'林间风声轻响，暂时没有危险。',weight:5},{text:'发现一处被遗弃的营火。',weight:2},{text:'树影间传来不明的脚步声。',weight:2}], encounters:[{id:'M001',weight:6,min:1,max:2},{id:'M002',weight:2,min:1,max:1},{id:'M003',weight:2,min:1,max:1}]},
      '岩洞': {encounterChance:60, events:[{text:'岩壁上有古老的刻痕。',weight:3},{text:'找到一处暂时安全的石台。',weight:2}], encounters:[{id:'M004',weight:6,min:1,max:3},{id:'M002',weight:3,min:1,max:2}]}
    },
    dungeons: {
      'D001':{name:'灰林深处',waves:[[{id:'M001',count:2}],[{id:'M002',count:1},{id:'M003',count:1}],[{id:'M004',count:1},{id:'M001',count:1}]]}
    }
  };
  function load() { try { const raw=seal.ext.storageGet(ext,'database'); return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(initial)); } catch(e) { return JSON.parse(JSON.stringify(initial)); } }
  function save(db) { seal.ext.storageSet(ext,'database',JSON.stringify(db)); }
  if (!seal.ext.storageGet(ext,'database')) save(initial);
  const api={load,save};
  globalThis.H11_MONSTER_LIBRARY=api;
  const cmd=seal.ext.newCmdItemInfo(); cmd.name='怪物库'; cmd.help='。怪物库 列表 / 查看 M001 / 区域 / 副本 / 重置示例';
  cmd.solve=(ctx,msg,args)=>{
    const parts=args.getRestArgsFrom(1).trim().split(/\s+/).filter(Boolean), db=load(), sub=parts[0]||'列表';
    let out='';
    if(sub==='列表') out=Object.entries(db.monsters).map(([id,m])=>`${id} ${m.name} HP${m.hp} 护甲${m.armor} 速度${m.speed} 攻击${m.attack} 防御${m.defense}`).join('\n');
    else if(sub==='查看') {const m=db.monsters[parts[1]];out=m?`${parts[1]} ${m.name}\nHP ${m.hp} / 护甲 ${m.armor} / 速度 ${m.speed}\n攻击 ${m.attack} / 防御 ${m.defense}\n伤害 ${m.damage} / 经验 ${m.xp}`:'没有这个怪物编号。';}
    else if(sub==='区域') out=Object.entries(db.zones).map(([n,z])=>`${n}：遭遇率 ${z.encounterChance}%`).join('\n');
    else if(sub==='副本') out=Object.entries(db.dungeons).map(([id,d])=>`${id} ${d.name}（${d.waves.length}波）`).join('\n');
    else if(sub==='重置示例') out='为避免误删你的自定义数据，未开放聊天指令重置。';
    else out=cmd.help;
    seal.replyToSender(ctx,msg,out||'暂无记录');return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap['怪物库']=cmd;
})();