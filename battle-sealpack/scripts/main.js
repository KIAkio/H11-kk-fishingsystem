// ==UserScript==
// @name 圣布里吉冬训营战斗系统
// @author KIAkio
// @version 0.2.5
// @description QQ 小队群回合制战斗，支持私聊提交行动
// ==/UserScript==
(function () {
  'use strict';

  const EXT = 'winter_camp_battle';
  const DATA = 'battle:v1';
  const DEFAULT_STATS = { speed: 50, agility: 50, insight: 50, attack: 55, defense: 30 };
  const FIELDS = Object.keys(DEFAULT_STATS);
  const LABELS = ['速度', '灵敏', '洞察', '攻击', '防御'];
  const ARMOR_CAP = 8;
  const INPUT = '。录入 速度60，灵敏65，洞察50，攻击70，防御40';
  const ACTIONS = { attack: '攻击', block: '格挡', dodge: '闪避' };
  const HELP = [
    '❄️【圣布里吉 · 战斗指令】',
    '带队：。战斗 开队 → 队员各发 。战斗 加入 → 。战斗 开始',
    '攻击：。攻击 或 。攻击 直击，立即掷骰；。攻击 求助，等待队友喊话',
    '解析：。战斗 解析 或 。攻击 解析 → 。战斗 自析 或 。战斗 求助',
    '遇袭：。格挡 或 。闪避，尾加「求助」可等待喊话',
    '队友：。喊话 行动码；无人喊话时由当事人或带队发 。结算 行动码',
    '当前战况：。战斗 或 。战斗 状态；完整指令：。战斗 帮助',
    '其他：。跳过 / 。治疗 角色名或编号；带队可发 。收队',
    INPUT + '（在小窗可录入当前角色）',
    '查看属性：。战斗 档案 ｜ 装备：。战斗 穿戴 装备名 / 脱下 装备名',
    '独立指令：。投掷 物品名（灵敏检定，成功造成 2 点伤害）',
    '加入、开队和开始须在队群发送。'
  ].join('\n');

  if (seal.ext.find(EXT)) return;
  const ext = seal.ext.new(EXT, 'KIAkio', '0.2.5');

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function check(condition, message) {
    if (!condition) throw new Error(message);
  }

  function load() {
    const raw = ext.storageGet(DATA);
    const data = raw ? JSON.parse(raw) : { rooms: {}, nextAction: 1 };
    check(data && data.rooms && Number.isSafeInteger(data.nextAction), '战斗存档无法读取。');
    if (!data.characters) data.characters = {};
    if (!data.armorCatalog) data.armorCatalog = {};
    for (const room of Object.values(data.rooms)) {
      if (room.rules === 2) continue;
      for (const player of room.players) {
        for (const field of FIELDS) player.stats[field] = Math.min(100, (player.stats[field] || 0) * 10);
        player.armor = Math.min(ARMOR_CAP, player.armor);
        player.maxArmor = player.armor;
      }
      if (room.enemy) {
        room.enemy.speed = Math.min(100, room.enemy.speed * 10);
        room.enemy.attack = Math.min(100, room.enemy.attack * 10);
        room.enemy.defense = Math.min(100, room.enemy.defense * 10);
        room.enemy.armor = Math.min(ARMOR_CAP, room.enemy.armor);
        room.enemy.maxArmor = room.enemy.armor;
      }
      room.rules = 2;
    }
    return data;
  }

  function uid(ctx) {
    return String(ctx.player && (ctx.player.userId || ctx.player.id) || '');
  }

  function groupId(ctx) {
    return String(ctx.group && (ctx.group.groupId || ctx.group.id) || '');
  }

  function playerName(player) {
    return player.name + ' ' + player.id;
  }

  function activePlayer(room) {
    return room.players.find(player => player.uid === room.order[room.turn]);
  }

  function number(value, minimum, maximum) {
    check(/^\d+$/.test(value), '数值须为整数。');
    const parsed = Number(value);
    check(parsed >= minimum && parsed <= maximum, '数值范围为 ' + minimum + '～' + maximum + '。');
    return parsed;
  }

  function character(ctx, characterId) {
    const profiles = globalThis.H11CampProfiles;
    check(profiles, '请先启用地精背包核心 1.8.5 或更新版本。');
    const id = uid(ctx);
    const registry = profiles.read(ctx);
    if (characterId) check(/^\d+$/.test(characterId), '角色编号须为数字。');
    const wanted = characterId ? characterId.padStart(3, '0') : registry.active[id];
    const profile = (registry.members[id] || []).find(entry => entry.id === wanted);
    check(profile, '未找到你名下的该营地角色。请先注册或核对编号。');
    const roleKey = profiles.groupKey(ctx) + '::' + profile.id;
    const result = seal.vars.strGet(ctx, '$mH11角色数据仓库');
    const store = result[0] ? JSON.parse(result[0]) : {};
    return { profile, key: id + '::' + roleKey, bag: store[roleKey] || {} };
  }

  function record(data, identity) {
    if (!data.characters[identity.key]) {
      data.characters[identity.key] = { stats: Object.assign({}, DEFAULT_STATS), gear: [] };
    }
    return data.characters[identity.key];
  }

  function armorCapacity(data, identity, saved) {
    const equipment = identity.bag.items && identity.bag.items.equipment || {};
    return Math.min(ARMOR_CAP, saved.gear.reduce((sum, name) =>
      sum + (hasOwn(equipment, name) && equipment[name].count > 0 && hasOwn(data.armorCatalog, name)
        ? data.armorCatalog[name] : 0), 0));
  }

  function statsText(stats) {
    return FIELDS.map((field, index) => LABELS[index] + stats[field]).join('，');
  }

  function parseStats(text) {
    const stats = {};
    for (const part of text.split(/[，,]/)) {
      const match = /^\s*(速度|灵敏|洞察|攻击|防御)\s*(\d{1,3})\s*[%％]?\s*$/.exec(part);
      check(match, '格式示例：' + INPUT);
      const field = FIELDS[LABELS.indexOf(match[1])];
      check(!hasOwn(stats, field), '「' + match[1] + '」重复录入。');
      stats[field] = number(match[2], 0, 100);
    }
    check(Object.keys(stats).length === FIELDS.length, '请一次填写五项属性。' + INPUT);
    return stats;
  }

  function editCharacter(data, ctx, cmd, words) {
    if (cmd === '护甲装备') {
      check(ctx.privilegeLevel >= 100, '请由骰主登记装备护甲。');
      const value = number(words.shift(), 0, ARMOR_CAP);
      const name = words.join(' ').trim();
      check(name && !['__proto__', 'constructor', 'prototype'].includes(name), '格式：。战斗 护甲装备 3 防寒背心');
      data.armorCatalog[name] = value;
      return { data, text: name + ' 的护甲值已登记为 ' + value + '。' };
    }

    const identity = character(ctx);
    const saved = record(data, identity);
    if (cmd === '录入') saved.stats = parseStats(words.join(' '));
    if (cmd === '穿戴' || cmd === '脱下') {
      const name = words.join(' ').trim();
      const equipment = identity.bag.items && identity.bag.items.equipment || {};
      if (cmd === '穿戴') {
        check(hasOwn(data.armorCatalog, name) && data.armorCatalog[name] > 0, '这件装备尚未登记护甲值。');
        check(hasOwn(equipment, name) && equipment[name].count > 0, '当前角色的训练装备中没有这件物品。');
        check(!saved.gear.includes(name), '这件装备已经穿戴。');
        saved.gear.push(name);
      } else {
        check(saved.gear.includes(name), '当前角色没有穿戴这件装备。');
        saved.gear = saved.gear.filter(item => item !== name);
      }
    }

    const maxHp = identity.bag.maxHp == null ? 10 : identity.bag.maxHp;
    const hp = identity.bag.hp == null ? maxHp : identity.bag.hp;
    const maxArmor = armorCapacity(data, identity, saved);
    return {
      data: cmd === '档案' ? null : data,
      text: '📋 ' + identity.profile.name + ' ' + identity.profile.id + '\n' + statsText(saved.stats) +
        '\n营地 HP ' + hp + '/' + maxHp + ' ｜ 装备护甲上限 ' + maxArmor + '/' + ARMOR_CAP +
        (saved.gear.length ? '\n穿戴：' + saved.gear.join('、') : '') +
        (cmd === '档案' ? '' : '\n已保存，将在下一场遭遇生效。')
    };
  }

  function makePlayer(data, ctx, characterId) {
    const identity = character(ctx, characterId);
    const saved = record(data, identity);
    const bag = identity.bag;
    const maxHp = Number(bag.maxHp == null ? 10 : bag.maxHp);
    const hp = Number(bag.hp == null ? maxHp : bag.hp);
    check(Number.isSafeInteger(maxHp) && maxHp > 0 && Number.isSafeInteger(hp), '营地角色血量无法读取。');
    check(hp > 0, '该角色当前 HP 为 0，请先在营地恢复。');
    const maxArmor = armorCapacity(data, identity, saved);
    return {
      uid: uid(ctx), id: identity.profile.id, name: identity.profile.name || '营地角色',
      hp: Math.min(hp, maxHp), maxHp, armor: maxArmor, maxArmor,
      stats: Object.assign({}, saved.stats, { calls: 1, cooldown: 1 }),
      spentCalls: 0, lastCall: 0, nextCall: 1, healUsed: false
    };
  }

  function refreshPlayer(data, ctx, room, player) {
    const msg = seal.newMessage();
    msg.messageType = 'group';
    msg.platform = ctx.endPoint.platform;
    msg.groupId = room.groupId;
    msg.sender.userId = player.uid;
    const target = seal.createTempCtx(ctx.endPoint, msg);
    check(target && groupId(target) === room.groupId && uid(target) === player.uid, '无法读取队员 ' + player.id + ' 的档案。');
    const identity = character(target, player.id);
    const saved = data.characters[identity.key];
    if (saved) {
      player.stats = Object.assign({}, saved.stats, { calls: player.stats.calls, cooldown: player.stats.cooldown });
    }
    const capacity = armorCapacity(data, identity, saved || { gear: [] });
    player.armor = Math.max(0, player.armor + capacity - player.maxArmor);
    player.maxArmor = capacity;
  }

  function encounter(args) {
    if (!args.length) return { name: '冰狼', hp: 16, armor: 2, maxArmor: 2, speed: 40, attack: 55, defense: 20, maxHp: 16 };
    check(args.length === 6, '格式：。战斗 开始 怪名 HP 护甲 速度 攻击 防御');
    const hp = number(args[1], 1, 999);
    const armor = number(args[2], 0, ARMOR_CAP);
    return {
      name: args[0], hp, maxHp: hp, armor, maxArmor: armor,
      speed: number(args[3], 0, 100), attack: number(args[4], 0, 100), defense: number(args[5], 0, 100)
    };
  }

  function meters(target) {
    const filled = Math.ceil(6 * target.hp / target.maxHp);
    return 'HP ' + '■'.repeat(filled) + '□'.repeat(6 - filled) + ' ' + target.hp + '/' + target.maxHp +
      (target.armor > 0 ? ' ｜ 护甲 ' + target.armor + '/' + target.maxArmor : '');
  }

  function battlePrompt(room) {
    const pending = room.pending;
    if (!pending) {
      return '⚔️【等待进攻】' + playerName(activePlayer(room)) + ' 可以攻击\n。攻击 ｜ 。跳过';
    }
    const target = playerName(room.players.find(player => player.uid === pending.target));
    if (pending.kind === 'defense') {
      return room.enemy.name + '向' + target + '发起了攻击\n。闪避 ｜ 。格挡';
    }
    return '📣【等待喊话】' + target + ' 请求协助' + ACTIONS[pending.kind] +
      '\n队友 。喊话 ' + pending.code + ' ｜ 当事人或带队 。结算 ' + pending.code;
  }

  function status(room, event = '') {
    if (room.phase === 'lobby') {
      return (event ? event + '\n' : '') + '🏕️【小队集结】\n' +
        (room.players.map(playerName).join('、') || '等待队员加入') +
        '\n。战斗 加入 [角色编号]';
    }
    const header = { battle: '第 ' + room.round + ' 轮', rest: '整备', defeat: '小队倒下' }[room.phase];
    const pending = room.pending;
    const current = room.phase !== 'battle' ? null : pending ? pending.target : room.order[room.turn];
    const currentMark = !pending ? '⚔️ ' : pending.kind === 'defense' ? '🛡️ ' : '📣 ';
    const order = room.order.map(key => {
      const target = key === 'enemy' ? room.enemy : room.players.find(player => player.uid === key);
      const name = key === 'enemy' ? target.name : playerName(target);
      const mark = current === key ? currentMark : target.hp === 0 ? '× ' : '· ';
      return mark + name + ' ｜ ' + meters(target);
    });
    const lines = ['❄️【' + header + '】'];
    if (room.phase === 'battle') lines.push(battlePrompt(room));
    if (event) lines.push(event);
    if (room.phase === 'rest') lines.push('可发送「。治疗 角色名或编号」，由带队开启下一场。');
    return lines.concat(order).join('\n');
  }

  function roll() {
    return 1 + Math.floor(Math.random() * 100);
  }

  function damage(target, amount) {
    const armor = Math.min(target.armor, amount);
    const hp = Math.min(target.hp, amount - armor);
    target.armor -= armor;
    target.hp -= hp;
    return '护甲 -' + armor + '，HP -' + hp;
  }

  function advance(room, increment) {
    room.pending = null;
    if (room.enemy.hp <= 0) {
      room.phase = 'rest';
      for (const player of room.players) player.healUsed = false;
      return;
    }
    if (room.players.every(player => player.hp === 0)) {
      room.phase = 'defeat';
      return;
    }
    if (increment) room.turn++;
    while (true) {
      if (room.turn >= room.order.length) {
        room.turn = 0;
        room.round++;
      }
      if (room.order[room.turn] === 'enemy') {
        const targets = room.players.filter(player => player.hp > 0);
        const target = targets[Math.floor(Math.random() * targets.length)];
        room.pending = { kind: 'defense', target: target.uid };
        return;
      }
      if (activePlayer(room).hp > 0) return;
      room.turn++;
    }
  }

  function chance(value) {
    return Math.max(0, Math.min(100, value));
  }

  function strikeDamage(attacker, defender, reduction) {
    const force = 2 + Math.floor(attacker.attack / 20);
    return Math.max(0, force - Math.floor(defender.defense / 20) - reduction);
  }

  function settle(room, kind, player, helper, selfAnalysis) {
    let bonus = 0;
    const lines = [];
    if (helper || selfAnalysis) {
      const analyst = helper || player;
      const dice = roll();
      const success = dice <= analyst.stats.insight;
      bonus = success ? 10 : 0;
      lines.push(playerName(analyst) + (helper ? ' 向 ' + playerName(player) + ' 喊话' : ' 自行解析破绽') +
        ' ｜ 洞察 ' + dice + '/' + analyst.stats.insight + ' ' + (success ? '成功' : '失败'));
    }

    const enemy = room.enemy;
    const stats = player.stats;
    if (kind === 'attack') {
      const dice = roll();
      const threshold = chance(stats.attack + bonus);
      lines.push(playerName(player) + ' 攻击 ' + enemy.name + ' ｜ 命中 ' + dice + '/' + threshold + ' ｜ ' +
        (dice <= threshold ? damage(enemy, strikeDamage(stats, enemy, 0)) : '未命中'));
    } else {
      let threshold = enemy.attack;
      let reduction = 0;
      let detail = '';
      if (kind === 'block') reduction = 2 + (bonus ? 1 : 0);
      else {
        const agility = roll();
        const success = agility <= chance(stats.agility + bonus);
        if (success) threshold = chance(threshold - 20);
        detail = ' ｜ 灵敏 ' + agility + '/' + chance(stats.agility + bonus) + ' ' + (success ? '成功' : '失败');
      }
      const dice = roll();
      lines.push(playerName(player) + ' ' + ACTIONS[kind] + detail + ' ｜ ' + enemy.name +
        ' 命中 ' + dice + '/' + threshold + ' ｜ ' +
        (dice <= threshold ? damage(player, strikeDamage(enemy, stats, reduction)) : '未命中'));
    }
    advance(room, true);
    return lines.join('\n');
  }

  function queueAction(data, room, kind, player) {
    room.pending = { kind, target: player.uid, code: String(data.nextAction++) };
  }

  function leader(ctx, room) {
    return ctx.privilegeLevel >= 100 || uid(ctx) === room.host;
  }

  function start(room, enemy) {
    room.enemy = enemy;
    room.phase = 'battle';
    room.order = room.players.map(player => ({ key: player.uid, speed: player.stats.speed }))
      .concat([{ key: 'enemy', speed: enemy.speed }])
      .sort((first, second) => second.speed - first.speed)
      .map(entry => entry.key);
    room.round = 1;
    room.turn = 0;
    for (const player of room.players) {
      player.spentCalls = 0;
      player.lastCall = 0;
      player.nextCall = 1;
    }
    advance(room, false);
  }

  const management = ['喊话设置', '开始', '收队', '移除'];
  const actions = ['攻击', '解析', '自析', '求助', '格挡', '闪避', '喊话', '结算', '跳过', '投掷'];

  function run(ctx, msg, commandName, words) {
    const cmd = words.shift();
    const inGroup = msg.messageType === 'group';
    const id = uid(ctx);
    const group = groupId(ctx);
    const endpoint = ctx.endPoint;
    check(id.startsWith('QQ:') && endpoint && endpoint.userId &&
      (!inGroup || group.startsWith('QQ-Group:')), '请在 QQ 群或 QQ 小窗使用。');

    if (cmd === '帮助') return { text: HELP };
    if (commandName === '战斗') {
      if (cmd === '攻击' || cmd === '直接') return { text: '请发送「。攻击」发起攻击。' };
      if (cmd === '喊话' || cmd === '结算') return { text: '请发送「。' + cmd + ' 行动码」。' };
    }
    const data = load();
    if (['录入', '档案', '护甲装备', '穿戴', '脱下'].includes(cmd)) {
      return editCharacter(data, ctx, cmd, words);
    }
    const prefix = endpoint.userId + '|';
    const key = prefix + group;
    const joined = Object.keys(data.rooms).find(roomKey => roomKey.startsWith(prefix) &&
      data.rooms[roomKey].players.some(player => player.uid === id));
    let room = inGroup ? data.rooms[key] : joined ? data.rooms[joined] : null;
    if (!cmd) return { text: room ? status(room) : HELP };
    if (cmd === '开队') {
      check(inGroup && ctx.privilegeLevel >= 50, '请由队群管理员、群主或骰主开队。');
      check(!room, '本群已有小队，请先「。收队」。');
      room = { groupId: group, host: id, phase: 'lobby', players: [], rules: 2 };
      data.rooms[key] = room;
      return { data, text: status(room) };
    }
    check(room, inGroup ? '本群还没有小队。' : '你还没有加入小队，请先在队群发送「。战斗 加入」。');
    if (cmd === '状态') return { text: status(room) };
    const player = room.players.find(entry => entry.uid === id);
    const isLeader = leader(ctx, room);
    let event = '';

    if (cmd === '加入') {
      check(inGroup && room.phase === 'lobby', '请在开战前到队群加入。');
      check(words.length <= 1, '格式：。战斗 加入 [角色编号]');
      check(!joined, joined === key ? '你已在本队。' : '你已加入另一支小队。');
      check(room.players.length < 10, '本队已满 10 人。');
      const member = makePlayer(data, ctx, words[0]);
      room.players.push(member);
      event = playerName(member) + ' 加入小队。';
    } else if (management.includes(cmd)) {
      check(inGroup && isLeader, '请由开队者或骰主在队群操作。');
      if (cmd === '收队') {
        delete data.rooms[key];
        return { data, text: '小队已收队。' };
      }
      if (cmd === '移除') {
        check(room.phase === 'lobby', '只可在集结时移除队员。');
        const target = room.players.find(entry => entry.id === String(words[0] || '').padStart(3, '0'));
        check(target, '请填写本队角色编号。');
        room.players = room.players.filter(entry => entry !== target);
        event = playerName(target) + ' 离开小队。';
      }
      if (cmd === '喊话设置') {
        check(room.phase === 'lobby', '只可在集结时调整喊话。');
        check(words.length === 3, '格式：。战斗 喊话设置 编号 连续喊话次数 冷却轮数');
        const target = room.players.find(entry => entry.id === words[0].padStart(3, '0'));
        check(target, '请填写本队角色编号。');
        target.stats.calls = number(words[1], 1, 2);
        target.stats.cooldown = number(words[2], 1, 2);
        event = playerName(target) + ' 的喊话设置已更新。';
      }
      if (cmd === '开始') {
        check(room.phase === 'lobby' || room.phase === 'rest', '当前阶段无法开始新遭遇。');
        check(room.players.some(entry => entry.hp > 0), '需要至少一位仍可行动的队员。');
        const enemy = encounter(words);
        for (const member of room.players) refreshPlayer(data, ctx, room, member);
        start(room, enemy);
        event = enemy.name + ' 出现了。';
      }
    } else if (cmd === '退出') {
      check(inGroup && room.phase === 'lobby' && player, '仅可在集结时从队群退出。');
      room.players = room.players.filter(entry => entry !== player);
      event = playerName(player) + ' 离开小队。';
    } else if (cmd === '治疗') {
      check(room.phase === 'rest' && player && player.hp > 0 && !player.healUsed, '每次整备中，可行动的队员各能治疗一次。');
      const selector = words.join(' ').trim();
      check(selector, '格式：。治疗 角色名或编号');
      // 纯数字优先匹配旧有角色编号，其他输入按完整角色名匹配。
      const byId = /^\d+$/.test(selector)
        ? room.players.find(entry => entry.id === selector.padStart(3, '0'))
        : null;
      const matches = byId ? [byId] : room.players.filter(entry => entry.name.trim().replace(/\s+/g, ' ') === selector);
      check(matches.length > 0, '本队没有这个角色，请核对名字或编号。');
      check(matches.length === 1, '本队有同名角色，请用编号：' + matches.map(playerName).join('、') + '。');
      const target = matches[0];
      check(target.hp < target.maxHp, playerName(target) + ' 的 HP 已满。');
      const healed = Math.min(3, target.maxHp - target.hp);
      target.hp += healed;
      player.healUsed = true;
      event = playerName(player) + ' 为 ' + playerName(target) + ' 恢复 ' + healed + ' HP。';
    } else {
      check(actions.includes(cmd), '未知指令，发送「。战斗 帮助」查看用法。');
      check(room.phase === 'battle', '当前没有正在进行的战斗。');
      check(player || (inGroup && isLeader && ['结算', '跳过'].includes(cmd)), '只有本队队员可以提交战斗行动。');
      const pending = room.pending;
      const current = pending ? room.players.find(entry => entry.uid === pending.target) : activePlayer(room);
      const mine = current.uid === id;
      if (cmd === '喊话' || cmd === '结算') {
        check(pending && pending.code && words.length === 1 && words[0] === pending.code, '该行动码已失效或尚未开放喊话。');
        if (cmd === '喊话') {
          check(!mine && player.hp > 0, '只能为当前队友喊话，倒下时无法喊话。');
          check(player.lastCall !== room.round && room.round >= player.nextCall, '本轮的喊话已使用或正在冷却。');
          player.lastCall = room.round;
          player.spentCalls++;
          if (player.spentCalls >= player.stats.calls) {
            player.spentCalls = 0;
            player.nextCall = room.round + player.stats.cooldown + 1;
          }
          event = settle(room, pending.kind, current, player, false);
        } else {
          check(mine || (inGroup && isLeader), '只有当事人或队群带队可以结束等待。');
          event = settle(room, pending.kind, current, null, false);
        }
      } else if (cmd === '跳过') {
        check(mine || (inGroup && isLeader), '现在轮到 ' + playerName(current) + '。');
        check(!pending || pending.kind === 'defense', '该动作已经提交，可用结算指令结束等待。');
        if (pending) {
          event = settle(room, 'block', current, null, false);
          event = '等待结束，按格挡处理。\n' + event;
        } else {
          event = playerName(current) + ' 跳过行动。';
          advance(room, true);
        }
      } else {
        if (!mine) return { text: battlePrompt(room) };
        if (cmd === '格挡' || cmd === '闪避') {
          check(pending && pending.kind === 'defense', '受到攻击时才可选择格挡或闪避。');
          check(!words.length || (words.length === 1 && words[0] === '求助'), '可在指令尾加「求助」等待喊话。');
          const kind = cmd === '格挡' ? 'block' : 'dodge';
          if (words.length) queueAction(data, room, kind, current);
          else event = settle(room, kind, current, null, false);
        } else {
          if (pending) return { text: battlePrompt(room) };
          if (cmd === '投掷') {
            const item = words.join(' ').trim();
            check(item && item.length <= 64 && !/[\[\]\r\n]/.test(item), '格式：。投掷 物品名（最多 64 字）');
            const dice = roll();
            const agility = current.stats.agility;
            const success = dice <= agility;
            event = item + '滑稽地从你的手里挣扎着飞了出去\n' + playerName(current) +
              ' ｜ 灵敏 ' + dice + '/' + agility + ' ｜ ' +
              (success ? '命中 ' + room.enemy.name + '，' + damage(room.enemy, 2) : '投掷失败');
            advance(room, true);
            return { data, room, text: status(room, event) };
          }
          let mode = cmd;
          if (cmd === '攻击') {
            mode = words[0];
            check(!words.length || (words.length === 1 && ['直击', '解析', '求助'].includes(mode)), commands.攻击);
          } else {
            check(!words.length, '此行动无需附加参数。');
          }
          if (mode === '解析') return { text: '。战斗 自析 ｜ 。战斗 求助' };
          if (mode === '求助') queueAction(data, room, 'attack', current);
          else event = settle(room, 'attack', current, null, mode === '自析');
        }
      }
    }
    return { data, room, text: status(room, event) };
  }

  function execute(ctx, msg, commandName, words) {
    let result;
    let groupContext;
    let groupMessage;
    try {
      result = run(ctx, msg, commandName, words);
      if (msg.messageType === 'private' && result.room) {
        groupMessage = seal.newMessage();
        groupMessage.messageType = 'group';
        groupMessage.platform = ctx.endPoint.platform;
        groupMessage.groupId = result.room.groupId;
        groupMessage.sender.userId = uid(ctx);
        groupContext = seal.createTempCtx(ctx.endPoint, groupMessage);
        check(groupContext && groupId(groupContext) === groupMessage.groupId, '无法连接小队群，请到队群操作。');
      }
      // 在同一个同步指令内完成读取、验证和写入，再发送战报。
      if (result.data) ext.storageSet(DATA, JSON.stringify(result.data));
    } catch (error) {
      seal.replyToSender(ctx, msg, '❄️ ' + (error.message || error));
      return;
    }
    if (groupContext) {
      seal.replyGroup(groupContext, groupMessage, result.text);
      seal.replyToSender(ctx, msg, '已提交，战报见队群。');
    } else seal.replyToSender(ctx, msg, result.text);
  }

  function registerCommand(name, help, initialWords) {
    const command = seal.ext.newCmdItemInfo();
    command.name = name;
    command.help = help;
    command.solve = (ctx, msg, args) => {
      const words = initialWords.slice();
      if (name === '录入') {
        const raw = String(msg.message || '').replace(/^\s*[.。，]录入\s*/, '');
        execute(ctx, msg, name, words.concat(raw));
        return seal.ext.newCmdExecuteResult(true);
      }
      for (let index = 1; index <= 65; index++) {
        const word = args.getArgN(index);
        if (!word) break;
        words.push(String(word));
      }
      execute(ctx, msg, name, words);
      return seal.ext.newCmdExecuteResult(true);
    };
    ext.cmdMap[name] = command;
  }

  const commands = {
    战斗: HELP,
    录入: INPUT,
    投掷: '。投掷 物品名',
    攻击: '。攻击 [解析|直击|求助]',
    喊话: '。喊话 行动码',
    结算: '。结算 行动码',
    格挡: '。格挡 [求助]',
    闪避: '。闪避 [求助]',
    跳过: '。跳过',
    治疗: '。治疗 角色名或编号',
    收队: '。收队'
  };
  for (const [name, help] of Object.entries(commands)) {
    registerCommand(name, help, name === '战斗' ? [] : [name]);
  }
  ext.onNotCommandReceived = (ctx, msg) => {
    const input = String(msg.message || '').trim();
    const match = /^[。，]([^\s]+)(?:\s+(.+))?$/.exec(input);
    if (!match || !hasOwn(commands, match[1])) return;
    const words = match[2] ? match[2].split(/\s+/) : [];
    if (match[1] !== '战斗') words.unshift(match[1]);
    execute(ctx, msg, match[1], words);
  };
  seal.ext.register(ext);
})();
