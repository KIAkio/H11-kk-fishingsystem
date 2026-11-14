
// ==UserScript==
// @name         动物森友会钓鱼系统
// @author       Faye
// @version      3.4.3
// @description  扩充淡水鱼类与稀有度抽取、两秒钓鱼、背包与排行榜
// ==/UserScript==

(function () {
    'use strict';

    const EXT_ID = 'acnh_fishing_system';
    const STORAGE_KEY = 'acnh_fishing_data_v3';

    if (seal.ext.find(EXT_ID)) return;

    const ext = seal.ext.new(EXT_ID, 'Faye', '3.4.3');

    // 稀有度权重：普通70%、少见24%、稀有6%
    const RARITY = {
        Common: {
            name: '普通',
            stars: '★☆☆',
            weight: 70,
            exp: 5
        },
        Uncommon: {
            name: '少见',
            stars: '★★☆',
            weight: 24,
            exp: 12
        },
        Rare: {
            name: '稀有',
            stars: '★★★',
            weight: 6,
            exp: 25
        }
    };

    // 80种动物森友会鱼类
    // rarity：Common普通 / Uncommon少见 / Rare稀有
    const FISH_LIST = [
        {id:1,name:'苦鱼',english:'Bitterling',rarity:'Common',location:'河流',shadow:'小'},
        {id:2,name:'雅罗鱼',english:'Pale chub',rarity:'Common',location:'河流',shadow:'极小'},
        {id:3,name:'鲫鱼',english:'Crucian carp',rarity:'Common',location:'河流',shadow:'小'},
        {id:4,name:'鲦鱼',english:'Dace',rarity:'Common',location:'河流',shadow:'中'},
        {id:5,name:'鲤鱼',english:'Carp',rarity:'Common',location:'池塘',shadow:'大'},
        {id:6,name:'锦鲤',english:'Koi',rarity:'Uncommon',location:'池塘',shadow:'大'},
        {id:7,name:'金鱼',english:'Goldfish',rarity:'Common',location:'池塘',shadow:'极小'},
        {id:8,name:'龙睛金鱼',english:'Pop-eyed goldfish',rarity:'Common',location:'池塘',shadow:'极小'},
        {id:9,name:'兰寿金鱼',english:'Ranchu goldfish',rarity:'Uncommon',location:'池塘',shadow:'小'},
        {id:10,name:'鳉鱼',english:'Killifish',rarity:'Common',location:'池塘',shadow:'极小'},
        {id:11,name:'小龙虾',english:'Crawfish',rarity:'Common',location:'池塘',shadow:'小'},
        {id:12,name:'鳖',english:'Soft-shelled turtle',rarity:'Uncommon',location:'河流',shadow:'大'},
        {id:13,name:'鳄龟',english:'Snapping turtle',rarity:'Common',location:'河流',shadow:'大'},
        {id:14,name:'蝌蚪',english:'Tadpole',rarity:'Common',location:'池塘',shadow:'极小'},
        {id:15,name:'青蛙',english:'Frog',rarity:'Common',location:'池塘',shadow:'小'},
        {id:16,name:'塘鳢鱼',english:'Freshwater goby',rarity:'Common',location:'河流',shadow:'小'},
        {id:17,name:'泥鳅',english:'Loach',rarity:'Common',location:'河流',shadow:'小'},
        {id:18,name:'鲶鱼',english:'Catfish',rarity:'Common',location:'池塘',shadow:'大'},
        {id:19,name:'黑鱼',english:'Giant snakehead',rarity:'Rare',location:'池塘',shadow:'大'},
        {id:20,name:'蓝鳃太阳鱼',english:'Bluegill',rarity:'Common',location:'河流',shadow:'小'},
        {id:21,name:'黄鲈鱼',english:'Yellow perch',rarity:'Common',location:'河流',shadow:'中'},
        {id:22,name:'黑鲈鱼',english:'Black bass',rarity:'Common',location:'河流',shadow:'大'},
        {id:23,name:'吴郭鱼',english:'Tilapia',rarity:'Common',location:'河流',shadow:'中'},
        {id:24,name:'白斑狗鱼',english:'Pike',rarity:'Uncommon',location:'河流',shadow:'特大'},
        {id:25,name:'西太公鱼',english:'Pond smelt',rarity:'Common',location:'河流',shadow:'小'},
        {id:26,name:'香鱼',english:'Sweetfish',rarity:'Common',location:'河流',shadow:'中'},
        {id:27,name:'樱花钩吻鲑',english:'Cherry salmon',rarity:'Common',location:'悬崖河流',shadow:'中'},
        {id:28,name:'花羔红点鲑',english:'Char',rarity:'Uncommon',location:'悬崖河流',shadow:'中'},
        {id:29,name:'金鳟',english:'Golden trout',rarity:'Rare',location:'悬崖河流',shadow:'中'},
        {id:30,name:'远东哲罗鱼',english:'Stringfish',rarity:'Rare',location:'悬崖河流',shadow:'特大'},
        {id:31,name:'鲑鱼',english:'Salmon',rarity:'Common',location:'河口',shadow:'大'},
        {id:32,name:'帝王鲑',english:'King salmon',rarity:'Uncommon',location:'河口',shadow:'特大'},
        {id:33,name:'中华绒螯蟹',english:'Mitten crab',rarity:'Uncommon',location:'河流',shadow:'小'},
        {id:34,name:'孔雀鱼',english:'Guppy',rarity:'Common',location:'河流',shadow:'极小'},
        {id:35,name:'食蚊鱼',english:'Nibble fish',rarity:'Uncommon',location:'河流',shadow:'极小'},
        {id:36,name:'神仙鱼',english:'Angelfish',rarity:'Uncommon',location:'河流',shadow:'小'},
        {id:37,name:'斗鱼',english:'Betta',rarity:'Uncommon',location:'河流',shadow:'小'},
        {id:38,name:'霓虹灯鱼',english:'Neon tetra',rarity:'Common',location:'河流',shadow:'极小'},
        {id:39,name:'彩虹鱼',english:'Rainbowfish',rarity:'Common',location:'河流',shadow:'极小'},
        {id:40,name:'食人鱼',english:'Piranha',rarity:'Uncommon',location:'河流',shadow:'小'},
        {id:41,name:'骨舌鱼',english:'Arowana',rarity:'Rare',location:'河流',shadow:'大'},
        {id:42,name:'黄金河虎',english:'Dorado',rarity:'Rare',location:'河流',shadow:'特大'},
        {id:43,name:'雀鳝',english:'Gar',rarity:'Rare',location:'池塘',shadow:'特大'},
        {id:44,name:'巨骨舌鱼',english:'Arapaima',rarity:'Rare',location:'河流',shadow:'巨大'},
        {id:45,name:'古代鱼',english:'Saddled bichir',rarity:'Uncommon',location:'河流',shadow:'大'},
        {id:46,name:'鲟鱼',english:'Sturgeon',rarity:'Uncommon',location:'河口',shadow:'巨大'},
        {id:47,name:'海蝴蝶',english:'Sea butterfly',rarity:'Common',location:'大海',shadow:'极小'},
        {id:48,name:'海马',english:'Sea horse',rarity:'Common',location:'大海',shadow:'极小'},
        {id:49,name:'小丑鱼',english:'Clown fish',rarity:'Common',location:'大海',shadow:'极小'},
        {id:50,name:'刺尾鱼',english:'Surgeonfish',rarity:'Common',location:'大海',shadow:'小'},
        {id:51,name:'蝴蝶鱼',english:'Butterfly fish',rarity:'Common',location:'大海',shadow:'小'},
        {id:52,name:'苏眉鱼',english:'Napoleonfish',rarity:'Rare',location:'大海',shadow:'巨大'},
        {id:53,name:'狮子鱼',english:'Zebra turkeyfish',rarity:'Common',location:'大海',shadow:'中'},
        {id:54,name:'河豚',english:'Blowfish',rarity:'Uncommon',location:'大海',shadow:'中'},
        {id:55,name:'刺豚',english:'Puffer fish',rarity:'Common',location:'大海',shadow:'中'},
        {id:56,name:'凤尾鱼',english:'Anchovy',rarity:'Common',location:'大海',shadow:'小'},
        {id:57,name:'竹荚鱼',english:'Horse mackerel',rarity:'Common',location:'大海',shadow:'小'},
        {id:58,name:'条石鲷',english:'Barred knifejaw',rarity:'Uncommon',location:'大海',shadow:'中'},
        {id:59,name:'鲈鱼',english:'Sea bass',rarity:'Common',location:'大海',shadow:'特大'},
        {id:60,name:'鲷鱼',english:'Red snapper',rarity:'Common',location:'大海',shadow:'大'},
        {id:61,name:'鲽鱼',english:'Dab',rarity:'Common',location:'大海',shadow:'中'},
        {id:62,name:'比目鱼',english:'Olive flounder',rarity:'Common',location:'大海',shadow:'特大'},
        {id:63,name:'鱿鱼',english:'Squid',rarity:'Common',location:'大海',shadow:'中'},
        {id:64,name:'裸胸鳝',english:'Moray eel',rarity:'Uncommon',location:'大海',shadow:'细长'},
        {id:65,name:'五彩鳗',english:'Ribbon eel',rarity:'Common',location:'大海',shadow:'细长'},
        {id:66,name:'金枪鱼',english:'Tuna',rarity:'Rare',location:'码头',shadow:'巨大'},
        {id:67,name:'蓝枪鱼',english:'Blue marlin',rarity:'Rare',location:'码头',shadow:'巨大'},
        {id:68,name:'鲹鱼',english:'Giant trevally',rarity:'Uncommon',location:'码头',shadow:'特大'},
        {id:69,name:'鬼头刀',english:'Mahi-mahi',rarity:'Rare',location:'码头',shadow:'特大'},
        {id:70,name:'翻车鱼',english:'Ocean sunfish',rarity:'Uncommon',location:'大海',shadow:'背鳍'},
        {id:71,name:'𫚉鱼',english:'Ray',rarity:'Uncommon',location:'大海',shadow:'特大'},
        {id:72,name:'锯鲨',english:'Saw shark',rarity:'Rare',location:'大海',shadow:'背鳍'},
        {id:73,name:'双髻鲨',english:'Hammerhead shark',rarity:'Uncommon',location:'大海',shadow:'背鳍'},
        {id:74,name:'大白鲨',english:'Great white shark',rarity:'Rare',location:'大海',shadow:'背鳍'},
        {id:75,name:'鲸鲨',english:'Whale shark',rarity:'Rare',location:'大海',shadow:'背鳍'},
        {id:76,name:'吸盘鱼',english:'Suckerfish',rarity:'Uncommon',location:'大海',shadow:'背鳍'},
        {id:77,name:'灯笼鱼',english:'Football fish',rarity:'Uncommon',location:'大海',shadow:'大'},
        {id:78,name:'皇带鱼',english:'Oarfish',rarity:'Rare',location:'大海',shadow:'巨大'},
        {id:79,name:'桶眼鱼',english:'Barreleye',rarity:'Rare',location:'大海',shadow:'小'},
        {id:80,name:'矛尾鱼',english:'Coelacanth',rarity:'Rare',location:'大海（雨天）',shadow:'巨大'},
        {id:81,name:'草鱼',english:'',rarity:'Common',location:'河流',shadow:'大'},
        {id:82,name:'青鱼',english:'',rarity:'Common',location:'河流',shadow:'大'},
        {id:83,name:'鲢鱼',english:'',rarity:'Common',location:'河流',shadow:'大'},
        {id:84,name:'鳙鱼',english:'',rarity:'Common',location:'河流',shadow:'特大'},
        {id:85,name:'鳊鱼',english:'',rarity:'Common',location:'河流',shadow:'中'},
        {id:86,name:'鲂鱼',english:'',rarity:'Common',location:'河流',shadow:'中'},
        {id:87,name:'翘嘴鲌',english:'',rarity:'Common',location:'河流',shadow:'中'},
        {id:88,name:'蒙古鲌',english:'',rarity:'Common',location:'河流',shadow:'中'},
        {id:89,name:'餐条',english:'',rarity:'Common',location:'河流',shadow:'小'},
        {id:90,name:'马口鱼',english:'',rarity:'Common',location:'溪流',shadow:'小'},
        {id:91,name:'宽鳍鱲',english:'',rarity:'Common',location:'溪流',shadow:'小'},
        {id:92,name:'赤眼鳟',english:'',rarity:'Common',location:'河流',shadow:'中'},
        {id:93,name:'鳡鱼',english:'',rarity:'Uncommon',location:'河流',shadow:'特大'},
        {id:94,name:'大鳞副泥鳅',english:'',rarity:'Common',location:'河流',shadow:'小'},
        {id:95,name:'黄颡鱼',english:'',rarity:'Common',location:'河流',shadow:'中'},
        {id:96,name:'瓦氏黄颡鱼',english:'',rarity:'Common',location:'河流',shadow:'中'},
        {id:97,name:'沙塘鳢',english:'',rarity:'Common',location:'河流',shadow:'小'},
        {id:98,name:'棒花鱼',english:'',rarity:'Common',location:'溪流',shadow:'小'},
        {id:99,name:'麦穗鱼',english:'',rarity:'Common',location:'河流',shadow:'小'},
        {id:100,name:'鳑鲏',english:'',rarity:'Common',location:'河流',shadow:'极小'},
        {id:101,name:'中华鳑鲏',english:'',rarity:'Common',location:'河流',shadow:'极小'},
        {id:102,name:'鱊鱼',english:'',rarity:'Common',location:'河流',shadow:'小'},
        {id:103,name:'南瓜籽太阳鱼',english:'',rarity:'Common',location:'湖泊',shadow:'小'},
        {id:104,name:'杜父鱼',english:'',rarity:'Common',location:'溪流',shadow:'小'},
        {id:105,name:'虾虎鱼',english:'',rarity:'Common',location:'河流',shadow:'小'},
        {id:106,name:'胡瓜鱼',english:'',rarity:'Common',location:'冷水河流',shadow:'小'},
        {id:107,name:'鳟鲈',english:'',rarity:'Uncommon',location:'湖泊',shadow:'大'},
        {id:108,name:'镜鲤',english:'',rarity:'Common',location:'湖泊',shadow:'大'},
        {id:109,name:'丁鱥',english:'',rarity:'Common',location:'湖泊',shadow:'中'},
        {id:110,name:'大口黑鲈',english:'',rarity:'Common',location:'湖泊',shadow:'大'},
        {id:111,name:'小口黑鲈',english:'',rarity:'Common',location:'湖泊',shadow:'中'},
        {id:112,name:'银汉鱼',english:'',rarity:'Common',location:'湖泊',shadow:'小'},
        {id:113,name:'虹鳟',english:'',rarity:'Common',location:'冷水河流',shadow:'中'},
        {id:114,name:'褐鳟',english:'',rarity:'Common',location:'冷水河流',shadow:'中'},
        {id:115,name:'溪红点鲑',english:'',rarity:'Uncommon',location:'冷水河流',shadow:'中'},
        {id:116,name:'湖红点鲑',english:'',rarity:'Uncommon',location:'湖泊',shadow:'大'},
        {id:117,name:'北极红点鲑',english:'',rarity:'Uncommon',location:'冷水湖泊',shadow:'中'},
        {id:118,name:'大西洋鲑',english:'',rarity:'Uncommon',location:'河口',shadow:'大'},
        {id:119,name:'驼背大麻哈鱼',english:'',rarity:'Common',location:'河口',shadow:'大'},
        {id:120,name:'银大麻哈鱼',english:'',rarity:'Common',location:'河口',shadow:'大'},
        {id:121,name:'红大麻哈鱼',english:'',rarity:'Uncommon',location:'河口',shadow:'大'},
        {id:122,name:'狗大麻哈鱼',english:'',rarity:'Common',location:'河口',shadow:'大'},
        {id:123,name:'茴鱼',english:'',rarity:'Common',location:'冷水河流',shadow:'中'},
        {id:124,name:'北极茴鱼',english:'',rarity:'Uncommon',location:'冷水河流',shadow:'中'},
        {id:125,name:'白鲑',english:'',rarity:'Common',location:'冷水湖泊',shadow:'中'},
        {id:126,name:'湖白鲑',english:'',rarity:'Common',location:'冷水湖泊',shadow:'中'},
        {id:127,name:'秋白鲑',english:'',rarity:'Common',location:'冷水河流',shadow:'中'},
        {id:128,name:'哲罗鱼',english:'',rarity:'Rare',location:'冷水河流',shadow:'巨大'},
        {id:129,name:'细鳞鲑',english:'',rarity:'Uncommon',location:'冷水河流',shadow:'中'},
        {id:130,name:'江鳕',english:'',rarity:'Common',location:'冷水湖泊',shadow:'大'},
        {id:131,name:'白斑狗鱼',english:'',rarity:'Uncommon',location:'湖泊',shadow:'特大'}
    ];

    // 海洋与码头鱼类暂时关闭；保留原始数据供日后重新启用。
    const ACTIVE_FISH = FISH_LIST.filter(f => !f.location.startsWith('大海') && f.location !== '码头');
    // 真实鳑鲏种名仅用于钓获文案；鱼篓与背包统一记作「鳑鲏」。
    const BITTERLING_VARIANTS = ['彩石鳑鲏','高体鳑鲏'];
    function fishDisplayName(fish){
        if(fish.name==='鳑鲏')return BITTERLING_VARIANTS[Math.floor(Math.random()*BITTERLING_VARIANTS.length)];
        return fish.name;
    }

    // 读取存档
    function loadData() {
        try {
            return JSON.parse(ext.storageGet(STORAGE_KEY) || '{}');
        } catch (e) {
            console.log('[ACNH钓鱼] 存档读取失败：' + e);
            return {};
        }
    }

    // 保存存档
    function saveData(data) {
        ext.storageSet(STORAGE_KEY, JSON.stringify(data));
    }

    function getGroupId(ctx, msg) {
        return String(
            msg.groupId ||
            (ctx.group && ctx.group.groupId) ||
            'private'
        );
    }

    function getUserId(ctx, msg) {
        return String(
            (ctx.player && ctx.player.userId) ||
            (msg.sender && msg.sender.userId) ||
            'unknown'
        );
    }

    function getUserName(ctx, msg) {
        return String(
            (ctx.player && ctx.player.name) ||
            (msg.sender && msg.sender.nickname) ||
            '钓鱼人'
        );
    }

    // 创建或读取玩家
    function getPlayer(data, groupId, userId, name, ctx) {
        if (!data.players) data.players = {};

        const pr=seal.vars.strGet(ctx,'$g地精档案编号表'),raw=Array.isArray(pr)?pr[0]:'';
        if(!raw)throw Error('请先注册营地角色。');
        let profiles;try{profiles=JSON.parse(raw)}catch(e){throw Error('营地档案存档损坏。')}
        const own=profiles.members&&profiles.members[userId],arr=Array.isArray(own)?own:own?[own]:[];
        const selected=arr.find(x=>x.id===(profiles.active||{})[userId])||arr[0];
        if(!selected)throw Error('请先注册营地角色。');
        const key = groupId + ':' + userId + ':' + String(selected.id).padStart(3,'0');

        // 旧存档迁移在初始化新档案之前进行。
        const legacyKey=groupId+':'+userId;
        if(!data.players[key] && data.players[legacyKey] && !data.players[legacyKey].h11MigratedTo){
            data.players[key]=JSON.parse(JSON.stringify(data.players[legacyKey]));
            data.players[legacyKey].h11MigratedTo=key;
            data.players[key].h11LegacyImportPending=true;
        }
        if (!data.players[key]) {
            data.players[key] = {
                id: userId,
                name: name,
                exp: 0,
                total: 0,
                bag: {},
                rareCount: 0,
                maxFish: null
            };
        }

        const p = data.players[key];
        // 首次读取旧图鉴时就同步历史鱼获，不要求再次钓鱼。
        if(p.h11LegacyImportPending){
            const result=seal.vars.strGet(ctx,'$mH11角色数据仓库');
            const rawStore=Array.isArray(result)?result[0]:'';
            let store={};if(rawStore){try{store=JSON.parse(rawStore)}catch(e){throw Error('角色背包存档损坏，未迁移历史鱼获。')}}
            const role=String(ctx.group&&(ctx.group.groupId||ctx.group.id)||groupId)+'::'+String(selected.id).padStart(3,'0');
            const bag=store[role]||{items:{}};
            if(!bag.items)bag.items={};
            if(!bag.items.fish)bag.items.fish={};
            for(const fish of Object.values(p.bag||{})){
                if(!bag.items.fish[fish.name])bag.items.fish[fish.name]={count:Math.max(0,Number(fish.count)||0),description:'旧钓鱼图鉴迁移'};
            }
            store[role]=bag;
            seal.vars.strSet(ctx,'$mH11角色数据仓库',JSON.stringify(store));
            p.h11LegacyImportPending=false;
        }
        p.name = selected.name || name || p.name;
        if (!p.bag) p.bag = {};
        if (typeof p.rareCount !== 'number') {
            p.rareCount = 0;
        }

        return p;
    }

    // 等级
    function getLevel(exp) {
        if (exp >= 1500) return '传奇钓手';
        if (exp >= 1000) return '资深钓手';
        if (exp >= 500) return '熟练钓手';
        if (exp >= 200) return '进阶钓手';
        if (exp >= 50) return '初级钓手';
        return '新手钓手';
    }

    // 按稀有度抽取
    function weightedRandom(list) {
        if (!list.length) return null;

        const total = list.reduce(
            (sum, fish) => sum + RARITY[fish.rarity].weight,
            0
        );

        let roll = Math.random() * total;

        for (const fish of list) {
            roll -= RARITY[fish.rarity].weight;
            if (roll < 0) return fish;
        }

        return list[list.length - 1];
    }

    // 根据鱼影大小生成游戏重量
    function randomGameplayWeight(fish) {
        const ranges = {
            '极小': [0.05, 0.5],
            '小': [0.2, 1],
            '中': [0.5, 2],
            '大': [1.5, 5],
            '特大': [3, 10],
            '巨大': [5, 15],
            '细长': [1, 8],
            '背鳍': [10, 100]
        };

        const range = ranges[fish.shadow] || [0.1, 2];

        return Number(
            (range[0] + Math.random() *
                (range[1] - range[0])).toFixed(2)
        );
    }

    // 将钓获同步写入「地精背包核心」的个人变量，保证跨群共享。
    // 钓鱼系统自己的存档仍保留，用于图鉴、重量、经验和排行榜。
    function addFishToSharedBackpack(ctx, player, caughtFish) {
        if (!seal.vars ||
            typeof seal.vars.strGet !== 'function' ||
            typeof seal.vars.strSet !== 'function') {
            throw new Error('无法访问共享背包变量，请确认已安装并启用「地精背包核心」。');
        }

        const profileResult=seal.vars.strGet(ctx,'$g地精档案编号表');
        const profileRaw=Array.isArray(profileResult)?profileResult[0]:'';
        if(!profileRaw)throw Error('请先注册营地角色。');
        let profiles;try{profiles=JSON.parse(profileRaw)}catch(e){throw Error('角色档案损坏，停止写入。')}
        const uid=String(ctx.player&&(ctx.player.userId||ctx.player.id)||'');
        const own=profiles.members&&profiles.members[uid],arr=Array.isArray(own)?own:own?[own]:[];
        const selected=arr.find(x=>x.id===(profiles.active||{})[uid])||arr[0];
        if(!selected)throw Error('请先注册营地角色。');
        const role=String(ctx.group&&(ctx.group.groupId||ctx.group.id)||'private')+'::'+String(selected.id).padStart(3,'0');
        const variableName='$mH11角色数据仓库';
        const result=seal.vars.strGet(ctx,variableName);
        const raw=Array.isArray(result)?result[0]:'';
        let store={};if(raw){try{store=JSON.parse(raw)}catch(e){throw Error('角色背包仓库损坏，停止写入。')}}
        let data=store[role]||{};
        if (!data.items || typeof data.items !== 'object') data.items = {};
        if (!data.items.fish || typeof data.items.fish !== 'object') {
            data.items.fish = {};
        }

        function addOneFish(fishName, count, description) {
            const amount = Math.max(0, Math.floor(Number(count) || 0));
            if (!fishName || amount < 1) return;
            const item = data.items.fish[fishName] || {
                count: 0,
                description: description || '钓鱼获得'
            };
            item.count = Math.max(0, Number(item.count) || 0) + amount;
            if (!item.description) item.description = description || '钓鱼获得';
            data.items.fish[fishName] = item;
        }

        // 颜色仅作为钓获文案，不参与背包物品键。
        // 本次钓获写入当前角色。
        addOneFish(caughtFish.name,1,caughtFish.location+' · '+RARITY[caughtFish.rarity].name);
        data.version = 2;
        store[role]=data;
        seal.vars.strSet(ctx, variableName, JSON.stringify(store));
    }

    // 钓鱼结算
    function catchFish(player, fish) {
        const rarity = RARITY[fish.rarity];
        const weight = randomGameplayWeight(fish);

        player.exp += rarity.exp;
        player.total += 1;

        const key = String(fish.id);

        if (!player.bag[key]) {
            player.bag[key] = {
                id: fish.id,
                name: fish.name,
                english: fish.english,
                rarity: rarity.name,
                stars: rarity.stars,
                count: 0,
                maxWeight: 0,
                location: fish.location
            };
        }

        player.bag[key].count += 1;

        player.bag[key].maxWeight = Math.max(
            player.bag[key].maxWeight,
            weight
        );

        if (fish.rarity === 'Rare') {
            player.rareCount += 1;
        }

        if (!player.maxFish || weight > player.maxFish.weight) {
            player.maxFish = {
                name: fish.name,
                weight: weight
            };
        }

        return {
            fish: fish,
            rarity: rarity,
            weight: weight
        };
    }

    // 钓鱼结果
    function formatCatch(result) {
        const f = result.fish;

        return [
            '🎣 【钓鱼结果】',
            '',
            '你钓上了：' + (result.displayName||f.name) + '！',
            '稀有度：' + result.rarity.stars +
                ' ' + result.rarity.name,
            '鱼影大小：' + f.shadow,
            '重量：' + result.weight + ' kg',
            '获得经验：+' + result.rarity.exp
        ].join('\n');
    }

    // 指令注册
    function registerCommand(name, help, handler) {
        const cmd = seal.ext.newCmdItemInfo();

        cmd.name = name;
        cmd.help = help;

        cmd.solve = (ctx, msg, cmdArgs) => {
            try {
                handler(ctx, msg, cmdArgs);
            } catch (e) {
                console.log('[ACNH钓鱼] 指令异常：' + e);

                seal.replyToSender(
                    ctx,
                    msg,
                    '钓鱼系统发生错误：' +
                    String(e.message || e)
                );
            }

            return seal.ext.newCmdExecuteResult(true);
        };

        ext.cmdMap[name] = cmd;
    }

    // 1. 开始钓鱼
    registerCommand(
        '钓鱼',
        '开始钓鱼，2秒后随机获得鱼类',
        (ctx, msg) => {
            const groupId = getGroupId(ctx, msg);
            const userId = getUserId(ctx, msg);
            const name = getUserName(ctx, msg);

            seal.replyToSender(
                ctx,
                msg,
                '🎣 会钓上来什么呢？'
            );

            setTimeout(() => {
                try {
                    const data = loadData();

                    const player = getPlayer(
                        data,
                        groupId,
                        userId,
                        name,
                        ctx
                    );

                    const fish = weightedRandom(ACTIVE_FISH);

                    if (!fish) {
                        throw new Error('鱼类列表为空');
                    }

                    const result = catchFish(player, fish);
                    result.displayName=fishDisplayName(fish);

                    // 同步到跨群共享背包；旧钓鱼存档继续保留图鉴和排行榜。
                    addFishToSharedBackpack(ctx, player, fish);
                    saveData(data);

                    seal.replyToSender(
                        ctx,
                        msg,
                        formatCatch(result)
                    );

                } catch (e) {
                    console.log('[ACNH钓鱼] 抽取失败：' + e);

                    seal.replyToSender(
                        ctx,
                        msg,
                        '🐟 钓鱼失败：' +
                        String(e.message || e)
                    );
                }
            }, 2000);
        }
    );

    // 2. 查看钓鱼信息
    registerCommand(
        '查看钓鱼信息',
        '查看个人钓鱼等级、经验和次数',
        (ctx, msg) => {
            const data = loadData();

            const player = getPlayer(
                data,
                getGroupId(ctx, msg),
                getUserId(ctx, msg),
                getUserName(ctx, msg),
                ctx
            );

            saveData(data);

            seal.replyToSender(
                ctx,
                msg,
                [
                    '🎣 【个人钓鱼信息】',
                    '玩家：' + player.name,
                    '等级：' + getLevel(player.exp),
                    '经验：' + player.exp,
                    '钓鱼次数：' + player.total,
                    '已收集鱼类：' +
                        Object.keys(player.bag).length + ' / 80 种',
                    '稀有鱼收获：' + player.rareCount + ' 条',
                    '最大收获：' +
                        (player.maxFish
                            ? player.maxFish.name + ' ' +
                                player.maxFish.weight + 'kg'
                            : '暂无')
                ].join('\n')
            );
        }
    );

    // 3. 查看背包
    registerCommand(
        '鱼篓',
        '查看所有已捕获鱼类',
        (ctx, msg) => {
            const data = loadData();

            const player = getPlayer(
                data,
                getGroupId(ctx, msg),
                getUserId(ctx, msg),
                getUserName(ctx, msg),
                ctx
            );

            const items = Object.values(player.bag).filter(item=>ACTIVE_FISH.some(f=>f.name===item.name));

            if (!items.length) {
                seal.replyToSender(
                    ctx,
                    msg,
                    '🎒 背包还是空的，快去钓鱼吧！'
                );
                return;
            }

            items.sort((a, b) => a.id - b.id);

            const lines = [
                '🎒 【' + player.name + '的钓鱼图鉴】',
                '已收集 ' + items.length + ' / ' + ACTIVE_FISH.length + ' 种（当前开放）',
                ''
            ];

            const groups = [
                ['普通', '★☆☆'],
                ['少见', '★★☆'],
                ['稀有', '★★★']
            ];

            for (const group of groups) {
                const list = items.filter(
                    item => item.rarity === group[0]
                );

                if (!list.length) continue;

                lines.push(
                    '【' + group[1] + ' ' + group[0] + '】'
                );

                for (const item of list) {
                    lines.push(
                        item.name + ' ×' + item.count +
                        ' | 最大 ' +
                        Number(item.maxWeight).toFixed(2) + 'kg'
                    );
                }

                lines.push('');
            }

            seal.replyToSender(
                ctx,
                msg,
                lines.join('\n')
            );
        }
    );

    // 4. 钓鱼排行榜
    registerCommand(
        '钓鱼排行',
        '查看经验、稀有鱼和最大鱼重量排行',
        (ctx, msg) => {
            const data = loadData();
            const groupId = getGroupId(ctx, msg);
            const prefix = groupId + ':';

            const players = Object.entries(
                data.players || {}
            )
                .filter(([key]) => key.startsWith(prefix))
                .map(([, value]) => value);

            function ranking(title, list, formatter) {
                if (!list.length) {
                    return '【' + title + '】\n暂无数据';
                }

                return '【' + title + '】\n' +
                    list.slice(0, 5).map(
                        (p, i) =>
                            (i + 1) + '. ' +
                            p.name + ' — ' + formatter(p)
                    ).join('\n');
            }

            const exp = players.slice().sort(
                (a, b) => b.exp - a.exp
            );

            const rare = players
                .filter(p => p.rareCount > 0)
                .sort((a, b) => b.rareCount - a.rareCount);

            const heavy = players
                .filter(p => p.maxFish)
                .sort(
                    (a, b) =>
                        b.maxFish.weight - a.maxFish.weight
                );

            seal.replyToSender(
                ctx,
                msg,
                [
                    '🏆 【钓鱼排行榜】',
                    '',
                    ranking(
                        '钓鱼经验',
                        exp,
                        p => p.exp + ' EXP'
                    ),
                    '',
                    ranking(
                        '稀有鱼收获',
                        rare,
                        p => p.rareCount + ' 条'
                    ),
                    '',
                    ranking(
                        '最大鱼重量',
                        heavy,
                        p => p.maxFish.name + ' ' +
                            p.maxFish.weight + 'kg'
                    )
                ].join('\n')
            );
        }
    );

    seal.ext.register(ext);

    console.log(
        '[ACNH钓鱼] v3.1.0 已注册，内置80种鱼类，无外部API。'
    );

})();