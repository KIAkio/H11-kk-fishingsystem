// ==UserScript==
// @name         地精背包核心
// @author       KIAkio
// @version      1.8.13
// @description  统一管理钓鱼、地精采集与冬训营日用品和训练装备
// @timestamp    1794441600
// ==/UserScript==

(function () {
  'use strict';

  const EXT_ID = 'goblin_backpack_core';
  const VERSION = '1.8.13';
  const DATA_VAR = '$m地精背包数据';
  const DEFAULT_HP = 10;
  const FALL_LIMIT = 3;
  const HUNGER_LINES = [
    '人是铁饭是钢，铁人同志xx由于长期未进食而倒下了……“要记得吃饭啊…”',
    'xx用身体践行了：不吃饭，真的是会死的……RIP.',
    '“好饿…\n就像，会吞噬一切的黑洞\n像，饿了三周的美洲豹\n或，沙漠里奔波了仨月驼峰瘫瘪的骆驼”，xx在死前的写下了这样一篇短诗',
    '“饿死的人，不是一下子就饿死的，而是一点点饿死的。先是面黄，再是乏力，最后浮肿，脚上一按一个坑。一个不好的天气，人就没了。”，而xx，就这样突然地倒下了。',
    '“我从早上起来就没有吃过东西 我现在就像地狱犬看见了人类 好饿好饿 我饿的头晕目眩 饿的十年生死两茫茫 饿的地崩山摧壮士死然后天梯石栈相钩连 等你的时间里 我期待 我向往我像卖火柴的小女孩一样幻想现在时间一分一秒的流逝就像我的生命一样 希望在我临死之前能够吃上一口饭。”这是xx在死前的最后一句话。'
  ];
  const JOURNEY_LINES = [
    '“死亡是一枚沉重而干净的果实，我们吃下去，医治太多活着的病症。”',
    '“你明白，路很远，我不能带着这副身躯走，它太重了。”',
    '“死是一件不必急于求成的事，死是一个必然会降临的节日。”',
    '“人死了，就像水消失在水中。”',
    '“今天，xx死了。也许是昨天，我搞不清。”'
  ];
  const GROUP_PROFILE_VAR = '$g地精档案编号表';
  const ROLE_STORE = '$mH11角色数据仓库';
  const ROLE_ACTIVE = '$mH11当前角色索引';

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
    // 更新已有扩展的指令映射，不再因为同名扩展而跳过新指令注册。
    console.log('[地精背包] 检测到已有扩展，重新绑定 v'+VERSION+' 指令。');
  }

  function createDefaultData() {
    return {
      version: 3,
      hp: DEFAULT_HP,
      maxHp: DEFAULT_HP,
      hunger: 4,
      falls: 0,
      dead: false,
      pendingNotices: [],
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

    base.hp = Math.min(base.hp, base.maxHp);
    base.falls = Math.max(0, Math.min(FALL_LIMIT, Math.floor(Number(data.falls) || 0)));
    base.dead = data.dead === true || base.falls >= FALL_LIMIT;
    base.pendingNotices = Array.isArray(data.pendingNotices) ? data.pendingNotices.filter(x => typeof x === 'string' && x.trim()) : [];
    if (base.dead) base.hp = 0;
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

  function chooseLine(lines) {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  function deathAnnouncement(name) {
    return chooseLine(JOURNEY_LINES).replace(/xx/g, () => name) + '\n' + name + '结束了这次旅程。';
  }

  function changeHp(data, amount, name, cause = 'fatigue', trapName = '') {
    if (data.dead) return '';
    const before = data.hp;
    data.hp = Math.max(0, Math.min(data.maxHp, before + amount));
    if (before <= 0 || data.hp !== 0) return '';

    data.falls++;
    data.dead = data.falls >= FALL_LIMIT;
    let lines;
    if (cause === 'hunger') {
      let flavor = chooseLine(HUNGER_LINES);
      if (!data.dead) {
        flavor = flavor.replace('真的是会死的……RIP.', '真的会倒下……')
          .replace('在死前的写下', '在倒下前写下')
          .replace('在死前的最后一句话', '在倒下前说的话');
      }
      lines = [name + '因为饥饿而倒下了。', flavor.replace(/xx/g, () => name)];
    } else if (cause === 'trap') {
      lines = [name + '因落入' + trapName + '而耗尽了体力。'];
    } else if (cause === 'drain') {
      lines = [name + '被无形之物抽成了老鼠干，' + name + '倒下了。'];
    } else {
      lines = [name + '因为体力耗尽而倒下了。'];
    }
    if (data.dead) lines.push(deathAnnouncement(name));
    return lines.join('\n');
  }

  function applyLifeTicks(data, name) {
    let notice = '';
    const now = Date.now();
    if (!Number.isFinite(Number(data.hunger))) data.hunger = 4;
    if (!Number.isFinite(Number(data.hungerUpdatedAt))) data.hungerUpdatedAt = now;
    const start = Number(data.hungerUpdatedAt);
    if (start > now) {
      data.hungerUpdatedAt = now;
      return notice;
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
          if (Number(data.hunger) <= 0) {
            data.hunger = 0;
            notice = changeHp(data, -1, name, 'hunger') || notice;
          } else {
            data.hunger = hour === 5 ? 1 : Math.max(0, Number(data.hunger) - 1);
          }
        }
      }
    }
    data.hunger = Math.max(0, Math.min(4, Number(data.hunger)));
    data.hungerUpdatedAt = now;
    for (const [name, item] of Object.entries(data.items.other || {})) {
      if (!item || !item.campBreakfast) continue;
      const count = Math.max(0, Number(item.count) || 0);
      let batches = Array.isArray(item.breakfastBatches)
        ? item.breakfastBatches.filter(batch => batch && Number(batch.count) > 0)
        : [{ count, expiresAt: Number(item.expiresAt) || 0 }];
      batches.sort((a, b) => (Number(a.expiresAt) || 0) - (Number(b.expiresAt) || 0));
      let excess = batches.reduce((sum, batch) => sum + Number(batch.count), 0) - count;
      for (const batch of batches) {
        if (excess <= 0) break;
        const used = Math.min(excess, Number(batch.count));
        batch.count -= used;
        excess -= used;
      }
      batches = batches.filter(batch => Number(batch.count) > 0 &&
        (!Number(batch.expiresAt) || Number(batch.expiresAt) > now));
      item.count = batches.reduce((sum, batch) => sum + Number(batch.count), 0);
      if (!item.count) delete data.items.other[name];
      else {
        item.breakfastBatches = batches;
        item.expiresAt = Math.min(...batches.map(batch => Number(batch.expiresAt) || Infinity));
      }
    }
    return notice;
  }

  function getPlayerId(ctx) {
    return String(ctx.player && (ctx.player.userId || ctx.player.id) || '').trim();
  }
  function sourceGroupKey(ctx) {
    return String(ctx.group && (ctx.group.groupId || ctx.group.id) || 'private');
  }
  function jsonRead(ctx, key, fallback) {
    const r = seal.vars.strGet(ctx, key), raw = Array.isArray(r) ? r[0] : '';
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { throw new Error('存档 '+key+' 解析失败，已停止写入以保护数据。'); }
  }
  function jsonWrite(ctx, key, value) { seal.vars.strSet(ctx, key, JSON.stringify(value)); }
  function readGroupProfiles(ctx) {
    const p = jsonRead(ctx, GROUP_PROFILE_VAR, { nextId: 0, members: {}, active: {} });
    if (!p.members || typeof p.members !== 'object') p.members = {};
    if (!p.active || typeof p.active !== 'object') p.active = {};
    let highest = -1;
    for (const uid of Object.keys(p.members)) {
      const old = p.members[uid];
      const list = Array.isArray(old) ? old : old ? [old] : [];
      p.members[uid] = list.map(x => typeof x === 'string' ? {id:x,name:''} : x).filter(x=>x && x.id != null).map(x=>({id:String(x.id).padStart(3,'0'),name:String(x.name||''),role:['学员','教官','教师'].includes(x.role)?x.role:'学员'}));
      for (const x of p.members[uid]) { const n=Number(x.id); if(Number.isInteger(n))highest=Math.max(highest,n); }
      if (!p.active[uid] && p.members[uid].length) p.active[uid] = p.members[uid][0].id;
    }
    p.nextId = Math.max(0, Number(p.nextId)||0, highest+1);
    return p;
  }
  const CAMP_SETTING = 'h11_primary_group';
  const ATTENDANCE_STORE = '$mH11角色点名仓库';
  const CAMP_QUEUE = '$gH11待发放物品';
  const CAMP_RANK = '$g冬训营点名排行';
  const DAILY_REPORT = '$gH11营地每日播报';

  function temporaryContext(ctx, uid, groupId) {
    const endpoint = ctx.endPoint;
    if (!endpoint) throw Error('无法读取机器人接入端。');
    const msg = seal.newMessage();
    msg.platform = endpoint.platform;
    msg.messageType = groupId ? 'group' : 'private';
    msg.groupId = groupId || '';
    msg.sender.userId = uid;
    const result = seal.createTempCtx(endpoint, msg);
    if (!result || !result.group || getPlayerId(result) !== uid) {
      throw Error('无法读取该会话的营地存档。');
    }
    return result;
  }

  function groupContext(ctx) {
    const id = ext.storageGet(CAMP_SETTING);
    if (!id || !getPlayerId(ctx).startsWith('QQ:') || sourceGroupKey(ctx) === id) return ctx;
    const target = temporaryContext(ctx, getPlayerId(ctx), id);
    if (sourceGroupKey(target) !== id) throw Error('无法读取主群档案。');
    return target;
  }

  function groupKey(ctx) { return sourceGroupKey(groupContext(ctx)); }

  function migrateProfiles(source, target, profiles) {
    const from = sourceGroupKey(source), to = sourceGroupKey(target), uid = getPlayerId(source);
    if (from === to) return 0;
    const old = readGroupProfiles(source), roles = old.members[uid] || [];
    if (!roles.length) return 0;
    const mine = profiles.members[uid] || [];
    const imports = profiles.imports || {};
    const stores = [ROLE_STORE, ATTENDANCE_STORE].map(key => [key, jsonRead(source,key,{})]);
    const markerKey = '$mH11旧存档迁移标记';
    const marker = jsonRead(source,markerKey,{});
    const sourceRank = jsonRead(source,CAMP_RANK,{members:{}});
    const targetRank = jsonRead(target,CAMP_RANK,{members:{}});
    const sourceQueue = jsonRead(source,CAMP_QUEUE,{});
    const targetQueue = jsonRead(target,CAMP_QUEUE,{});
    const active = old.active[uid];
    for (const role of roles) {
      const oldKey = from+'::'+role.id, importKey = uid+'::'+oldKey;
      let nextId = imports[importKey];
      if (!nextId) {
        const existing = mine.find(entry => entry.name === role.name);
        nextId = existing ? existing.id : String(profiles.nextId++).padStart(3,'0');
        if (!existing) mine.push(Object.assign({}, role, {id:nextId}));
        imports[importKey] = nextId;
      }
      const newKey = to+'::'+nextId;
      for (const [key, store] of stores) {
        if (!Object.prototype.hasOwnProperty.call(store,oldKey)) continue;
        if (Object.prototype.hasOwnProperty.call(store,newKey) &&
            JSON.stringify(store[oldKey]) !== JSON.stringify(store[newKey])) {
          throw Error('角色「'+role.name+'」在两边都有不同的'+(key===ROLE_STORE?'背包':'点名')+'记录，待核对后合并。');
        }
        store[newKey] = store[oldKey];
      }
      const oldRankKey = uid+'::'+oldKey, newRankKey = uid+'::'+newKey;
      if (sourceRank.members[oldRankKey]) targetRank.members[newRankKey] = sourceRank.members[oldRankKey];
      const oldQueueKey = uid+'::'+role.id, newQueueKey = uid+'::'+nextId;
      if (sourceQueue[oldQueueKey] && !targetQueue[newQueueKey]) targetQueue[newQueueKey] = sourceQueue[oldQueueKey];
      if (marker.destination === oldKey) marker.destination = newKey;
      if (role.id === active) profiles.active[uid] = nextId;
    }
    profiles.members[uid] = mine;
    profiles.imports = imports;
    jsonWrite(target,GROUP_PROFILE_VAR,profiles);
    for (const [key, store] of stores) jsonWrite(source,key,store);
    if (marker.done) jsonWrite(source,markerKey,marker);
    jsonWrite(target,CAMP_RANK,targetRank);
    jsonWrite(target,CAMP_QUEUE,targetQueue);
    // 先写入新档案，再撤销旧会话编号。映射保留给钓鱼图鉴迁移使用。
    delete old.members[uid];
    delete old.active[uid];
    jsonWrite(source,GROUP_PROFILE_VAR,old);
    return roles.length;
  }

  function loadGroupProfiles(ctx) {
    const target = groupContext(ctx);
    const profiles = readGroupProfiles(target);
    migrateProfiles(ctx,target,profiles);
    return profiles;
  }

  function saveGroupProfiles(ctx,p) { jsonWrite(groupContext(ctx),GROUP_PROFILE_VAR,p); }
  function currentRole(ctx) {
    const p=loadGroupProfiles(ctx),uid=getPlayerId(ctx);
    return (p.members[uid]||[]).find(x=>x.id===p.active[uid]) || null;
  }
  function roleKey(ctx, id) { return groupKey(ctx)+'::'+String(id); }
  function mayManageCamp(ctx) {
    return Number(ctx.privilegeLevel) >= 100 ||
      (Number(ctx.privilegeLevel) >= 50 && sourceGroupKey(ctx) === groupKey(ctx));
  }

  globalThis.H11CampProfiles = { context: groupContext, groupKey, read: loadGroupProfiles };

  let announceFromCommand;
  function loadData(ctx, role = currentRole(ctx), announce = announceFromCommand, tick = true) {
    if (!role) throw new Error('请先使用 .注册 姓名 创建营地角色。');
    const store=jsonRead(ctx,ROLE_STORE,{});
    const key=roleKey(ctx,role.id);
    if (!Object.prototype.hasOwnProperty.call(store,key)) {
      const legacy=jsonRead(ctx,DATA_VAR,null);
      const migration=jsonRead(ctx,'$mH11旧存档迁移标记',{});
      // 旧个人背包仅分配给首次访问的角色，避免复制给每个新角色。
      if (legacy && !migration.done && currentRole(ctx)?.id === role.id) {
        store[key]=legacy;
        migration.done=true;
        migration.destination=key;
        jsonWrite(ctx,'$mH11旧存档迁移标记',migration);
      } else store[key]=createDefaultData();
      jsonWrite(ctx,ROLE_STORE,store);
    }
    const data = normalizeData(store[key]);
    if (!tick) return data;
    const notice = applyLifeTicks(data, role.name);
    if (notice) {
      if (!Array.isArray(data.pendingNotices)) data.pendingNotices = [];
      data.pendingNotices.push(notice);
    }
    const camp=groupContext(ctx),queue=jsonRead(camp,CAMP_QUEUE,{});
    const queueKey=getPlayerId(ctx)+'::'+String(role.id).padStart(3,'0');
    const pending=Array.isArray(queue[queueKey])?queue[queueKey]:[];
    for(const entry of pending)addItem(data,entry.category,entry.itemName,entry.amount,'');
    saveData(ctx, data, role);
    if (pending.length) {
      delete queue[queueKey];
      jsonWrite(camp,CAMP_QUEUE,queue);
    }
    if (announce && Array.isArray(data.pendingNotices) && data.pendingNotices.length) {
      while (data.pendingNotices.length) {
        const pendingNotice = data.pendingNotices[0];
        announce(pendingNotice);
        data.pendingNotices.shift();
        saveData(ctx, data, role);
      }
    }
    return data;
  }
  function saveData(ctx, data, role = currentRole(ctx)) {
    if (!role) throw new Error('请先注册角色。');
    const store=jsonRead(ctx,ROLE_STORE,{});
    store[roleKey(ctx,role.id)]=normalizeData(data);
    jsonWrite(ctx,ROLE_STORE,store);
  }
  globalThis.H11CampLife = {
    sync(ctx, announce) {
      return loadData(ctx, currentRole(ctx), announce);
    },
    read(ctx, role) {
      return loadData(ctx, role, null, false);
    },
    changeHp(ctx, role, amount, cause, trapName) {
      const data = loadData(ctx, role, null, false);
      const before = data.hp;
      const notice = changeHp(data, amount, role.name, cause, trapName);
      saveData(ctx, data, role);
      return { data, change: data.hp - before, notice };
    },
    restoreFalls(ctx, role, count) {
      const data = loadData(ctx, role, null, false);
      if (data.dead || !Number.isSafeInteger(count) || count < 1) return 0;
      const restored = Math.min(count, data.falls);
      data.falls -= restored;
      saveData(ctx, data, role);
      return restored;
    }
  };

  function getOrCreateGroupProfile(ctx, registeredName) {
    const uid=getPlayerId(ctx);
    if(!uid)throw new Error('无法读取你的平台用户 ID。');
    const p=loadGroupProfiles(ctx),name=String(registeredName||'').trim();
    if(!name)throw new Error('请输入角色名，例如：.注册 埃莱');
    const mine=p.members[uid]||[];
    let role=mine.find(x=>x.name===name);
    const created=!role;
    const duplicate=created && Object.keys(p.members).some(u=>u!==uid && p.members[u].some(x=>x.name===name));
    if(!role){
      role={id:String(p.nextId++).padStart(3,'0'),name,role:'学员'};
      mine.push(role);p.members[uid]=mine;
    }
    p.active[uid]=role.id;
    saveGroupProfiles(ctx,p);
    return {id:role.id,name:role.name,role:role.role||'学员',created,duplicate};
  }
  function getRegisteredName(ctx) {
    const r=currentRole(ctx);
    return r ? r.name : String(ctx.player && ctx.player.name || '冒险者');
  }
  function selectRole(ctx, id) {
    const p=loadGroupProfiles(ctx),uid=getPlayerId(ctx),r=(p.members[uid]||[]).find(x=>x.id===id);
    if(!r)return null;
    p.active[uid]=r.id;saveGroupProfiles(ctx,p);return r;
  }
  function deleteRole(ctx, owner, role) {
    const p=loadGroupProfiles(ctx),list=p.members[owner]||[];
    p.members[owner]=list.filter(x=>x.id!==role.id);
    if(p.active[owner]===role.id)p.active[owner]=p.members[owner].length?p.members[owner][0].id:'';
    saveGroupProfiles(ctx,p);
    if(owner===getPlayerId(ctx)){
      const store=jsonRead(ctx,ROLE_STORE,{});
      delete store[roleKey(ctx,role.id)];jsonWrite(ctx,ROLE_STORE,store);
    }
    return p;
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
      const previous = announceFromCommand;
      announceFromCommand = text => reply(ctx, msg, text);
      try {
        handler(ctx, msg, cmdArgs);
      } catch (e) {
        console.log('[地精背包] 指令异常：' + e);
        reply(ctx, msg, '背包系统发生错误：' + String(e.message || e));
      } finally {
        announceFromCommand = previous;
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
    '.注册 姓名 — 注册或沿用同名角色',
    '.营地名单 — 查看本营地角色',
    '.我的档案 — 查看自己在本营地的角色',
    '.切换 编号 — 切换角色',
    '.任命 编号 教官/教师 — 管理员任命职务',
    '.解除任命 编号 — 管理员恢复学员身份',
    '.删除000 / .删除 000 / .删除 姓名 — 删除角色（需确认）',
    '.确认删除000 / .确认删除 000 — 确认删除',
    '.背包 [鱼类/蘑菇/浆果/日用品/训练装备/其他] — 查看背包',
    '.状态 — 查看 HP、饱腹与倒下次数',
    '.营地状态 — 管理员查看全营地生命、饱腹与倒下记录；可指定姓名或编号',
    '.营地状态重置 确认 — 管理员重置所有角色生命、饱腹、倒下次数',
    '.营地背包重置 确认 — 管理员清空所有角色背包物品',
    '.死刑 / .复活 / .汲取 角色名、编号或 @玩家 — 营地管理员指令',
    '.食用 食物名 — 食用背包物品',
    '.丢弃 物品名 [数量/全部] — 丢弃物品',
    '.重置所有背包 确认 — 清空个人背包并恢复 HP',
    '.发放@玩家 分类 物品名 数量 / .发放 @玩家 分类 物品名 数量 — 管理员发放物品',
    '【冬训营生活】',
    '.点名 — 每日点名（北京时间 00:00—13:00）',
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
    '.鱼篓 — 查看当前角色的钓鱼图鉴',
    '.钓鱼排行 — 查看钓鱼排行',
    '【查询帮助】',
    '.指令H11 / 。指令H11 / ，指令H11 — 查看本表',
    '注：部分指令需要安装并启用对应的扩展。'
  ].join('\n');
  registerCommand('指令H11', '查看 H11 全部玩法指令：.指令H11', (ctx, msg) => reply(ctx, msg, H11_HELP));

  // 离线期间未发送的饥饿倒下通知保存在角色存档，重连后下一条消息到达时重试。
  ext.onMessageReceived = (ctx, msg) => {
    try {
      try { reportMidnight(ctx, msg); }
      catch (e) { console.log('[地精背包] 每日播报失败：' + String(e.message || e)); }
      replayCampNotices(ctx, msg);
      if (sourceGroupKey(ctx) === 'private') {
        const role = currentRole(ctx);
        if (role) loadData(ctx, role, text => reply(ctx,msg,text), true);
      }
    } catch (e) {
      console.log('[地精背包] 消息生命同步失败：' + (e.message || e));
    }
  };

  // 中文标点兼容：当海豹核心尚未配置中文前缀时，仍可查询 H11。
  // 其他玩法指令应在海豹核心的“指令前缀”中统一添加中文标点。
  ext.onNotCommandReceived = (ctx,msg)=>{
    const input=String(msg&&msg.message||'').trim();
    if(/^[。，]指令H11\\s*$/i.test(input))reply(ctx,msg,H11_HELP);
    const match = /^(?:[。，](死刑|复活|汲取)\s*|复活\s+)(?=\S)/.exec(input);
    if (match) {
      try {
        manageLife(ctx, msg, match[1] || '复活');
      } catch (e) {
        reply(ctx, msg, String(e.message || e));
      }
    }
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
      '职务：' + profile.role,
      '❤️ HP：' + data.hp + ' / ' + data.maxHp,
      '⭐ 等级：1',
      '✨ 经验：0',
      '🎒 背包：' + (totalCount || '空')
    ];
    reply(ctx, msg, (profile.created ? (profile.duplicate ? '当前营地存在同名角色：'+profile.name+'\n为您新建档案：'+profile.name+'，'+profile.id+'，请牢记自己的编号。' : '已为您新建角色档案：'+profile.name+'，'+profile.id) : '当前账号已存在角色：'+profile.name+'（'+profile.id+'），已沿用原档案。')+'\n'+lines.join('\n')+'\n❄️'+profile.name+(profile.role==='学员'?'同学':profile.role==='教师'?'老师':'教官')+'，欢迎来到圣布里吉冬训营❄️');
  });

  registerCommand('统一营地档案','骰主在目标群使用：。统一营地档案',(ctx,msg)=>{
    const id=sourceGroupKey(ctx),current=ext.storageGet(CAMP_SETTING);
    if(Number(ctx.privilegeLevel)<100 || !id.startsWith('QQ-Group:') || msg.messageType!=='group'){
      reply(ctx,msg,'请用骰主账号在目标 QQ 群使用本指令。');return;
    }
    if(current && current!==id){
      reply(ctx,msg,'已经绑定了另一个营地主群。');return;
    }
    ext.storageSet(CAMP_SETTING,id);
    const profiles=readGroupProfiles(ctx);
    let count=0;
    const conflicts=[];
    for(const uid of Object.keys(profiles.members)){
      try { count+=migrateProfiles(temporaryContext(ctx,uid,''),ctx,readGroupProfiles(ctx)); }
      catch(e){ conflicts.push(String(e.message||e)); }
    }
    reply(ctx,msg,'营地档案已统一到本群。已迁入 '+count+' 份私聊档案。'+
      (conflicts.length?'\n待检查：'+conflicts.join('\n'):''));
  });

  registerCommand('营地名单','查看当前营地全部角色',(ctx,msg)=>{
    const p=loadGroupProfiles(ctx),rows=[];
    const showAccounts = sourceGroupKey(ctx) === groupKey(ctx);
    for(const [uid,list] of Object.entries(p.members))for(const r of list)rows.push(r.id+'｜'+r.name+'｜'+(r.role||'学员')+(showAccounts?'｜'+uid:''));
    rows.sort((a,b)=>Number(a.slice(0,3))-Number(b.slice(0,3)));
    reply(ctx,msg,'🏕️【营地名单】\n'+(rows.length?rows.join('\n'):'暂无注册角色'));
  });
  registerCommand('我的档案','查看本营地自己的角色',(ctx,msg)=>{
    const p=loadGroupProfiles(ctx),uid=getPlayerId(ctx),list=p.members[uid]||[];
    reply(ctx,msg,'📋【我的营地档案】\n'+(list.length?list.map(x=>x.id+'｜'+x.name+'｜'+(x.role||'学员')+(p.active[uid]===x.id?'（当前）':'')).join('\n'):'尚未注册'));
  });
  function changeCampRole(ctx,msg,args,reset){
    if(!mayManageCamp(ctx)){reply(ctx,msg,'仅群管理员、群主或骰主可以任命或解除职务。');return;}
    const raw=String(args.getArgN(1)||'').trim();
    if(!/^\d+$/.test(raw)){reply(ctx,msg,'请提供纯数字档案编号，例如：.任命 002 教官');return;}
    const id=raw.padStart(3,'0'),role=reset?'学员':String(args.getArgN(2)||'').trim();
    if(!['学员','教官','教师'].includes(role)||(role==='学员'&&!reset)){
      reply(ctx,msg,'可任命的职务为：教官、教师。恢复学员请使用 .解除任命 编号');return;
    }
    const p=loadGroupProfiles(ctx),matches=[];
    for(const [uid,list] of Object.entries(p.members))for(const r of list)if(r.id===id)matches.push({uid,r});
    if(matches.length!==1){reply(ctx,msg,'未找到唯一的档案编号：'+id);return;}
    const target=matches[0].r,old=target.role||'学员';
    target.role=role;saveGroupProfiles(ctx,p);
    reply(ctx,msg,(reset?'已解除职务':'任命成功')+'：'+target.name+'（'+id+'）\n'+old+' → '+role+'\n角色编号、背包及属性保持不变。');
  }
  registerCommand('任命','管理员任命：.任命 002 教官/教师',(ctx,msg,args)=>changeCampRole(ctx,msg,args,false));
  registerCommand('解除任命','管理员解除任命：.解除任命 002',(ctx,msg,args)=>changeCampRole(ctx,msg,args,true));
  registerCommand('切换','切换角色：.切换 001',(ctx,msg,args)=>{
    const id=String(args.getArgN(1)||'').trim().replace(/^h/i,'').padStart(3,'0');
    const r=selectRole(ctx,id);
    reply(ctx,msg,r?'已切换至：'+r.name+'（'+r.id+'）':'未找到你拥有的角色编号：'+id);
  });
  const pendingDeletes={};
  function deleteRequest(ctx,msg,selector,args){
    const p=loadGroupProfiles(ctx),self=getPlayerId(ctx),at=String(args && args.getArgN(2)||'');
    let owner=self;
    if(at.startsWith('@')){
      if(!mayManageCamp(ctx)){reply(ctx,msg,'只有管理员可以删除他人的角色。');return;}
      const target=seal.getCtxProxyFirst(ctx,args);
      if(!target||!target.player||!target.player.userId){reply(ctx,msg,'无法识别目标玩家。');return;}
      owner=String(target.player.userId);
    }
    const normalized=/^\d+$/.test(selector)?selector.padStart(3,'0'):selector;
    const matches=(p.members[owner]||[]).filter(r=>r.id===normalized || r.name===selector);
    if(matches.length!==1){reply(ctx,msg,matches.length?'存在同名角色，请使用编号删除。':'未找到符合条件的角色。');return;}
    const r=matches[0],key=groupKey(ctx)+'::'+self;
    pendingDeletes[key]={owner,id:r.id,expires:Date.now()+120000};
    reply(ctx,msg,'⚠️ 将删除「'+r.name+'」（'+r.id+'）。请在两分钟内发送：.确认删除'+r.id);
  }
  function compactDeleteArg(msg,verb){
    const text=String(msg&&msg.message||'').trim();
    const prefix='^[.。，]'+verb+'\\s*';
    const m=text.match(new RegExp(prefix+'([^\\s]+)\\s*$'));
    return m?m[1]:'';
  }
  function confirmDelete(ctx,msg,raw){
    if(!/^\d+$/.test(raw)){reply(ctx,msg,'格式：.确认删除000 或 .确认删除 000');return;}
    const id=raw.padStart(3,'0'),key=groupKey(ctx)+'::'+getPlayerId(ctx),pending=pendingDeletes[key];
    if(!pending||pending.id!==id||pending.expires<Date.now()){reply(ctx,msg,'没有待确认的删除请求，或已过期。');return;}
    const p=loadGroupProfiles(ctx),r=(p.members[pending.owner]||[]).find(x=>x.id===id);
    if(!r){delete pendingDeletes[key];reply(ctx,msg,'角色已不存在。');return;}
    if(pending.owner!==getPlayerId(ctx)&&!mayManageCamp(ctx)){reply(ctx,msg,'权限不足。');return;}
    deleteRole(ctx,pending.owner,r);delete pendingDeletes[key];
    reply(ctx,msg,'已删除角色：'+r.name+'（'+r.id+'）。');
  }
  registerCommand('删除','删除角色：.删除000 或 .删除 000',(ctx,msg,args)=>{
    const selector=String(args.getArgN(1)||'').trim()||compactDeleteArg(msg,'删除');
    if(!selector){reply(ctx,msg,'格式：.删除000 或 .删除 角色名');return;}
    deleteRequest(ctx,msg,selector,args);
  });
  registerCommand('确认删除','确认删除：.确认删除000 或 .确认删除 000',(ctx,msg,args)=>{
    const raw=String(args.getArgN(1)||'').trim()||compactDeleteArg(msg,'确认删除');
    confirmDelete(ctx,msg,raw);
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


  // 独立的营地发放入口，避免旧插件占用 .发放 时无法排查。
  function grantCampItem(ctx,msg,args){
    if(!mayManageCamp(ctx)){reply(ctx,msg,'只有管理员、群主或骰主可以发放物品。');return;}
    const raw=String(msg&&msg.message||'').trim();
    const body=raw.replace(/^[.。，]发放\s*/,'').trim();
    const tokens=body.split(/\s+/).filter(Boolean);
    const index=tokens.findIndex(x=>!!getCategoryKey(x));
    const usage='格式：。发放 004 其他 鸡蛋面糊煎饼 1\n或：。发放 @玩家 其他 鸡蛋面糊煎饼 1';
    if(index<1){reply(ctx,msg,usage);return;}
    const selector=tokens.slice(0,index).join(' ').trim();
    const category=getCategoryKey(tokens[index]);
    const tail=tokens.slice(index+1);
    const amount=tail.length&&/^\d+$/.test(tail[tail.length-1])?Number(tail.pop()):1;
    const itemName=tail.join(' ').trim();
    if(!itemName||!Number.isInteger(amount)||amount<1||amount>9999){reply(ctx,msg,usage);return;}
    const profiles=loadGroupProfiles(ctx),sender=getPlayerId(ctx);
    let owner='',role=null;
    if(/^\d{1,3}$/.test(selector)){
      const id=selector.padStart(3,'0');
      const matches=[];
      for(const [uid,roles] of Object.entries(profiles.members)){
        for(const entry of roles)if(entry.id===id)matches.push({uid,entry});
      }
      if(matches.length!==1){reply(ctx,msg,matches.length?'编号重复，已取消发放。':'当前群没有 '+id+' 号角色，请用 .营地名单 核对。');return;}
      owner=matches[0].uid;role=matches[0].entry;
    }else if(selector.includes('@')){
      let proxy=null;
      if(typeof seal.getCtxProxyFirst==='function'){try{proxy=seal.getCtxProxyFirst(ctx,args)}catch(e){}}
      const target=proxy&&proxy.player?getPlayerId(proxy):'';
      if(!target||target===sender){reply(ctx,msg,'无法可靠识别 @ 的收件人，已取消发放。请改用群内三位角色编号。');return;}
      owner=target;
      const roles=profiles.members[owner]||[];
      role=roles.find(x=>x.id===profiles.active[owner])||null;
      if(!role){reply(ctx,msg,'被@玩家尚未在本群注册角色。');return;}
    }else{reply(ctx,msg,usage);return;}
    const id=String(role.id).padStart(3,'0'),key=owner+'::'+id;
    // 目标编号可以是自己的非当前角色，不能写入当前角色背包。
    if(owner===sender&&currentRole(ctx)&&currentRole(ctx).id===id){
      const data=loadData(ctx),count=addItem(data,category,itemName,amount,'');
      saveData(ctx,data);
      reply(ctx,msg,'🎁【发放】\n收件角色：'+role.name+' '+id+'\n物品：'+itemName+' ×'+amount+'\n已入账，当前持有：'+count+' 件');return;
    }
    // 统一写入群队列；收件人使用自己的角色背包时领取，不使用发送者的个人存档。
    const camp=groupContext(ctx),queue=jsonRead(camp,CAMP_QUEUE,{});
    if(!Array.isArray(queue[key]))queue[key]=[];
    queue[key].push({category,itemName,amount});
    jsonWrite(camp,CAMP_QUEUE,queue);
    reply(ctx,msg,'🎁【发放】\n收件角色：'+role.name+' '+id+'\n物品：'+itemName+' ×'+amount+'\n已登记，对方使用 .背包 后入账。');
  }
  registerCommand('发放','管理员发放：。发放 004 其他 鸡蛋面糊煎饼 1',grantCampItem);

  function lifeTarget(ctx, msg, command) {
    if (!mayManageCamp(ctx)) throw Error('只有营地管理员、主群群主或骰主可以使用该指令。');
    const input = String(msg.message || '').replace(new RegExp('^\\s*[.。，]?' + command + '\\s*'), '').trim();
    const profiles = loadGroupProfiles(ctx);
    const mention = /^\[CQ:at,qq=(\d+)\]$/.exec(input);
    if (mention) {
      const owner = 'QQ:' + mention[1];
      const role = (profiles.members[owner] || []).find(entry => entry.id === profiles.active[owner]);
      if (!role) throw Error('被@的玩家没有当前营地角色。');
      return { owner, role };
    }
    if (!input || input.startsWith('@') || input.includes('[CQ:at,')) {
      throw Error('格式：。' + command + ' 角色名 / 编号 / @玩家（只选一个目标）');
    }
    const matches = [];
    for (const [owner, roles] of Object.entries(profiles.members)) {
      for (const role of roles) {
        if (/^\d+$/.test(input) ? role.id === input.padStart(3, '0') : role.name === input) {
          matches.push({ owner, role });
        }
      }
    }
    if (!matches.length) throw Error('未找到该角色。');
    if (matches.length > 1) throw Error('存在同名或同编号角色，请核对：' +
      matches.map(entry => entry.role.name + ' ' + entry.role.id).join('、') + '。');
    return matches[0];
  }

  function manageLife(ctx, msg, command) {
    const { owner, role } = lifeTarget(ctx, msg, command);
    const target = owner === getPlayerId(ctx) ? ctx : temporaryContext(ctx, owner, sourceGroupKey(ctx) === 'private' ? '' : sourceGroupKey(ctx));
    const data = loadData(target, role, null, false);
    let notice;
    if (command === '复活') {
      if (data.hp > 0) throw Error(role.name + '仍可行动。');
      const wasDead = data.dead;
      if (wasDead) data.falls = 0;
      data.dead = false;
      data.hp = data.maxHp;
      data.hunger = 1;
      data.hungerUpdatedAt = Date.now();
      notice = wasDead ? role.name + '重生了，这一世' + role.name + '要夺回属于' + role.name + '的一切'
        : '一个' + role.name + '倒下了，千千万万个' + role.name + '站起来了。';
    } else {
      if (data.dead) throw Error(role.name + '已结束旅程。');
      if (command === '死刑') {
        data.hp = 0;
        data.dead = true;
        notice = '你被无形的手处死了。\n' + deathAnnouncement(role.name);
      } else {
        if (data.hp === 0) throw Error(role.name + '已经倒下了。');
        notice = changeHp(data, -data.hp, role.name, 'drain');
      }
    }
    saveData(target, data, role);
    reply(ctx, msg, notice);
  }

  for (const command of ['死刑', '复活', '汲取']) {
    registerCommand(command, '管理员指令：。' + command + ' 角色名 / 编号 / @玩家',
      (ctx, msg) => manageLife(ctx, msg, command));
  }

  registerCommand('重置所有背包', '重置自己的全部背包物品与 HP：.重置所有背包 确认', (ctx, msg, args) => {
    const confirm = String(args.getArgN(1) || '').trim();
    if (confirm !== '确认') {
      reply(ctx, msg, '⚠️ 此操作会清空你在所有群共享的背包物品，并将 HP 恢复为 10。\n如确定重置，请输入：.重置所有背包 确认');
      return;
    }
    const data = loadData(ctx);
    const fresh = createDefaultData();
    data.items = fresh.items;
    data.hp = data.dead ? 0 : data.maxHp;
    saveData(ctx, data);
    reply(ctx, msg, '🧹 已重置你的全部背包：物品已清空，当前 HP：' + data.hp + ' / ' + data.maxHp + '。\n档案编号不会改变。');
  });

  registerCommand('状态', '查看生命值与饱腹值：.状态', (ctx, msg) => {
    const data = loadData(ctx);
    saveData(ctx, data);
    const hearts = '❤️'.repeat(Math.min(data.hp, 20)) +
      '🖤'.repeat(Math.min(Math.max(0, data.maxHp - data.hp), 20));
    reply(ctx, msg, '【' + getRegisteredName(ctx) + '的状态】\n' + hearts +
      '\n生命值：' + data.hp + ' / ' + data.maxHp +
      (Number(data.hunger) === 0 ? '\n【饥饿】' : '') +
      '\n饱腹值：' + (Number(data.hunger) || 0) + ' / 4' +
      '\n倒下次数：' + data.falls + ' / ' + FALL_LIMIT +
      (data.dead ? '\n【死亡】' : data.hp === 0 ? '\n【倒下】' : ''));
  });

  function campStatusLine(ctx, owner, role) {
    const target = owner === getPlayerId(ctx) ? ctx : temporaryContext(ctx, owner, sourceGroupKey(ctx) === 'private' ? '' : sourceGroupKey(ctx));
    const data = loadData(target, role, null, false);
    const life = data.dead ? '0👻' : data.hp === 0 ? '0🖤' : String(data.hp) + '❤️';
    return role.name + ' ' + String(role.id).padStart(3, '0') + '：' + life + ' ｜ 饱腹 ' + String(Math.max(0, Number(data.hunger) || 0)) + ' ｜ 百折不挠' + data.falls + '/' + FALL_LIMIT;
  }

  registerCommand('营地状态', '管理员查看全营地状态：.营地状态 [姓名或编号]', (ctx, msg) => {
    if (!mayManageCamp(ctx)) throw Error('只有营地管理员、主群群主或骰主可以使用该指令。');
    const input = String(msg.message || '').replace(/^\s*[.。，]?营地状态\s*/, '').trim();
    const profiles = loadGroupProfiles(ctx);
    if (input) {
      const { owner, role } = lifeTarget(ctx, msg, '营地状态');
      const target = owner === getPlayerId(ctx) ? ctx : temporaryContext(ctx, owner, sourceGroupKey(ctx) === 'private' ? '' : sourceGroupKey(ctx));
      const data = loadData(target, role, null, false);
      const hearts = data.dead ? '0👻' : data.hp === 0 ? '0🖤' : String(data.hp) + '❤️';
      reply(ctx, msg, '【' + role.name + ' ' + String(role.id).padStart(3, '0') + '的状态】\n' + hearts +
        '\n生命值：' + data.hp + ' / ' + data.maxHp +
        (Number(data.hunger) === 0 ? '\n【饥饿】' : '') +
        '\n饱腹值：' + String(Math.max(0, Number(data.hunger) || 0)) +
        '\n百折不挠：' + data.falls + '/' + FALL_LIMIT +
        (data.dead ? '\n【死亡】' : data.hp === 0 ? '\n【倒下】' : ''));
      return;
    }
    const rows = [];
    for (const [owner, roles] of Object.entries(profiles.members || {})) {
      for (const role of roles || []) rows.push(campStatusLine(ctx, owner, role));
    }
    reply(ctx, msg, '🏕️【营地状态】\n' + (rows.length ? rows.join('\n') : '暂无已注册角色。'));
  });


  // 批量管理使用各角色自己的持久化存档，不改变档案编号和点名记录。
  function allCampRoles(ctx) {
    const profiles = loadGroupProfiles(ctx), result = [];
    for (const [owner, roles] of Object.entries(profiles.members || {})) {
      for (const role of (Array.isArray(roles) ? roles : [])) {
        result.push({owner, role, ctx: owner === getPlayerId(ctx) ? ctx :
          temporaryContext(ctx, owner, sourceGroupKey(ctx) === 'private' ? '' : sourceGroupKey(ctx))});
      }
    }
    return result;
  }

  function resetCamp(ctx, msg, args, kind) {
    if (!mayManageCamp(ctx)) throw Error('仅营地管理员、主群群主或骰主可操作。');
    if (String(args.getArgN(1) || '').trim() !== '确认') {
      reply(ctx, msg, '⚠️ 即将' + (kind === 'life' ? '恢复全营角色生命与饱腹，并清零倒下次数' : '永久清空全营所有角色背包物品') +
        '。档案编号和点名记录不会删除。\n请再次输入：。营地' + (kind === 'life' ? '状态重置' : '背包重置') + ' 确认');
      return;
    }
    const roles = allCampRoles(ctx);
    // 先读取并验证所有存档，再逐个写回；存档损坏时不会开始清理。
    const updates = roles.map(entry => {
      const data = loadData(entry.ctx, entry.role, null, false);
      return {entry, data};
    });
    const now = Date.now();
    for (const {entry, data} of updates) {
      if (kind === 'life') {
        data.hp = data.maxHp;
        data.hunger = 4;
        data.falls = 0;
        data.dead = false;
        data.hungerUpdatedAt = now;
        data.pendingNotices = [];
      } else {
        data.items = createDefaultData().items;
      }
      saveData(entry.ctx, data, entry.role);
    }
    reply(ctx, msg, '🏕️ 已完成营地' + (kind === 'life' ? '状态' : '背包') + '重置。\n处理角色：' + updates.length + ' 人。');
  }
  registerCommand('营地状态重置', '管理员重置所有角色生命状态：。营地状态重置 确认',
    (ctx,msg,args) => resetCamp(ctx,msg,args,'life'));
  registerCommand('营地背包重置', '管理员清空所有角色物品：。营地背包重置 确认',
    (ctx,msg,args) => resetCamp(ctx,msg,args,'bag'));

  function beijingDay(timestamp) {
    const d = new Date(timestamp + 8 * 3600000);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') +
      '-' + String(d.getUTCDate()).padStart(2,'0');
  }
  function reportMidnight(ctx, msg, force = false) {
    if (sourceGroupKey(ctx) === 'private') return;
    const group = groupContext(ctx);
    // 主群统一播报；防止多个群重复发送同一份全营统计。
    if (sourceGroupKey(ctx) !== groupKey(ctx)) return;
    const today = beijingDay(Date.now());
    const record = jsonRead(group, DAILY_REPORT, {date: '', pending: null});
    if (force || record.date !== today) {
      const roles = allCampRoles(ctx);
      let fallen = 0, dead = 0;
      for (const entry of roles) {
        // 把离线期间的饥饿消耗补算到当天，通知保存在角色自己的待发送队列。
        const data = loadData(entry.ctx, entry.role, null, true);
        if (data.dead) dead++;
        else if (data.hp <= 0) fallen++;
      }
      record.date = today;
      record.pending = (fallen || dead) ?
        '本日播报📯：\n当前无法行动人数：' + fallen + '人，\n本日死亡人数：' + dead + '人' :
        '⛺新的一天📯';
      jsonWrite(group, DAILY_REPORT, record);
    }
    if (record.pending) {
      reply(ctx, msg, record.pending);
      record.pending = null;
      jsonWrite(group, DAILY_REPORT, record);
    }
  }

  registerCommand('营地播报', '管理员手动查看并测试每日营地播报：。营地播报', (ctx,msg) => {
    if (!mayManageCamp(ctx)) throw Error('只有营地管理员、主群群主或骰主可以使用该指令。');
    if (sourceGroupKey(ctx) !== groupKey(ctx)) throw Error('请在营地主群使用本指令。');
    reportMidnight(ctx,msg,true);
  });

  function replayCampNotices(ctx, msg) {
    if (sourceGroupKey(ctx) === 'private' || sourceGroupKey(ctx) !== groupKey(ctx)) return;
    for (const entry of allCampRoles(ctx)) {
      const data = loadData(entry.ctx, entry.role, null, true);
      if (!data.pendingNotices || !data.pendingNotices.length) continue;
      // 先保存生命状态，再尝试发送。发送异常时保留未发送的通知供下次重试。
      while (data.pendingNotices.length) {
        reply(ctx, msg, data.pendingNotices[0]);
        data.pendingNotices.shift();
        saveData(entry.ctx, data, entry.role);
      }
    }
  }

  // 营地菜单中的食物即使由管理员以普通物品发放，也可正常食用。
  const CAMP_BREAKFAST_NAMES = new Set(['薄煎饼','燕麦粥','荞麦粥','三明治','鸡蛋面糊煎饼','牛肉蔬菜面','一盘杂粮','面','南瓜松饼','鸡蛋全家','滑蛋贝果']);
  registerCommand('食用', '食用背包中的食物：.食用 食物名称（营地早餐可省略前缀）', (ctx, msg, args) => {
    const requested = String(args.getArgN(1) || '').trim();
    if (!requested) {
      reply(ctx, msg, '请指定要食用的物品，例如：.食用 燕麦粥');
      return;
    }
    const data = loadData(ctx);
    if (data.dead) {
      reply(ctx, msg, '该角色已结束旅程，须由营地管理员复活。');
      return;
    }
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
    const isBreakfast = Boolean(item.campBreakfast) || CAMP_BREAKFAST_NAMES.has(foundName.replace(/^营地早餐：/, ''));
    if (!effect && !isBreakfast && !Number.isFinite(Number(item.hungerRestore))) {
      reply(ctx, msg, '目前没有为「' + requested + '」设置食用效果，暂时不能食用。');
      return;
    }
    const oldHp = data.hp;
    const oldHunger = Number(data.hunger) || 0;
    removeItem(data, foundCategory, foundName, 1);
    let notice = '';
    if (effect) {
      notice = changeHp(data, Number(effect.hp || 0), getRegisteredName(ctx));
    } else {
      data.hp = Math.max(0, Math.min(data.maxHp, data.hp + (Number(item.hpRestore) || 1)));
      data.hunger = Math.min(4, Math.max(0, oldHunger + (Number(item.hungerRestore) || (isBreakfast ? 3 : 0))));
    }
    saveData(ctx, data);
    if (effect) {
      reply(ctx, msg, '☠️ 你食用了「' + foundName + '」。\n' + effect.description +
        '\nHP：' + oldHp + ' → ' + data.hp + ' / ' + data.maxHp + (notice ? '\n' + notice : ''));
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