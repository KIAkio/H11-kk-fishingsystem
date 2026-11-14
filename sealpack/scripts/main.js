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
  const VERSION = '1.7.2';
  const DATA_VAR = '$m地精背包数据';
  const DEFAULT_HP = 10;
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

  function getPlayerId(ctx) {
    return String(ctx.player && (ctx.player.userId || ctx.player.id) || '').trim();
  }
  function groupKey(ctx) {
    return String(ctx.group && (ctx.group.groupId || ctx.group.id) || 'private');
  }
  function jsonRead(ctx, key, fallback) {
    const r = seal.vars.strGet(ctx, key), raw = Array.isArray(r) ? r[0] : '';
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (e) { throw new Error('存档 '+key+' 解析失败，已停止写入以保护数据。'); }
  }
  function jsonWrite(ctx, key, value) { seal.vars.strSet(ctx, key, JSON.stringify(value)); }
  function loadGroupProfiles(ctx) {
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
  function saveGroupProfiles(ctx,p) { jsonWrite(ctx,GROUP_PROFILE_VAR,p); }
  function currentRole(ctx) {
    const p=loadGroupProfiles(ctx),uid=getPlayerId(ctx);
    return (p.members[uid]||[]).find(x=>x.id===p.active[uid]) || null;
  }
  function roleKey(ctx, id) { return groupKey(ctx)+'::'+String(id); }
  function activeKey(ctx) { return groupKey(ctx); }
  function loadData(ctx) {
    const role=currentRole(ctx);
    if (!role) throw new Error('请先使用 .注册 姓名 创建营地角色。');
    const store=jsonRead(ctx,ROLE_STORE,{});
    const key=roleKey(ctx,role.id);
    if (!Object.prototype.hasOwnProperty.call(store,key)) {
      const legacy=jsonRead(ctx,DATA_VAR,null);
      const migration=jsonRead(ctx,'$mH11旧存档迁移标记',{});
      // 旧个人背包仅分配给首次访问的角色，避免复制给每个新角色。
      if (legacy && !migration.done) {
        store[key]=legacy;
        migration.done=true;
        migration.destination=key;
        jsonWrite(ctx,'$mH11旧存档迁移标记',migration);
      } else store[key]=createDefaultData();
      jsonWrite(ctx,ROLE_STORE,store);
    }
    return applyLifeTicks(normalizeData(store[key]));
  }
  function saveData(ctx,data) {
    const role=currentRole(ctx);
    if (!role) throw new Error('请先注册角色。');
    const store=jsonRead(ctx,ROLE_STORE,{});
    store[roleKey(ctx,role.id)]=normalizeData(data);
    jsonWrite(ctx,ROLE_STORE,store);
  }
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
    '.注册 姓名 — 注册或沿用同名角色',
    '.营地名单 — 查看本营地角色',
    '.我的档案 — 查看自己在本营地的角色',
    '.切换 编号 — 切换角色',
    '.任命 编号 教官/教师 — 管理员任命职务',
    '.解除任命 编号 — 管理员恢复学员身份',
    '.删除000 / .删除 000 / .删除 姓名 — 删除角色（需确认）',
    '.确认删除000 / .确认删除 000 — 确认删除',
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
  ext.onNotCommandReceived = (ctx,msg)=>{
    const input=String(msg&&msg.message||'').trim();
    if(/^[。，]指令H11\\s*$/i.test(input))reply(ctx,msg,H11_HELP);
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

  registerCommand('营地名单','查看当前营地全部角色',(ctx,msg)=>{
    const p=loadGroupProfiles(ctx),rows=[];
    for(const [uid,list] of Object.entries(p.members))for(const r of list)rows.push(r.id+'｜'+r.name+'｜'+(r.role||'学员')+'｜'+uid);
    rows.sort((a,b)=>Number(a.slice(0,3))-Number(b.slice(0,3)));
    reply(ctx,msg,'🏕️【营地名单】\n'+(rows.length?rows.join('\n'):'暂无注册角色'));
  });
  registerCommand('我的档案','查看本营地自己的角色',(ctx,msg)=>{
    const p=loadGroupProfiles(ctx),uid=getPlayerId(ctx),list=p.members[uid]||[];
    reply(ctx,msg,'📋【我的营地档案】\n'+(list.length?list.map(x=>x.id+'｜'+x.name+'｜'+(x.role||'学员')+(p.active[uid]===x.id?'（当前）':'')).join('\n'):'尚未注册'));
  });
  function changeCampRole(ctx,msg,args,reset){
    if(Number(ctx.privilegeLevel)<50){reply(ctx,msg,'仅群管理员、群主或骰主可以任命或解除职务。');return;}
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
      if(Number(ctx.privilegeLevel)<50){reply(ctx,msg,'只有管理员可以删除他人的角色。');return;}
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
    if(pending.owner!==getPlayerId(ctx)&&Number(ctx.privilegeLevel)<50){reply(ctx,msg,'权限不足。');return;}
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
