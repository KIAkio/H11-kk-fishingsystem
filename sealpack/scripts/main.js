// ==UserScript==
// @name         地精背包核心
// @author       KIAkio
// @version      1.5.8
// @description  统一管理钓鱼、地精采集与冬训营日用品和训练装备
// @timestamp    1794441600
// ==/UserScript==

(function () {
  'use strict';

  const EXT_ID = 'goblin_backpack_core';
  const VERSION = '1.5.8';
  const DATA_VAR = '$m地精背包数据';
  const DEFAULT_HP = 10;
  const GROUP_PROFILE_VAR = '$g地精档案编号表';

  // 物品分类名称。其他玩法接入时也使用这些分类键。
  const CATEGORY = {
    fish: '鱼类',
    mushroom: '蘑菇',
    berry: '浆果',
    supplies: '日用品',
    equipment: '训练装备',
    other: '其他'
  };

  // 当前已经登记的素材。这里仅建立物品索引，不会自动发放到玩家背包。
  const ITEM_CATALOG = {
    mushroom: [
      '一等牛肝菌',
      '鸡油菌',
      '松菇',
      '白桦树下的小蘑菇',
      '白杨树下的小蘑菇',
      '松树下的小蘑菇',
      '榛蘑',
      '白桦茸',
      '野生金针菇',
      '红菇属'
    ],
    berry: [
      '蓝莓',
      '越橘',
      '云莓',
      '北悬钩子',
      '蓝靛果忍冬',
      '醋栗',
      '花楸果',
      '绣球荚蒾',
      '沙棘',
      '野玫瑰果',
      '蔓越莓'
    ],
    supplies: [
      '止血带',
      '保温毯',
      '急救包',
      '水壶',
      '手套',
      '口哨'
    ],
    equipment: [
      '折叠刀',
      '望远镜',
      '手电筒',
      '头灯',
      '指南针'
    ]
  };

  // 红菇属是游戏设定中的有毒物品。此设定不代表现实食用建议。
  const ITEM_EFFECTS = {
    '红菇属': {
      type: 'poison',
      hp: -1,
      description: '有毒蘑菇，食用后 HP -1'
    }
  };

  let ext = seal.ext.find(EXT_ID);
  if (!ext) {
    ext = seal.ext.new(EXT_ID, 'KIAkio', VERSION);
  } else {
    console.log('[地精背包] 检测到同名扩展，跳过重复注册。');
    return;
  }

  function createDefaultData() {
    return {
      version: 3,
      hp: DEFAULT_HP,
      maxHp: DEFAULT_HP,
      hunger: 4,
      hungerUpdatedAt: Date.now(),
      items: {
        fish: {},
        mushroom: {},
        berry: {},
        supplies: {},
        equipment: {},
        other: {}
      }
    };
  }

  function normalizeData(data) {
    const base = createDefaultData();
    if (!data || typeof data !== 'object') return base;

    const hp = Number(data.hp);
    const maxHp = Number(data.maxHp);

    base.hp = Number.isFinite(hp)
      ? Math.max(0, Math.min(999, hp))
      : DEFAULT_HP;
    base.maxHp = Number.isFinite(maxHp)
      ? Math.max(1, Math.min(999, maxHp))
      : DEFAULT_HP;

    base.version = 3;
    base.hunger = Number.isFinite(Number(data.hunger)) ? Math.max(0, Math.min(4, Number(data.hunger))) : 4;
    base.hungerUpdatedAt = Number.isFinite(Number(data.hungerUpdatedAt)) ? Number(data.hungerUpdatedAt) : Date.now();

    if (data.items && typeof data.items === 'object') {
      for (const key of Object.keys(CATEGORY)) {
        if (data.items[key] && typeof data.items[key] === 'object') {
          base.items[key] = data.items[key];
        }
      }
    }

    return base;
  }

  function applyLifeTicks(data) {
    const now = Date.now();
    if (!Number.isFinite(Number(data.hunger))) data.hunger = 4;
    if (!Number.isFinite(Number(data.hungerUpdatedAt))) data.hungerUpdatedAt = now;
    const start = Number(data.hungerUpdatedAt);
    if (start > now) {
      data.hungerUpdatedAt = now;
      return data;
    }
    // 北京时间固定 UTC+8，兼容不提供 Intl 的 SealDice JS 沙箱。
    const beijingStart = new Date(start + 8 * 60 * 60 * 1000);
    const y = beijingStart.getUTCFullYear();
    const m = beijingStart.getUTCMonth() + 1;
    const d = beijingStart.getUTCDate();
    for (let offset = 0; offset <= 370; offset++) {
      const date = new Date(Date.UTC(y, m - 1, d + offset));
      for (const hour of [5, 10, 15, 20]) {
        const timestamp = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour - 8);
        if (timestamp > start && timestamp <= now) {
          data.hunger = hour === 5 ? 1 : Math.max(0, Number(data.hunger) - 1);
        }
      }
    }
    data.hunger = Math.max(0, Math.min(4, Number(data.hunger)));
    data.hungerUpdatedAt = now;
    for (const [name, item] of Object.entries(data.items.other || {})) {
      if (item && item.campBreakfast && Number(item.expiresAt) > 0 && Number(item.expiresAt) <= now) {
        delete data.items.other[name];
      }
    }
    return data;
  }

  // 使用海豹个人变量 $m 保存数据：同一玩家跨群共享，也能被其他 JS 插件读取。
  function loadData(ctx) {
    if (!seal.vars || typeof seal.vars.strGet !== 'function') {
      throw new Error('当前海豹核心不支持 seal.vars.strGet，请升级核心后再使用。');
    }

    const result = seal.vars.strGet(ctx, DATA_VAR);
    const raw = Array.isArray(result) ? result[0] : '';
    if (!raw) return createDefaultData();

    try {
      return applyLifeTicks(normalizeData(JSON.parse(raw)));
    } catch (e) {
      console.log('[地精背包] 存档解析失败：' + e);
      return createDefaultData();
    }
  }

  function saveData(ctx, data) {
    if (!seal.vars || typeof seal.vars.strSet !== 'function') {
      throw new Error('当前海豹核心不支持 seal.vars.strSet，请升级核心后再使用。');
    }
    seal.vars.strSet(ctx, DATA_VAR, JSON.stringify(normalizeData(data)));
  }


  function getPlayerId(ctx) {
    return String(ctx.player && (ctx.player.userId || ctx.player.id) || '').trim();
  }

  function loadGroupProfiles(ctx) {
    if (!seal.vars || typeof seal.vars.strGet !== 'function') {
      throw new Error('当前海豹核心不支持群变量存档。');
    }
    const result = seal.vars.strGet(ctx, GROUP_PROFILE_VAR);
    const raw = Array.isArray(result) ? result[0] : '';
    if (!raw) return { nextId: 0, members: {} };
    try {
      const parsed = JSON.parse(raw);
      const members = parsed.members && typeof parsed.members === 'object' ? parsed.members : {};
      for (const [uid, record] of Object.entries(members)) {
        if (typeof record === 'string') members[uid] = { id: record, name: '' };
        else if (!record || typeof record !== 'object') members[uid] = { id: '', name: '' };
      }
      return { nextId: Math.max(0, Number(parsed.nextId) || 0), members };
    } catch (e) {
      console.log('[地精背包] 群档案编号表损坏：' + e);
      return { nextId: 0, members: {} };
    }
  }

  function saveGroupProfiles(ctx, data) {
    seal.vars.strSet(ctx, GROUP_PROFILE_VAR, JSON.stringify(data));
  }

  function getOrCreateGroupProfile(ctx, registeredName) {
    const userId = getPlayerId(ctx);
    if (!userId) throw new Error('无法读取你的平台用户 ID。');
    const profiles = loadGroupProfiles(ctx);
    const platformName = String(ctx.player && ctx.player.name || '冒险者').trim() || '冒险者';
    const customName = String(registeredName || '').trim();
    if (profiles.members[userId]) {
      const record = profiles.members[userId];
      if (customName) record.name = customName;
      if (!record.name) record.name = platformName;
      saveGroupProfiles(ctx, profiles);
      return { id: record.id, name: record.name, created: false };
    }
    const id = String(profiles.nextId).padStart(3, '0');
    const name = customName || platformName;
    profiles.members[userId] = { id, name };
    profiles.nextId += 1;
    saveGroupProfiles(ctx, profiles);
    return { id, name, created: true };
  }

  function getRegisteredName(ctx) {
    const userId = getPlayerId(ctx);
    if (!userId) return String(ctx.player && ctx.player.name || '冒险者').trim() || '冒险者';
    const profiles = loadGroupProfiles(ctx);
    const record = profiles.members[userId];
    if (record && typeof record === 'object' && record.name) return record.name;
    return String(ctx.player && ctx.player.name || '冒险者').trim() || '冒险者';
  }

  function getCategoryKey(input) {
    const value = String(input || '').trim();
    if (!value) return '';
    for (const [key, label] of Object.entries(CATEGORY)) {
      if (value === key || value === label) return key;
    }
    if (value === '蘑菇类') return 'mushroom';
    if (value === '浆果类') return 'berry';
    if (value === '鱼') return 'fish';
    if (value === '生活用品') return 'supplies';
    if (value === '装备' || value === '工具') return 'equipment';
    return '';
  }

  function getItemCount(data, category, name) {
    const item = data.items[category][name];
    return item ? Math.max(0, Number(item.count) || 0) : 0;
  }

  // 供后续“钓鱼”和“地精采集”插件遵循的统一数据结构：
  // data.items.fish[name] = { count: 1, description: '' }
  // data.items.mushroom[name] = { count: 1, description: '' }
  // data.items.berry[name] = { count: 1, description: '' }
  function addItem(data, category, name, amount, description) {
    if (!CATEGORY[category]) throw new Error('未知物品分类。');
    const itemName = String(name || '').trim();
    const qty = Math.floor(Number(amount));
    if (!itemName) throw new Error('物品名称不能为空。');
    if (!Number.isFinite(qty) || qty < 1 || qty > 9999) {
      throw new Error('物品数量必须为 1 至 9999 的整数。');
    }

    const current = data.items[category][itemName] || {
      count: 0,
      description: String(description || '')
    };
    current.count = Math.max(0, Number(current.count) || 0) + qty;
    if (description) current.description = String(description);
    data.items[category][itemName] = current;
    return current.count;
  }

  function removeItem(data, category, name, amount) {
    const item = data.items[category][name];
    const qty = Math.floor(Number(amount));
    if (!item || item.count < qty) return false;
    item.count -= qty;
    if (item.count <= 0) delete data.items[category][name];
    return true;
  }

  function reply(ctx, msg, text) {
    seal.replyToSender(ctx, msg, text);
  }

  function registerCommand(name, help, handler) {
    const cmd = seal.ext.newCmdItemInfo();
    cmd.name = name;
    cmd.help = help;
    cmd.solve = (ctx, msg, cmdArgs) => {
      try {
        handler(ctx, msg, cmdArgs);
      } catch (e) {
        console.log('[地精背包] 指令异常：' + e);
        reply(ctx, msg, '背包系统发生错误：' + String(e.message || e));
      }
      return seal.ext.newCmdExecuteResult(true);
    };
    ext.cmdMap[name] = cmd;
  }

  function renderCategory(data, category) {
    const entries = Object.entries(data.items[category] || {})
      .filter(([, item]) => item && Number(item.count) > 0)
      .sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));

    if (!entries.length) return '（空）';

    return entries.map(([name, item]) => {
      const effect = ITEM_EFFECTS[name];
      const mark = effect ? ' ☠️' : '';
      const durability = Number.isFinite(Number(item.durability)) ? ' [耐久 ' + item.durability + ']' : '';
      const equipped = item.equipped ? ' [已装备]' : '';
      return '• ' + name + ' ×' + item.count + mark + durability + equipped;
    }).join('\n');
  }


  // H11 统一指令索引：按玩法分组，避免与各子模块的数据逻辑耦合。
  const H11_HELP = [
    '📖【H11 指令查询表】',
    '【档案与背包】',
    '.注册 [姓名] — 建立档案或更新姓名',
    '.背包 [鱼类/蘑菇/浆果/日用品/训练装备/其他] — 查看背包',
    '.状态 — 查看 HP 与饱腹值',
    '.食用 食物名 — 食用背包物品',
    '.丢弃 物品名 [数量/全部] — 丢弃物品',
    '.重置所有背包 确认 — 清空个人背包并恢复 HP',
    '.发放 @玩家 分类 物品名 数量 — 管理员发放物品',
    '【冬训营生活】',
    '.点名 — 每日点名（北京时间 00:00—11:59）',
    '.点名信息 — 查看个人点名记录',
    '.点名排行 — 查看本群点名排行',
    '.饱腹 — 查看饱腹值',
    '.营地菜单 — 查看早餐菜单',
    '.共享 食物名 @同学... — 与 1—3 位同学共享食物',
    '【地精采集】',
    '.采集 — 随机采集蘑菇或浆果',
    '.采集信息 — 查看采集规则与概率',
    '.采集图鉴 [蘑菇/浆果] — 查看采集图鉴',
    '【钓鱼】',
    '.钓鱼 — 开始钓鱼',
    '.查看钓鱼信息 — 查看个人钓鱼数据',
    '.查看背包 — 查看钓鱼模块记录的鱼类',
    '.钓鱼排行 — 查看钓鱼排行',
    '【查询帮助】',
    '.指令H11 / 。指令H11 / ，指令H11 — 查看本表',
    '注：部分指令需要安装并启用对应的扩展。'
  ].join('\n');
  registerCommand('指令H11', '查看 H11 全部玩法指令：.指令H11', (ctx, msg) => reply(ctx, msg, H11_HELP));

  // 中文标点兼容：当海豹核心尚未配置中文前缀时，仍可查询 H11。
  // 其他玩法指令应在海豹核心的“指令前缀”中统一添加中文标点。
  ext.onNotCommandReceived = (ctx, msg) => {
    const input = String((msg && msg.message) || '').trim();
    if (/^[。，]指令H11\s*$/i.test(input)) reply(ctx, msg, H11_HELP);
  };

  registerCommand('注册', '建立档案：.注册 姓名', (ctx, msg, args) => {
    const requestedName = String(args.getArgN(1) || '').trim();
    const profile = getOrCreateGroupProfile(ctx, requestedName);
    const data = loadData(ctx);
    saveData(ctx, data);
    const totalCount = Object.values(data.items)
      .reduce((n, group) => n + Object.values(group)
        .reduce((sum, item) => sum + (Number(item.count) || 0), 0), 0);
    const lines = [
      '📋【' + profile.name + '的档案】',
      'ID：' + profile.id,
      '❤️ HP：' + data.hp + ' / ' + data.maxHp,
      '⭐ 等级：1',
      '✨ 经验：0',
      '🎒 背包：' + (totalCount || '空')
    ];
    reply(ctx, msg, lines.join(String.fromCharCode(10)));
  });

  registerCommand('背包', '查看背包：.背包 / .背包 鱼类、蘑菇、浆果、日用品、训练装备、其他', (ctx, msg, args) => {
    const data = loadData(ctx);
    saveData(ctx, data);

    const filter = getCategoryKey(args.getArgN(1));
    const ownerName = getRegisteredName(ctx);
    const lines = [
      '🎒【' + ownerName + '的背包】',
      '❤️ HP：' + data.hp + ' / ' + data.maxHp,
      ''
    ];

    const keys = filter ? [filter] : ['supplies', 'equipment', 'fish', 'mushroom', 'berry', 'other'];
    const emptyCategories = [];
    for (const key of keys) {
      const rendered = renderCategory(data, key);
      if (rendered === '（空）') {
        emptyCategories.push(CATEGORY[key]);
        continue;
      }
      lines.push('【' + CATEGORY[key] + '】');
      lines.push(rendered);
      lines.push('');
    }
    if (!filter && emptyCategories.length) {
      lines.push('当前空置类别：' + emptyCategories.join('/'));
      lines.push('');
    } else if (filter && emptyCategories.length) {
      lines.push('【' + CATEGORY[filter] + '】');
      lines.push('（空）');
      lines.push('');
    }

    const totalKinds = Object.values(data.items)
      .reduce((sum, group) => sum + Object.keys(group).length, 0);
    const totalCount = Object.values(data.items)
      .reduce((sum, group) => sum + Object.values(group)
        .reduce((n, item) => n + Math.max(0, Number(item.count) || 0), 0), 0);

    lines.push('物品种类：' + totalKinds + ' 种');
    lines.push('物品总数：' + totalCount + ' 件');
    reply(ctx, msg, lines.join('\n'));
  });


  registerCommand('发放', '管理员发放物品：.发放 @玩家 分类 物品名 数量', (ctx, msg, args) => {
    if (Number(ctx.privilegeLevel) < 50) {
      reply(ctx, msg, '只有群管理员、群主或骰主可以发放物品。');
      return;
    }

    const targetCtx = seal.getCtxProxyFirst(ctx, args);
    if (!targetCtx || !targetCtx.player || !targetCtx.player.userId) {
      reply(ctx, msg, '请先 @ 一位玩家。格式：.发放 @玩家 日用品 止血带 1');
      return;
    }

    // @目标可能占据第一个命令参数；同时兼容未计入参数的适配器。
    const first = String(args.getArgN(1) || '').trim();
    const offset = getCategoryKey(first) ? 0 : 1;
    const category = getCategoryKey(args.getArgN(1 + offset));
    const itemName = String(args.getArgN(2 + offset) || '').trim();
    const amountText = String(args.getArgN(3 + offset) || '1').trim();
    const amount = Math.floor(Number(amountText));

    if (!category || !itemName) {
      reply(ctx, msg, '格式：.发放 @玩家 分类 物品名 数量\n分类：鱼类、蘑菇、浆果、日用品、训练装备、其他');
      return;
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 9999) {
      reply(ctx, msg, '发放数量必须为 1 至 9999 的整数。');
      return;
    }

    const targetData = loadData(targetCtx);
    const newCount = addItem(targetData, category, itemName, amount, '');
    saveData(targetCtx, targetData);

    const targetName = String(targetCtx.player.name || '玩家');
    reply(ctx, msg, '🎁 已向「' + targetName + '」发放：' + itemName + ' ×' + amount +
      '\n对方当前持有：' + newCount + ' 件');
  });


  registerCommand('重置所有背包', '重置自己的全部背包物品与 HP：.重置所有背包 确认', (ctx, msg, args) => {
    const confirm = String(args.getArgN(1) || '').trim();
    if (confirm !== '确认') {
      reply(ctx, msg, '⚠️ 此操作会清空你在所有群共享的背包物品，并将 HP 恢复为 10。\n如确定重置，请输入：.重置所有背包 确认');
      return;
    }
    const fresh = createDefaultData();
    saveData(ctx, fresh);
    reply(ctx, msg, '🧹 已重置你的全部背包：物品已清空，HP 已恢复为 10 / 10。\n档案编号不会改变。');
  });

  registerCommand('状态', '查看生命值与饱腹值：.状态', (ctx, msg) => {
    const data = loadData(ctx);
    saveData(ctx, data);
    const hearts = '❤️'.repeat(Math.min(data.hp, 20)) +
      '🖤'.repeat(Math.min(Math.max(0, data.maxHp - data.hp), 20));
    reply(ctx, msg, '【' + getRegisteredName(ctx) + '的状态】\n' + hearts +
      '\n生命值：' + data.hp + ' / ' + data.maxHp +
      (Number(data.hunger) === 0 ? '\n【饥饿】' : '') +
      '\n饱腹值：' + (Number(data.hunger) || 0) + ' / 4');
  });

  registerCommand('食用', '食用背包中的食物：.食用 食物名称（营地早餐可省略前缀）', (ctx, msg, args) => {
    const requested = String(args.getArgN(1) || '').trim();
    if (!requested) {
      reply(ctx, msg, '请指定要食用的物品，例如：.食用 燕麦粥');
      return;
    }
    const data = loadData(ctx);
    const candidates = requested.startsWith('营地早餐：')
      ? [requested]
      : [requested, '营地早餐：' + requested];
    let foundCategory = '';
    let foundName = '';
    let item = null;
    for (const candidate of candidates) {
      for (const key of Object.keys(CATEGORY)) {
        if (data.items[key][candidate] && Number(data.items[key][candidate].count) > 0) {
          foundCategory = key;
          foundName = candidate;
          item = data.items[key][candidate];
          break;
        }
      }
      if (item) break;
    }
    const effect = ITEM_EFFECTS[requested] || ITEM_EFFECTS[foundName];
    if (!item) {
      reply(ctx, msg, '背包里没有「' + requested + '」。');
      return;
    }
    if (!effect && !item.campBreakfast && !Number.isFinite(Number(item.hungerRestore))) {
      reply(ctx, msg, '目前没有为「' + requested + '」设置食用效果，暂时不能食用。');
      return;
    }
    const oldHp = data.hp;
    const oldHunger = Number(data.hunger) || 0;
    removeItem(data, foundCategory, foundName, 1);
    if (effect) {
      data.hp = Math.max(0, Math.min(data.maxHp, data.hp + Number(effect.hp || 0)));
    } else {
      data.hp = Math.max(0, Math.min(data.maxHp, data.hp + (Number(item.hpRestore) || 1)));
      data.hunger = Math.min(4, Math.max(0, oldHunger + (Number(item.hungerRestore) || (item.campBreakfast ? 3 : 0))));
    }
    saveData(ctx, data);
    if (effect) {
      reply(ctx, msg, '☠️ 你食用了「' + foundName + '」。\n' + effect.description +
        '\nHP：' + oldHp + ' → ' + data.hp + ' / ' + data.maxHp);
    } else {
      reply(ctx, msg, '🍽️ 你食用了「' + foundName + '」。\n❤️ HP：' + oldHp +
        ' → ' + data.hp + ' / ' + data.maxHp + '\n饱腹值：' + oldHunger +
        ' → ' + data.hunger + ' / 4');
    }
  });

  registerCommand('丢弃', '丢弃背包物品：.丢弃 物品名 [数量]', (ctx, msg, args) => {
    const name = String(args.getArgN(1) || '').trim();
    const amountArg = String(args.getArgN(2) || '1').trim();
    const amount = amountArg === '全部' ? -1 : Math.floor(Number(amountArg));

    if (!name) {
      reply(ctx, msg, '请指定要丢弃的物品，例如：.丢弃 蓝莓 2');
      return;
    }
    if (amount !== -1 && (!Number.isFinite(amount) || amount < 1)) {
      reply(ctx, msg, '数量必须是正整数，或填写“全部”。');
      return;
    }

    const data = loadData(ctx);
    let foundCategory = '';
    for (const key of Object.keys(CATEGORY)) {
      if (data.items[key][name]) {
        foundCategory = key;
        break;
      }
    }

    if (!foundCategory) {
      reply(ctx, msg, '背包里没有「' + name + '」。');
      return;
    }

    const count = getItemCount(data, foundCategory, name);
    const qty = amount === -1 ? count : amount;
    if (qty > count) {
      reply(ctx, msg, '数量不足，目前只有 ' + count + ' 个「' + name + '」。');
      return;
    }

    removeItem(data, foundCategory, name, qty);
    saveData(ctx, data);
    reply(ctx, msg, '已丢弃「' + name + '」×' + qty + '。');
  });

  // 给后续模块的共享协议说明：
  // 读取：const [raw] = seal.vars.strGet(ctx, '$m地精背包数据');
  // 写入：seal.vars.strSet(ctx, '$m地精背包数据', JSON.stringify(data));
  // 群档案编号使用 $g 变量：每个群从 000 独立递增；背包物品使用 $m 变量：跨群同步。\n  // 分类键固定为 fish / mushroom / berry / supplies / equipment / other。
  // 每项格式：{ count, description, consumable, durability, equipped }。
  seal.ext.register(ext);

  console.log('[地精背包] v' + VERSION + ' 已加载。共享个人变量：' + DATA_VAR);
})();
