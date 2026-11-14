// ==UserScript==
// @name         地精采集系统
// @author       KIAkio
// @version      1.0.0
// @description  野外蘑菇与浆果采集，按稀有度随机获取并接入共享背包
// ==/UserScript==

(function () {
  'use strict';

  const EXT_ID = 'goblin_gathering_system';
  const VERSION = '1.0.2';
  const DATA_VAR = '$m地精背包数据';

  if (seal.ext.find(EXT_ID)) {
    console.log('[地精采集] 扩展已加载，跳过重复注册。');
    return;
  }
  const ext = seal.ext.new(EXT_ID, 'KIAkio', VERSION);

  // 权重：普通 70%、少见 24%、稀有 6%。
  const RARITY = {
    common: { name: '普通', stars: '★☆☆', weight: 70 },
    uncommon: { name: '少见', stars: '★★☆', weight: 24 },
    rare: { name: '稀有', stars: '★★★', weight: 6 }
  };

  // 采集素材沿用已登记的蘑菇与浆果名称；描述为游戏内图鉴文案。
  const ITEMS = [
    { name: '一等牛肝菌', category: 'mushroom', rarity: 'common', description: '腿粗肉白，因此被称作大白蘑菇。' },
    { name: '鸡油菌', category: 'mushroom', rarity: 'common', description: '通体橘色，带淡淡果香，得名小狐狸。' },
    { name: '松菇', category: 'mushroom', rarity: 'uncommon', description: '形似黄油，因此被称作黄油蘑菇。' },
    { name: '白桦树下的小蘑菇', category: 'mushroom', rarity: 'common', description: '因生长在白桦树下而得名。' },
    { name: '白杨树下的小蘑菇', category: 'mushroom', rarity: 'common', description: '因生长在白杨树下而得名。' },
    { name: '松树下的小蘑菇', category: 'mushroom', rarity: 'common', description: '因生长在松树下而得名。' },
    { name: '榛蘑', category: 'mushroom', rarity: 'uncommon', description: '常依附树墩群生，产量很高。' },
    { name: '白桦茸', category: 'mushroom', rarity: 'rare', description: '寄生在白桦树干上的黑色坚硬菌块。' },
    { name: '野生金针菇', category: 'mushroom', rarity: 'uncommon', description: '常成簇长在柳树、白杨或桦树枯木上。' },
    { name: '红菇属', category: 'mushroom', rarity: 'rare', poisonous: true, description: '颜色多样，种类复杂；误食有毒，食用后 HP -1。' },

    { name: '蓝莓', category: 'berry', rarity: 'common', description: '分布极广，可鲜食或制作果酱、馅饼。' },
    { name: '越橘', category: 'berry', rarity: 'common', description: '鲜红果实带酸涩味，常制成果酱或浸泡饮料。' },
    { name: '云莓', category: 'berry', rarity: 'rare', description: '金黄色，形似覆盆子，珍贵且富含维生素 C。' },
    { name: '北悬钩子', category: 'berry', rarity: 'uncommon', description: '灌木丛与林间空地常见，香甜多汁。' },
    { name: '蓝靛果忍冬', category: 'berry', rarity: 'uncommon', description: '野生小灌木，浆果酸甜，成熟期很早。' },
    { name: '醋栗', category: 'berry', rarity: 'common', description: '常见于林缘、溪流旁，可泡茶或酿酒。' },
    { name: '花楸果', category: 'berry', rarity: 'uncommon', description: '鲜红成簇，霜雪冷冻后苦涩减轻、微甜。' },
    { name: '绣球荚蒾', category: 'berry', rarity: 'uncommon', description: '鲜红浆果，经历严冬冰冻后苦味减轻。' },
    { name: '沙棘', category: 'berry', rarity: 'uncommon', description: '橙黄果实紧密附着枝条，冰冻后便于收集。' },
    { name: '野玫瑰果', category: 'berry', rarity: 'common', description: '维生素 C 丰富，常晒干泡水饮用。' },
    { name: '蔓越莓', category: 'berry', rarity: 'rare', description: '生长在沼泽地，雪下果实仍能保持汁水。' }
  ];

  function reply(ctx, msg, text) {
    seal.replyToSender(ctx, msg, text);
  }

  function registerCommand(name, help, handler) {
    const cmd = seal.ext.newCmdItemInfo();
    cmd.name = name;
    cmd.help = help;
    cmd.solve = (ctx, msg, args) => {
      try {
        handler(ctx, msg, args);
      } catch (e) {
        console.log('[地精采集] 指令异常：' + e);
        reply(ctx, msg, '地精采集系统发生错误：' + String(e.message || e));
      }
      return seal.ext.newCmdExecuteResult(true);
    };
    ext.cmdMap[name] = cmd;
  }

  function weightedRandom(list) {
    const total = list.reduce((sum, item) => sum + RARITY[item.rarity].weight, 0);
    let roll = Math.random() * total;
    for (const item of list) {
      roll -= RARITY[item.rarity].weight;
      if (roll < 0) return item;
    }
    return list[list.length - 1];
  }

  function h11role(c){const r=seal.vars.strGet(c,'$g地精档案编号表'),raw=Array.isArray(r)?r[0]:'';if(!raw)throw Error('请先注册营地角色。');let p;try{p=JSON.parse(raw)}catch(e){throw Error('营地档案损坏，停止写入。')}const uid=String(c.player&&(c.player.userId||c.player.id)||''),list=p.members&&p.members[uid],arr=Array.isArray(list)?list:list?[list]:[];const id=p.active&&p.active[uid]||arr[0]&&arr[0].id;if(!id)throw Error('请先注册营地角色。');return String(c.group&&(c.group.groupId||c.group.id)||'private')+'::'+String(id).padStart(3,'0')}
  function h11read(c){const r=seal.vars.strGet(c,'$mH11角色数据仓库'),raw=Array.isArray(r)?r[0]:'';if(!raw)return {};try{return JSON.parse(raw)}catch(e){throw Error('角色存档损坏，停止写入。')}}
    function addToSharedBackpack(ctx, item) {
    if (!seal.vars || typeof seal.vars.strGet !== 'function' || typeof seal.vars.strSet !== 'function') {
      throw new Error('无法访问共享背包变量，请确认已安装并启用「地精背包核心」。');
    }

    const store=h11read(ctx),role=h11role(ctx);
    const raw=store[role] ? JSON.stringify(store[role]) : '';
    let data;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        throw new Error('共享背包存档无法解析，本次采集没有写入。');
      }
    } else {
      data = {};
    }

    if (!data.items || typeof data.items !== 'object') data.items = {};
    const key = item.category;
    if (!data.items[key] || typeof data.items[key] !== 'object') data.items[key] = {};
    const current = data.items[key][item.name] || { count: 0, description: item.description };
    current.count = Math.max(0, Number(current.count) || 0) + 1;
    current.description = item.description;
    data.items[key][item.name] = current;
    data.version = 2;

    if (!Number.isFinite(Number(data.hp))) data.hp = 10;
    if (!Number.isFinite(Number(data.maxHp))) data.maxHp = 10;

    store[role]=data;
    seal.vars.strSet(ctx, '$mH11角色数据仓库', JSON.stringify(store));
    return current.count;
  }

  function formatItem(item, count) {
    const rarity = RARITY[item.rarity];
    return [
      '🌿【采集结果】',
      '',
      '你采集到了：' + item.name + '！',
      '类别：' + (item.category === 'mushroom' ? '蘑菇' : '浆果'),
      '稀有度：' + rarity.stars + ' ' + rarity.name,
      '说明：' + item.description,
      '当前持有：' + count + ' 个',
      item.poisonous ? '☠️ 注意：这是有毒类素材，食用会使 HP -1。' : ''
    ].filter(Boolean).join('\n');
  }

  registerCommand('采集', '开始采集，2 秒后随机获得蘑菇或浆果：.采集', (ctx, msg) => {
    reply(ctx, msg, '🌿 会采集到什么呢？');
    setTimeout(() => {
      try {
        const item = weightedRandom(ITEMS);
        const count = addToSharedBackpack(ctx, item);
        reply(ctx, msg, formatItem(item, count));
      } catch (e) {
        console.log('[地精采集] 采集结算失败：' + e);
        reply(ctx, msg, '🌿 采集失败：' + String(e.message || e));
      }
    }, 2000);
  });

  registerCommand('采集信息', '查看地精采集规则与稀有度：.采集信息', (ctx, msg) => {
    const lines = [
      '🌿【地精采集手册】',
      '',
      '使用 .采集 开始采集，等待 2 秒后获得随机素材。',
      '采集范围：蘑菇、浆果。',
      '',
      '【稀有度】',
      '★☆☆ 普通：70%',
      '★★☆ 少见：24%',
      '★★★ 稀有：6%',
      '',
      '所有采集物会自动进入共享背包。',
      '使用 .背包 蘑菇 或 .背包 浆果 查看。',
      '',
      '☠️ 红菇属属于有毒类游戏素材，食用后 HP -1；获得时不会自动扣血。'
    ];
    reply(ctx, msg, lines.join('\n'));
  });

  registerCommand('采集图鉴', '查看采集图鉴：.采集图鉴 [蘑菇/浆果]', (ctx, msg, args) => {
    const filter = String(args.getArgN(1) || '').trim();
    let list = ITEMS;
    if (filter === '蘑菇') list = ITEMS.filter(item => item.category === 'mushroom');
    else if (filter === '浆果') list = ITEMS.filter(item => item.category === 'berry');
    else if (filter) {
      reply(ctx, msg, '分类请填写「蘑菇」或「浆果」。');
      return;
    }

    const lines = ['📖【地精采集图鉴】', ''];
    for (const key of ['rare', 'uncommon', 'common']) {
      const entries = list.filter(item => item.rarity === key);
      if (!entries.length) continue;
      lines.push('【' + RARITY[key].stars + ' ' + RARITY[key].name + '】');
      for (const item of entries) {
        lines.push('• ' + item.name + (item.poisonous ? ' ☠️' : '') + '：' + item.description);
      }
      lines.push('');
    }
    reply(ctx, msg, lines.join('\n'));
  });

  seal.ext.register(ext);

  console.log('[地精采集] v' + VERSION + ' 已加载，共 ' + ITEMS.length + ' 种素材。');
})();
