// ==UserScript==
// @name         H11 怪物库
// @author       Faye
// @version      1.1.0
// @description  独立怪物、遭遇和副本资料库
// @timestamp    1763300000
// ==/UserScript==
(function () {
  const NAME = 'H11 怪物库';
  let ext = seal.ext.find(NAME);
  if (ext) return;
  ext = seal.ext.new(NAME, 'Faye', '1.1.0');
  const winter = [
  {
    "id": "winter-wolf",
    "name": "冬狼",
    "role": "战斗",
    "hp": 20,
    "armor": 2,
    "speed": 40,
    "attack": 55,
    "defense": 20
  },
  {
    "id": "gray-wolf",
    "name": "灰狼",
    "role": "战斗",
    "hp": 6,
    "armor": 0,
    "speed": 32,
    "attack": 45,
    "defense": 15
  },
  {
    "id": "brown-wolf",
    "name": "棕狼",
    "role": "战斗",
    "hp": 6,
    "armor": 0,
    "speed": 32,
    "attack": 45,
    "defense": 15
  },
  {
    "id": "yeti",
    "name": "雪怪",
    "role": "战斗",
    "hp": 15,
    "armor": 1,
    "speed": 32,
    "attack": 55,
    "defense": 25
  },
  {
    "id": "ice-mephit",
    "name": "冰魔蝠",
    "role": "战斗",
    "hp": 8,
    "armor": 0,
    "speed": 24,
    "attack": 40,
    "defense": 10
  },
  {
    "id": "ice-piercer",
    "name": "冰锥怪",
    "role": "伏击／战斗",
    "hp": 9,
    "armor": 4,
    "speed": 4,
    "attack": 40,
    "defense": 25
  },
  {
    "id": "yeti-tyke",
    "name": "雪怪幼崽",
    "role": "战斗",
    "hp": 6,
    "armor": 0,
    "speed": 16,
    "attack": 35,
    "defense": 15
  },
  {
    "id": "ice-crevice-spider",
    "name": "冰缝蛛",
    "role": "伏击／战斗",
    "hp": 5,
    "armor": 0,
    "speed": 16,
    "attack": 45,
    "defense": 5
  },
  {
    "id": "snow-flea-swarm",
    "name": "雪蚤群",
    "role": "战斗",
    "hp": 8,
    "armor": 0,
    "speed": 16,
    "attack": 40,
    "defense": 20
  },
  {
    "id": "snowshoe-hare",
    "name": "雪靴兔",
    "role": "非战斗",
    "hp": 5,
    "armor": 0,
    "speed": 16,
    "attack": 0,
    "defense": 5
  }
];
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
  function load() {
    const raw = ext.storageGet('database');
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(initial));
  }
  function save(db) { ext.storageSet('database', JSON.stringify(db)); }
  function listWinter() { return winter.map(monster => ({...monster})); }
  function findWinter(selector) {
    const monster = winter.find(entry => entry.id === selector || entry.name === selector);
    return monster ? {...monster} : null;
  }
  globalThis.H11_MONSTER_LIBRARY = {load, save, listWinter, findWinter};
  const cmd=seal.ext.newCmdItemInfo(); cmd.name='怪物库'; cmd.help='。怪物库 列表 / 查看 冬狼 / 示例 / 区域 / 副本';
  cmd.solve=(ctx,msg,args)=>{
    try {
    const parts=args.getRestArgsFrom(1).trim().split(/\s+/).filter(Boolean), sub=parts[0]||'列表';
    const db = ['区域','副本','示例'].includes(sub) ? load() : null;
    let out='';
    if(sub==='列表') out = listWinter().map(m =>
      m.name + ' [' + m.role + '] HP ' + m.hp + ' ｜ 护甲 ' + m.armor +
      ' ｜ 速度 ' + m.speed + ' ｜ 攻击 ' + m.attack + ' ｜ 防御 ' + m.defense).join('\n');
    else if(sub==='查看') {
      const m = findWinter(parts[1]) || load().monsters[parts[1]];
      out = m ? m.name + ' ｜ HP ' + m.hp + ' ｜ 护甲 ' + m.armor +
        ' ｜ 速度 ' + m.speed + ' ｜ 攻击 ' + m.attack + ' ｜ 防御 ' + m.defense : '没有找到这个生物。';
    }
    else if(sub==='示例') out = Object.entries(db.monsters).map(([id,m]) => id + ' ' + m.name).join('\n');
    else if(sub==='区域') out=Object.entries(db.zones).map(([n,z])=>`${n}：遭遇率 ${z.encounterChance}%`).join('\n');
    else if(sub==='副本') out=Object.entries(db.dungeons).map(([id,d])=>`${id} ${d.name}（${d.waves.length}波）`).join('\n');
    else if(sub==='重置示例') out='为避免误删你的自定义数据，未开放聊天指令重置。';
    else out=cmd.help;
    seal.replyToSender(ctx,msg,out||'暂无记录');
    } catch (error) { seal.replyToSender(ctx,msg,'怪物库：'+error.message); }
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap['怪物库']=cmd;
  ext.onNotCommandReceived = (ctx,msg) => {
    const match = /^[。，]怪物库(?:\s+(.*))?$/.exec(String(msg.message || '').trim());
    if (match) cmd.solve(ctx,msg,{getRestArgsFrom:()=>match[1] || ''});
  };
  seal.ext.register(ext);
})();