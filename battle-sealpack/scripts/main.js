// ==UserScript==
// @name 圣布里吉冬训营战斗系统
// @author KIAkio
// @version 0.1.0
// @description QQ 小队群回合制战斗，支持私聊提交行动
// ==/UserScript==
(function () {
  'use strict';

  const EXT = 'winter_camp_battle';
  const DATA = 'battle:v1';
  const DEFAULT_STATS = { speed: 10, agility: 3, insight: 3, attack: 4, defense: 2, armor: 3, calls: 1, cooldown: 1 };
  const ACTIONS = { attack: '攻击', block: '格挡', dodge: '闪避' };
  const HELP = [
    '❄️【圣布里吉 · 战斗指令】',
    '带队：。战斗 开队 → 队员各发 。战斗 加入 → 。战斗 开始',
    '攻击：。战斗 攻击 → 直接 或 解析；选择解析后可选 自析 或 求助',
    '遇袭：。战斗 格挡 或 。战斗 闪避，尾加「求助」可等待喊话',
    '队友：。战斗 喊话 行动码；无人喊话时由当事人或带队发 。战斗 结算 行动码',
    '其他：。战斗 状态 / 跳过 / 治疗 角色编号；带队可发 。战斗 收队',
    '独立指令：。投掷 物品名（灵敏检定，成功造成 2 点伤害）',
    '长指令都以「。战斗 」开头；加入、开队和开始须在队群发送。'
  ].join('\n');

  if (seal.ext.find(EXT)) return;
  const ext = seal.ext.new(EXT, 'KIAkio', '0.1.0');

  function check(condition, message) {
    if (!condition) throw new Error(message);
  }

  function load() {
    const raw = ext.storageGet(DATA);
    if (!raw) return { rooms: {}, nextAction: 1 };
    const data = JSON.parse(raw);
    check(data && data.rooms && Number.isSafeInteger(data.nextAction), '战斗存档无法读取。');
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

  function makePlayer(ctx, characterId) {
    const profiles = globalThis.H11CampProfiles;
    check(profiles, '请先启用地精背包核心 1.8.5 或更新版本。');
    const id = uid(ctx);
    const registry = profiles.read(ctx);
    const entries = registry.members[id] || [];
    if (characterId) check(/^\d+$/.test(characterId), '角色编号须为数字。');
    const wanted = characterId ? characterId.padStart(3, '0') : registry.active[id];
    const profile = entries.find(entry => entry.id === wanted);
    check(profile, '未找到你名下的该营地角色。请先注册或核对编号。');
    const result = seal.vars.strGet(ctx, '$mH11角色数据仓库');
    const store = result[0] ? JSON.parse(result[0]) : {};
    const bag = store[profiles.groupKey(ctx) + '::' + profile.id] || {};
    const maxHp = Number(bag.maxHp == null ? 10 : bag.maxHp);
    const hp = Number(bag.hp == null ? maxHp : bag.hp);
    check(Number.isSafeInteger(maxHp) && maxHp > 0 && Number.isSafeInteger(hp), '营地角色血量无法读取。');
    check(hp > 0, '该角色当前 HP 为 0，请先在营地恢复。');
    return {
      uid: id, id: profile.id, name: profile.name || '营地角色',
      hp: Math.min(hp, maxHp), maxHp, armor: DEFAULT_STATS.armor,
      stats: Object.assign({}, DEFAULT_STATS), spentCalls: 0, lastCall: 0, nextCall: 1, healUsed: false
    };
  }

  function encounter(args) {
    if (!args.length) return { name: '冰狼', hp: 16, armor: 2, speed: 8, attack: 4, defense: 1, dc: 11, maxHp: 16 };
    check(args.length === 7, '格式：。战斗 开始 怪名 HP 护甲 速度 攻击 防御 命中门槛');
    const hp = number(args[1], 1, 999);
    return {
      name: args[0], hp, maxHp: hp, armor: number(args[2], 0, 999),
      speed: number(args[3], 0, 99), attack: number(args[4], 1, 99),
      defense: number(args[5], 0, 99), dc: number(args[6], 2, 30)
    };
  }

  function meters(target) {
    const filled = Math.ceil(6 * target.hp / target.maxHp);
    return 'HP ' + '■'.repeat(filled) + '□'.repeat(6 - filled) + ' ' + target.hp + '/' + target.maxHp +
      (target.armor > 0 ? ' ｜ 护甲 ' + target.armor : '');
  }

  function status(room) {
    if (room.phase === 'lobby') {
      return '🏕️【小队集结】\n' + (room.players.map(playerName).join('、') || '等待队员加入') +
        '\n。战斗 加入 [角色编号]';
    }
    const header = { battle: '第 ' + room.round + ' 轮', rest: '整备', defeat: '小队倒下' }[room.phase];
    const order = room.order.map((key, index) => {
      const target = key === 'enemy' ? room.enemy : room.players.find(player => player.uid === key);
      const name = key === 'enemy' ? target.name : playerName(target);
      const current = room.phase === 'battle' && (room.pending && room.pending.kind !== 'attack' ?
        room.pending.target === key : index === room.turn);
      const mark = current ? '▶ ' : target.hp === 0 ? '× ' : '· ';
      return mark + name + ' ｜ ' + meters(target);
    });
    let prompt = '';
    if (room.phase === 'rest') prompt = '可发送「。战斗 治疗 编号」，由带队开启下一场。';
    if (room.phase === 'battle') {
      if (!room.pending) prompt = '轮到 ' + playerName(activePlayer(room)) + ' ｜ 。战斗 攻击 / 。战斗 跳过';
      else {
        const pending = room.pending;
        if (pending.kind === 'defense') {
          prompt = '⚠️ ' + room.enemy.name + ' 攻向 ' + playerName(room.players.find(p => p.uid === pending.target)) +
            '\n。战斗 格挡 或 。战斗 闪避；尾加「求助」可等待喊话。';
        } else {
          const target = room.players.find(player => player.uid === pending.target);
          prompt = '📣 ' + playerName(target) + (pending.kind === 'attack' ? ' 攻击 ' + room.enemy.name + '，请求要害解析' :
            ' 选择' + ACTIONS[pending.kind] + '，请求队友喊话') +
            '\n。战斗 喊话 ' + pending.code + ' ｜ 。战斗 结算 ' + pending.code;
        }
      }
    }
    return ['❄️【' + header + '】'].concat(order, prompt ? [prompt] : []).join('\n');
  }

  function roll() {
    return 1 + Math.floor(Math.random() * 20);
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

  function settle(room, kind, player, helper, selfAnalysis) {
    let bonus = 0;
    const lines = [];
    if (helper || selfAnalysis) {
      const analyst = helper || player;
      const dice = roll();
      const success = dice + analyst.stats.insight >= 12;
      bonus = success ? 2 : 0;
      lines.push(playerName(analyst) + (helper ? ' 向 ' + playerName(player) + ' 喊话' : ' 自行解析破绽') +
        ' ｜ 洞察 ' + dice + '+' + analyst.stats.insight + '/12 ' + (success ? '成功，+2' : '失败'));
    }

    const enemy = room.enemy;
    const dice = roll();
    const stats = player.stats;
    if (kind === 'attack') {
      const hit = dice + bonus >= enemy.dc;
      lines.push(playerName(player) + ' 攻击 ' + enemy.name + ' ｜ 命中 ' + dice + '+' + bonus + '/' + enemy.dc + ' ｜ ' +
        (hit ? damage(enemy, Math.max(1, stats.attack - enemy.defense)) : '未命中'));
    } else {
      let threshold = 10;
      let reduction = stats.defense;
      let detail = '';
      if (kind === 'block') reduction += 2 + bonus;
      else {
        const agility = roll();
        const success = agility + stats.agility >= 12;
        threshold += (success ? 4 : 0) + bonus;
        detail = ' ｜ 灵敏 ' + agility + '+' + stats.agility + '/12 ' + (success ? '成功' : '失败');
      }
      lines.push(playerName(player) + ' ' + ACTIONS[kind] + detail + ' ｜ ' + enemy.name +
        ' 命中 ' + dice + '/' + threshold + ' ｜ ' +
        (dice >= threshold ? damage(player, Math.max(0, enemy.attack - reduction)) : '未命中'));
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

  const management = ['属性', '开始', '收队', '移除'];
  const actions = ['攻击', '解析', '直接', '自析', '求助', '格挡', '闪避', '喊话', '结算', '跳过', '投掷'];

  function run(ctx, msg, words) {
    const cmd = words.shift() || '帮助';
    const inGroup = msg.messageType === 'group';
    const id = uid(ctx);
    const group = groupId(ctx);
    const endpoint = ctx.endPoint;
    check(id.startsWith('QQ:') && endpoint && endpoint.userId &&
      (!inGroup || group.startsWith('QQ-Group:')), '请在 QQ 群或 QQ 小窗使用。');

    if (cmd === '帮助') return { text: HELP };
    const data = load();
    const prefix = endpoint.userId + '|';
    const key = prefix + group;
    const joined = Object.keys(data.rooms).find(roomKey => roomKey.startsWith(prefix) &&
      data.rooms[roomKey].players.some(player => player.uid === id));
    let room = inGroup ? data.rooms[key] : joined ? data.rooms[joined] : null;
    if (cmd === '开队') {
      check(inGroup && ctx.privilegeLevel >= 50, '请由队群管理员、群主或骰主开队。');
      check(!room, '本群已有小队，请先「。战斗 收队」。');
      room = { groupId: group, host: id, phase: 'lobby', players: [] };
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
      const member = makePlayer(ctx, words[0]);
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
      if (cmd === '属性') {
        check(room.phase === 'lobby', '只可在集结时调整属性。');
        check(words.length === 9, '格式：。战斗 属性 编号 速度 灵敏 洞察 攻击 防御 护甲 连续喊话次数 冷却轮数');
        const target = room.players.find(entry => entry.id === words[0].padStart(3, '0'));
        check(target, '请填写本队角色编号。');
        const [speed, agility, insight, attack, defense, armor, calls, cooldown] = words.slice(1).map((value, index) =>
          number(value, index === 3 || index >= 6 ? 1 : 0, index >= 6 ? 2 : 99));
        target.stats = { speed, agility, insight, attack, defense, armor, calls, cooldown };
        target.armor = armor;
        event = playerName(target) + ' 的战斗属性已更新。';
      }
      if (cmd === '开始') {
        check(room.phase === 'lobby' || room.phase === 'rest', '当前阶段无法开始新遭遇。');
        check(room.players.some(entry => entry.hp > 0), '需要至少一位仍可行动的队员。');
        const enemy = encounter(words);
        start(room, enemy);
        event = enemy.name + ' 出现了。';
      }
    } else if (cmd === '退出') {
      check(inGroup && room.phase === 'lobby' && player, '仅可在集结时从队群退出。');
      room.players = room.players.filter(entry => entry !== player);
      event = playerName(player) + ' 离开小队。';
    } else if (cmd === '治疗') {
      check(room.phase === 'rest' && player && player.hp > 0 && !player.healUsed, '每次整备中，可行动的队员各能治疗一次。');
      const target = room.players.find(entry => entry.id === String(words[0] || '').padStart(3, '0'));
      check(target && target.hp < target.maxHp, '请选择一位未满血的队员。');
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
        check(mine, '现在轮到 ' + playerName(current) + '。');
        if (cmd === '格挡' || cmd === '闪避') {
          check(pending && pending.kind === 'defense', '受到攻击时才可选择格挡或闪避。');
          check(!words.length || (words.length === 1 && words[0] === '求助'), '可在指令尾加「求助」等待喊话。');
          const kind = cmd === '格挡' ? 'block' : 'dodge';
          if (words.length) queueAction(data, room, kind, current);
          else event = settle(room, kind, current, null, false);
        } else {
          check(!pending, '当前正在等待防守或喊话结算。');
          if (cmd === '投掷') {
            const item = words.join(' ').trim();
            check(item && item.length <= 64 && !/[\[\]\r\n]/.test(item), '格式：。投掷 物品名（最多 64 字）');
            const dice = roll();
            const agility = current.stats.agility;
            const success = dice + agility >= 12;
            event = item + '滑稽地从你的手里挣扎着飞了出去\n' + playerName(current) +
              ' ｜ 灵敏 ' + dice + '+' + agility + '/12 ｜ ' +
              (success ? '命中 ' + room.enemy.name + '，' + damage(room.enemy, 2) : '投掷失败');
            advance(room, true);
            return { data, room, text: event + '\n' + status(room) };
          }
          check(!words.length, '此行动无需附加参数。');
          if (cmd === '攻击') return { text: '。战斗 直接 ｜ 。战斗 解析' };
          if (cmd === '解析') return { text: '。战斗 自析 ｜ 。战斗 求助' };
          if (cmd === '求助') queueAction(data, room, 'attack', current);
          else event = settle(room, 'attack', current, null, cmd === '自析');
        }
      }
    }
    return { data, room, text: (event ? event + '\n' : '') + status(room) };
  }

  function execute(ctx, msg, words) {
    let result;
    let groupContext;
    let groupMessage;
    try {
      result = run(ctx, msg, words);
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
      for (let index = 1; index <= 65; index++) {
        const word = args.getArgN(index);
        if (!word) break;
        words.push(String(word));
      }
      execute(ctx, msg, words);
      return seal.ext.newCmdExecuteResult(true);
    };
    ext.cmdMap[name] = command;
  }

  registerCommand('战斗', HELP, []);
  registerCommand('投掷', '。投掷 物品名', ['投掷']);
  ext.onNotCommandReceived = (ctx, msg) => {
    const input = String(msg.message || '').trim();
    const match = /^[。，]((?:战斗|投掷))(?:\s+(.+))?$/.exec(input);
    if (!match) return;
    const words = match[2] ? match[2].split(/\s+/) : [];
    if (match[1] === '投掷') words.unshift('投掷');
    execute(ctx, msg, words);
  };
  seal.ext.register(ext);
})();
