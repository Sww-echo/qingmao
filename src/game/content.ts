import type {
  EndingDef, EnemyDef, EventChoice, EventDef, GuDef, LocationDef,
  NpcDef, OriginDef, RecipeDef, ShopItem,
} from './types';

// 原创支线。数值、供养与少数品阶为十日行程做了简化；具体差异见各蛊说明。
export const GU: GuDef[] = [
  {
    id: 'moonlight', name: '月光蛊', glyph: '☾', rank: 1, role: 'attack',
    description: '催动月刃，造成 6 点伤害，消耗 2 真元。',
    lore: '古月一族常见的月道蛊，胜在招式简洁、消耗可控。',
    upkeep: 1, price: 14, ability: 'strike', power: 6, qiCost: 2, passive: false,
  },
  {
    id: 'little-light', name: '小光蛊', glyph: '✦', rank: 1, role: 'support',
    description: '携带时攻击伤害 +1，也增强攻击蛊的伤害。',
    lore: '原型能辅助月光蛊。本篇将协同效果简化为携带期间的攻击增益。',
    upkeep: 1, price: 7, ability: 'power', power: 1, qiCost: 0, passive: true,
  },
  {
    id: 'jade-skin', name: '玉皮蛊', glyph: '◇', rank: 1, role: 'defense',
    description: '消耗 2 真元，为下一次来袭增加 8 点防护。',
    lore: '皮肤浮现温润玉光。观察敌人蓄势，再催动护身，往往比硬拼划算。',
    upkeep: 1, price: 12, ability: 'guard', power: 8, qiCost: 2, passive: false,
  },
  {
    id: 'white-boar', name: '白豕蛊', glyph: '牙', rank: 1, role: 'support',
    description: '携带时攻击伤害 +2，也增强攻击蛊的伤害。',
    lore: '原型逐步增长使用者的力量；此处以携带期间的攻击加成表现。',
    upkeep: 2, price: 20, ability: 'power', power: 2, qiCost: 0, passive: true,
  },
  {
    id: 'liquor-worm', name: '酒虫', glyph: '酿', rank: 1, role: 'support',
    description: '战斗中用一回合整理真元，恢复最多 5 点真元。',
    lore: '原型擅长提炼真元。本篇将这项优势转为回气；使用时对手仍会行动。',
    upkeep: 2, price: 18, ability: 'restore', power: 5, qiCost: 0, passive: false,
  },
  {
    id: 'vitality-grass', name: '九叶生机草', glyph: '✿', rank: 2, role: 'support',
    description: '消耗 3 真元，恢复最多 10 点生命。',
    lore: '可生长治疗用的生机叶。本篇把取叶、使用合并为一次治疗动作。',
    upkeep: 2, price: 32, ability: 'heal', power: 10, qiCost: 3, passive: false,
  },
  {
    id: 'earth-ear', name: '地听肉耳草', glyph: '聆', rank: 2, role: 'scouting',
    description: '携带并保持苏醒，解锁地面听察的事件选项。',
    lore: '贴地分辨远处震动。能发现伏兽与暗渠，却不会替你决定该相信谁。',
    upkeep: 2, price: 24, ability: 'scout', power: 1, qiCost: 0, passive: true,
  },
  {
    id: 'flower-bag', name: '兜率花', glyph: '❀', rank: 2, role: 'economy',
    description: '携带时，当地劳作或采集的首种资源额外保留 2 份。',
    lore: '用于储存货物的花蛊。原著为三转，本篇简化为二转，并用减少运送损耗表现储物作用。',
    upkeep: 2, price: 32, ability: 'storage', power: 2, qiCost: 0, passive: true,
  },
  {
    id: 'jumping-grass', name: '跳跳草', glyph: '跃', rank: 1, role: 'movement',
    description: '携带时，普通撤退的成功率提高 20 个百分点。',
    lore: '借草叶弹力迅速转移脚步；也能在山涧绳桥的事件中派上用场。',
    upkeep: 1, price: 10, ability: 'escape', power: 2, qiCost: 0, passive: true,
  },
  {
    id: 'moon-glow', name: '月芒蛊', glyph: '☽', rank: 2, role: 'attack',
    description: '凝聚强力月芒，造成 11 点伤害，消耗 4 真元。',
    lore: '月光与两只小光合炼而成。威力显著提升，也更考验真元安排。',
    upkeep: 2, price: 36, ability: 'strike', power: 11, qiCost: 4, passive: false,
  },
  {
    id: 'white-jade', name: '白玉蛊', glyph: '璧', rank: 2, role: 'defense',
    description: '携带时，每次受到攻击的伤害减少 3，最低仍受 1 点。',
    lore: '由白豕蛊与玉皮蛊合炼。本篇将持续护体简化为自动减伤。',
    upkeep: 2, price: 36, ability: 'guard', power: 3, qiCost: 0, passive: true,
  },
  {
    id: 'moon-mark', name: '月痕蛊', glyph: '弧', rank: 2, role: 'attack',
    description: '以延伸的月刃稳稳出击，造成 8 点伤害，消耗 2 真元。',
    lore: '原型以射程见长。本篇以低耗攻击表现距离优势，配方以矿料替代痕石蛊。',
    upkeep: 2, price: 32, ability: 'strike', power: 8, qiCost: 2, passive: false,
  },
];

export const LOCATIONS: LocationDef[] = [
  {
    id: 'academy', name: '学堂', subtitle: '灯下温书 · 少年试锋', x: 23, y: 36, danger: 'safe',
    description: '课表上多了一项巡山实习。教习想知道的，是谁能把山里的消息完整带回来。',
    activity: { label: '誊抄典册', description: '耗 1 行动、1 真元；获得 4 元石与 1 修为。', effects: { resources: { stones: 4 }, qi: -1, cultivation: 1 } },
  },
  {
    id: 'market', name: '山寨市集', subtitle: '秤杆有价 · 消息难估', x: 64, y: 72, danger: 'safe',
    description: '十日后最后一班商队将启程。盐、酒与药草都有明码，船位和消息另有价钱。',
    activity: { label: '替商队搬货', description: '耗 1 行动、2 真元；获得 10 元石。', effects: { resources: { stones: 10 }, qi: -2 } },
  },
  {
    id: 'bamboo', name: '青竹林', subtitle: '风声如潮 · 足迹交错', x: 73, y: 22, danger: 'wild',
    description: '折断的矛竹指向旧巡山路。草药、野兽和另一队寻路人都藏在竹影后。',
    activity: { label: '采集药草', description: '耗 1 行动、2 生命；获得 3 药草。', effects: { resources: { herbs: 3 }, hp: -2 } },
  },
  {
    id: 'stream', name: '听雨涧', subtitle: '溪声藏字 · 旧桥半断', x: 81, y: 46, danger: 'wild',
    description: '水退后，河石露出人工刻痕。巡山人的伤药用尽，桥另一端还有未回收的货物。',
    activity: { label: '淘洗矿料', description: '耗 1 行动、2 生命；获得 2 矿料。', effects: { resources: { ore: 2 }, hp: -2 } },
  },
  {
    id: 'cave', name: '石灯遗藏', subtitle: '一灯未灭 · 三路可进', x: 43, y: 13, danger: 'danger',
    description: '废弃的灯室没有主人的名字。三条线索能拼出开门次序，但守关木傀还在运转。',
    activity: { label: '凿取壁矿', description: '耗 1 行动、4 生命；获得 3 矿料，疑心 +2。', effects: { resources: { ore: 3 }, hp: -4, suspicion: 2 } },
  },
  {
    id: 'clan', name: '议事楼', subtitle: '一纸约定 · 各有算盘', x: 24, y: 69, danger: 'safe',
    description: '宗族愿意支付保护的代价，也要求可靠的回报。交出什么、留下什么，由你自己衡量。',
    activity: { label: '协助清点公仓', description: '耗 1 行动、1 真元；获得 5 元石，宗族信任 +3。', effects: { resources: { stones: 5 }, qi: -1, trust: 3 } },
  },
];

export const ORIGINS: OriginDef[] = [
  {
    id: 'disciple', name: '守拙', subtitle: '学堂弟子 · 以稳求进',
    description: '你在族中读过几年典册，起步略有修为和信任。月光与小光的搭配足以应付第一场试炼。',
    gu: ['moonlight', 'little-light'], resources: { stones: 24, herbs: 2, ore: 1, wine: 0 }, trust: 18, cultivation: 3,
  },
  {
    id: 'scout', name: '寻幽', subtitle: '山野行者 · 进退有路',
    description: '你熟悉湿滑的山道，随身留了应急材料。跳跳草增加撤退机会，适合先探索再决定去路。',
    gu: ['moonlight', 'jumping-grass'], resources: { stones: 26, herbs: 3, ore: 2, wine: 0 }, trust: 6, cultivation: 0,
  },
  {
    id: 'trader', name: '行商', subtitle: '商队随行 · 留一分余地',
    description: '你带来的元石与酒比旁人多，酒虫能在交锋间回气。想把本钱变成自由，还要找到值钱的消息。',
    gu: ['moonlight', 'liquor-worm'], resources: { stones: 38, herbs: 1, ore: 1, wine: 2 }, trust: 4, cultivation: 0,
  },
];

export const NPCS: NpcDef[] = [
  { id: 'mentor-qiu', name: '古月秋衡', role: '学堂教习', motive: '用实绩判断弟子，愿意为守约的人多开一堂课。', location: 'academy' },
  { id: 'scout-lan', name: '兰渡', role: '巡山队领路人', motive: '先把失散的人带回，再谈功劳；会回报帮过她的人。', location: 'stream' },
  { id: 'merchant-yan', name: '严砚', role: '商队账房', motive: '货要送到，钱要算清；肯给可靠的合作者留一份佣金。', location: 'market' },
  { id: 'steward-zheng', name: '古月正岑', role: '公仓执事', motive: '把遗藏纳入宗族，也需要一名真正懂得山路的代理人。', location: 'clan' },
  { id: 'healer-su', name: '苏蘅', role: '采药蛊师', motive: '寻找稳定药源，不愿让伤者替别人的寻宝野心付账。', location: 'bamboo' },
  { id: 'fang-yuan', name: '方源', role: '另一位寻路人', motive: '用尽量小的代价取得机缘。掌握自己的线索，也会履行有利的交换。', location: 'bamboo' },
];

const leave = (outcome: string): EventChoice => ({
  id: 'leave', label: '放弃本次机会', description: '保留手中资源；本次行程不再提供这次机会。', effects: {}, outcome,
});

const defer = (outcome: string): EventChoice => ({
  id: 'leave', label: '暂时离开', description: '保留手中资源；期限到来前，条件满足时可以再来。', effects: {}, outcome,
});

export const EVENTS: EventDef[] = [
  {
    id: 'academy-roster', title: '巡山名册上的空位', location: 'academy', tag: '起行', priority: 120,
    description: '教习把三张旧地图摊在桌上：竹林有新足迹，听雨涧有旧刻痕，市集有人收购断页。最后一班商队十日后离山，你每天有三次日间行动可用。',
    choices: [
      { id: 'take-patrol', label: '接下巡山差事', description: '消耗 2 真元；修为 +2、信任 +8，获得巡山凭据。', requirements: [{ kind: 'stat', key: 'qi', min: 2 }], effects: { qi: -2, cultivation: 2, trust: 8, relations: { 'mentor-qiu': 10 }, addFlags: ['patrol-order', 'heard-rumor'] }, outcome: '秋衡给了你一枚木签。巡山结果可以带去议事楼，你也可以先查清消息的真正价值。' },
      { id: 'help-copy', label: '先誊一份地图挣路费', description: '消耗 3 真元；获得 7 元石、1 修为。', requirements: [{ kind: 'stat', key: 'qi', min: 3 }], effects: { qi: -3, cultivation: 1, resources: { stones: 7 }, addFlags: ['heard-rumor'] }, outcome: '你以半日工夫换到了路费。三个去处都记下了，但还没有任何一条线索经过验证。' },
      leave('你放弃了这次巡山与誊图的差事，记住三个方向，自行安排后续行程。'),
    ],
  },
  {
    id: 'academy-assessment', title: '不是只看资质的考核', location: 'academy', tag: '修行', dayMin: 2, priority: 55,
    requirements: [{ kind: 'stat', key: 'cultivation', min: 3 }],
    description: '秋衡让两名弟子对练，要求先报出对手的动作，再决定进退。赢下切磋能领赏，也可以只留下补完基本功。',
    choices: [
      { id: 'spar', label: '请同门指教', description: '进入切磋；获胜另得 6 元石、3 修为与 8 信任。', effects: {}, encounterId: 'road-duelist', victoryEffects: { resources: { stones: 6 }, cultivation: 3, trust: 8, relations: { 'mentor-qiu': 12 }, addFlags: ['mentor-promise'] }, victoryText: '你没有被对方的虚招骗过。秋衡答应为你单独讲解一次温养空窍。', defeatEffects: { trust: -2 }, outcome: '你走上练武坪。对方会先架起护势，观察下一招再出手。' },
      { id: 'practice', label: '练完基础步法', description: '消耗 3 真元；修为 +3，与教习关系 +6。', requirements: [{ kind: 'stat', key: 'qi', min: 3 }], effects: { qi: -3, cultivation: 3, relations: { 'mentor-qiu': 6 }, addFlags: ['mentor-promise'] }, outcome: '你一遍遍调整步法。秋衡认可这份耐心，也答应日后给你一次单独指点。' },
      leave('你放弃了这次考核，把体力留给山路。'),
    ],
  },
  {
    id: 'academy-private-lesson', title: '灯下的一次指点', location: 'academy', tag: '人情', priority: 60,
    requirements: [{ kind: 'flag', key: 'mentor-promise' }],
    description: '你此前的表现让秋衡愿意多留一刻。他把温养空窍的关键圈在纸上，所需药墨仍要你自己准备。',
    choices: [
      { id: 'take-lesson', label: '备好药墨，完整听讲', description: '支付 4 元石、2 真元；修为 +5，教习关系 +8。', requirements: [{ kind: 'resource', key: 'stones', min: 4 }, { kind: 'stat', key: 'qi', min: 2 }], effects: { resources: { stones: -4 }, qi: -2, cultivation: 5, relations: { 'mentor-qiu': 8 } }, outcome: '此前积累的人情终于换来了一次实在的点拨。你能更稳地判断突破二转的时机。' },
      { id: 'take-notes', label: '用手中药草换一页讲义', description: '消耗 1 药草；修为 +2、信任 +2。', requirements: [{ kind: 'resource', key: 'herbs', min: 1 }], effects: { resources: { herbs: -1 }, cultivation: 2, trust: 2 }, outcome: '你没有听完整堂课，但把最关键的口诀抄进了自己的笔记。' },
      leave('你谢过教习，放弃这次指点，把机会让给了仍等在门外的人。'),
    ],
  },
  {
    id: 'academy-rations', title: '练武坪的药包', location: 'academy', tag: '补给', dayMin: 3, priority: 35,
    description: '昨日切磋留下几名伤员，学堂药包已经见底。秋衡会照价补钱，但你也得为自己的野外行程留药。',
    choices: [
      { id: 'supply-herbs', label: '匀出两份药草', description: '消耗 2 药草；获得 9 元石、3 信任。', requirements: [{ kind: 'resource', key: 'herbs', min: 2 }], effects: { resources: { herbs: -2, stones: 9 }, trust: 3, relations: { 'mentor-qiu': 5 } }, outcome: '药草被分成小包，账上也记下了你的名字。买卖没有白做，自己的储备却薄了一层。' },
      { id: 'bandage', label: '帮忙处理轻伤', description: '消耗 2 真元；获得 4 元石、2 信任。', requirements: [{ kind: 'stat', key: 'qi', min: 2 }], effects: { qi: -2, resources: { stones: 4 }, trust: 2 }, outcome: '你换了几次清水，把这份报酬挣得干干净净。' },
      leave('你放弃了这次药包委托，保留自己的应急药。'),
    ],
  },
  {
    id: 'academy-hearing', title: '关于夜间出入的询问', location: 'academy', tag: '疑心', priority: 85,
    requirements: [{ kind: 'stat', key: 'suspicion', min: 12 }],
    description: '你最近的行踪引来了议论。秋衡愿意听解释，但空口保证已经不够；你必须决定交出多少真消息。',
    choices: [
      { id: 'share-detail', label: '公开一条已经核实的线索', description: '情报 -1；疑心 -12、信任 +5。', requirements: [{ kind: 'stat', key: 'clues', min: 1 }], effects: { clues: -1, suspicion: -12, trust: 5, relations: { 'mentor-qiu': 5 } }, outcome: '一部分独家情报从此不再独家。你换来了喘息的余地，也让更多人知道山中有值得寻找的东西。' },
      { id: 'submit-records', label: '请人核对你的往来记录', description: '支付 7 元石；疑心 -8。', requirements: [{ kind: 'resource', key: 'stones', min: 7 }], effects: { resources: { stones: -7 }, suspicion: -8 }, outcome: '买卖记录能澄清一部分传闻，但无法让每个人都满意。' },
      leave('你放弃这次解释机会。原有的疑心依然在，往后行动要更留意别人看见了什么。'),
    ],
  },
  {
    id: 'market-ledger', title: '被裁去一角的运货单', location: 'market', tag: '情报', priority: 110,
    description: '严砚手里有张旧运货单，写着向石灯坡送过灯油与木傀零件。买主不止一个，他可以收钱，也可以收如今短缺的货。',
    choices: [
      { id: 'buy-ledger', label: '花八块元石买下断页', description: '支付 8 元石；情报 +1，账房关系 +5。', requirements: [{ kind: 'resource', key: 'stones', min: 8 }], effects: { resources: { stones: -8 }, clues: 1, relations: { 'merchant-yan': 5 }, addFlags: ['ledger-copy'] }, outcome: '断页上的交货时辰与灯室通风口对应。你得到了一条可以实地核验的线索。' },
      { id: 'barter-ledger', label: '用药草和矿料换断页', description: '消耗 2 药草、1 矿料；情报 +1，账房关系 +7。', requirements: [{ kind: 'resource', key: 'herbs', min: 2 }, { kind: 'resource', key: 'ore', min: 1 }], effects: { resources: { herbs: -2, ore: -1 }, clues: 1, relations: { 'merchant-yan': 7 }, addFlags: ['ledger-copy'] }, outcome: '严砚验过材料，把断页推到你面前。你省下了元石，合炼的辅材却要重新筹措。' },
      leave('你放弃了这次断页交易，可以从其他尚未探查的地点寻找情报。'),
    ],
  },
  {
    id: 'market-cargo', title: '最后一箱没回来的货', location: 'market', tag: '委托', dayMax: 6, priority: 75,
    description: '一名独行劫匪扣住了商队的灯油。严砚愿意把追回货物的人当作长期合作者，也接受替代的酒料抵账。',
    choices: [
      { id: 'recover-cargo', label: '循车辙追上劫匪', description: '进入战斗；获胜另得 5 元石，并与账房建立互惠约定。', effects: {}, encounterId: 'courier-thief', victoryEffects: { resources: { stones: 5 }, relations: { 'merchant-yan': 18 }, addFlags: ['merchant-pact'] }, victoryText: '灯油回到货车上。严砚答应再给你一笔回程佣金，凭这份交情可以来市集找他。', defeatEffects: { relations: { 'merchant-yan': -3 } }, outcome: '你在山道弯口找到货箱。对方掂了掂短刃，堵住了回去的路。' },
      { id: 'replace-cargo', label: '以酒料补上缺口', description: '消耗 2 酒；获得 7 元石，账房关系 +12，达成互惠约定。', requirements: [{ kind: 'resource', key: 'wine', min: 2 }], effects: { resources: { wine: -2, stones: 7 }, relations: { 'merchant-yan': 12 }, addFlags: ['merchant-pact'] }, outcome: '你提供的酒料可兑入灯油，货单终于能结清。严砚愿意把下一份小生意留给你。' },
      leave('你放弃了这次追货委托，严砚转而寻找能把货拿回来的人。'),
    ],
  },
  {
    id: 'market-commission', title: '先前那份交情', location: 'market', tag: '人情', priority: 220,
    requirements: [{ kind: 'flag', key: 'merchant-pact' }],
    description: '严砚认得你。先前的合作让他愿意兑现额外佣金，或者低价转让一只储物花蛊；只能选其一。',
    choices: [
      { id: 'claim-commission', label: '结清回程佣金', description: '获得 8 元石、1 酒；兑现此前的约定。', effects: { resources: { stones: 8, wine: 1 }, relations: { 'merchant-yan': 4 }, addFlags: ['merchant-settled'] }, outcome: '八块元石与一小坛酒压在账单上。这是先前守约挣来的回报，账也就此两清。' },
      { id: 'buy-friend-flower', label: '以熟客价接下兜率花', description: '支付 19 元石；获得 1 只兜率花，需二转装备。', requirements: [{ kind: 'resource', key: 'stones', min: 19 }], effects: { resources: { stones: -19 }, gu: { 'flower-bag': 1 }, relations: { 'merchant-yan': 4 }, addFlags: ['merchant-settled'] }, outcome: '你把一次性的佣金机会换成了储物工具。突破二转后，它才能为你的劳作多保留一些收获。' },
      leave('你谢绝了这次回报，佣金与熟客转让的机会一并作罢。'),
    ],
  },
  {
    id: 'market-vendor', title: '一价两只的小光蛊', location: 'market', tag: '合炼', dayMin: 2, priority: 50,
    description: '摊主需要马上筹到路费，愿意把两只小光一起卖掉。你知道月光与两只小光可以合炼，但还得准备辅材与供养钱。',
    choices: [
      { id: 'buy-pair', label: '收下这一对小光', description: '支付 12 元石；获得 2 只小光蛊。', requirements: [{ kind: 'resource', key: 'stones', min: 12 }], effects: { resources: { stones: -12 }, gu: { 'little-light': 2 } }, outcome: '两点微光落进蛊囊。同种蛊不能重复装备，但两只都是月芒合炼需要的实物。' },
      { id: 'trade-pair', label: '拿四份矿料换蛊', description: '消耗 4 矿料；获得 2 只小光蛊。', requirements: [{ kind: 'resource', key: 'ore', min: 4 }], effects: { resources: { ore: -4 }, gu: { 'little-light': 2 } }, outcome: '矿料正是摊主缺的货。你换到了合炼用蛊，之后还要重新找些矿料做辅材。' },
      leave('你放弃这次打包折价，留住本钱；若货架还有余货，仍可按单只价格购买小光蛊。'),
    ],
  },
  {
    id: 'market-departure', title: '留给你的一个离山名额', location: 'market', tag: '去路', dayMin: 6, priority: 200, repeatable: true,
    requirements: [{ kind: 'stat', key: 'clues', min: 1 }, { kind: 'resource', key: 'stones', min: 35 }],
    description: '商队开始分批离寨。你掌握的山路情报足以证明能帮上忙，但护送和沿途给养仍需三十五块元石。跨出寨门，就不再争这次遗藏。',
    choices: [
      { id: 'book-passage', label: '付清路费，随队离山', description: '支付 35 元石；主动达成「离山」结局。', requirements: [{ kind: 'stat', key: 'day', min: 6 }, { kind: 'stat', key: 'clues', min: 1 }, { kind: 'resource', key: 'stones', min: 35 }], effects: { resources: { stones: -35 }, relations: { 'merchant-yan': 5 } }, ending: 'departure', outcome: '你交付了路费与沿路情报，换来有护卫的行程。你带走自己的蛊与见识，主动选择了更远的地方。' },
      defer('名额尚未落定。十日期限前，条件齐备时仍可回来；你现在可以继续自己的行程。'),
    ],
  },
  {
    id: 'bamboo-tracks', title: '朝向旧坡的两行足迹', location: 'bamboo', tag: '情报', priority: 120,
    description: '新泥上有一深一浅两行脚印，通往没有标注的石坡。查到尽头要离开安全山道，衣物很可能被矛竹划破。',
    choices: [
      { id: 'read-tracks', label: '沿足迹辨清入口方向', description: '消耗 2 真元、2 生命；情报 +1，获得旧坡方位。', requirements: [{ kind: 'stat', key: 'qi', min: 2 }, { kind: 'stat', key: 'hp', min: 3 }], effects: { qi: -2, hp: -2, clues: 1, addFlags: ['bamboo-bearing'] }, outcome: '你从竹叶擦痕确认来人背着沉物，目标正是石灯遗藏。入口方位终于有了根据。' },
      { id: 'listen-tracks', label: '以地听肉耳草听辨空洞', description: '需装备苏醒的地听肉耳草；消耗 1 真元，情报 +1。', requirements: [{ kind: 'gu', id: 'earth-ear', equipped: true }, { kind: 'stat', key: 'qi', min: 1 }], effects: { qi: -1, clues: 1, addFlags: ['bamboo-bearing'] }, outcome: '地底回声绕过了竹林。你不必踩进荆棘，也确定了旧坡下的空腔。' },
      leave('你放弃追踪这批足迹，未能确认它们的去向，需要另找线索。'),
    ],
  },
  {
    id: 'bamboo-boar', title: '拱翻药篓的山豕', location: 'bamboo', tag: '遭遇', priority: 60,
    description: '一头山豕守着被拱开的草窝。附近采药人的货还在，你能夺回材料，也可以拿气味浓烈的酒把它引走。',
    choices: [
      { id: 'hunt-boar', label: '逼开山豕，取回货物', description: '进入战斗；获胜额外获得 2 药草，与采药人关系 +5。', effects: {}, encounterId: 'bamboo-boar', victoryEffects: { resources: { herbs: 2 }, relations: { 'healer-su': 5 } }, victoryText: '草窝没有再动。你留下别人认领的药篓，带走了约定的酬劳与散落的草药。', defeatEffects: { suspicion: 2 }, outcome: '山豕压低獠牙。它会先冲撞，随后缩身护住要害。' },
      { id: 'lure-boar', label: '洒酒引它离开', description: '消耗 1 酒；获得 2 药草、3 元石。', requirements: [{ kind: 'resource', key: 'wine', min: 1 }], effects: { resources: { wine: -1, herbs: 2, stones: 3 } }, outcome: '浓烈气味把山豕引向另一片草地。你拿到少量报酬，却没有取得狩猎的修行经验。' },
      leave('你绕开草窝，保住了体力，也把这份机会留给后来的人。'),
    ],
  },
  {
    id: 'bamboo-herbalist', title: '苏蘅缺的一味药', location: 'bamboo', tag: '人情', priority: 75,
    description: '苏蘅正在给巡山人止血，手边缺两份清热药。她说伤者稳住后，可以带你辨认涧底的旧记号。',
    choices: [
      { id: 'give-herbs', label: '把两份药草交给她', description: '消耗 2 药草；信任 +5、采药人关系 +15，获得后续回报机会。', requirements: [{ kind: 'resource', key: 'herbs', min: 2 }], effects: { resources: { herbs: -2 }, trust: 5, relations: { 'healer-su': 15 }, addFlags: ['healer-pact'] }, outcome: '伤者的呼吸渐稳。苏蘅约你在听雨涧见面，到时她会拿自己知道的事作回报。' },
      { id: 'help-carry', label: '帮忙把伤者背回山道', description: '消耗 4 生命、2 真元；信任 +4，采药人关系 +10，获得后续回报机会。', requirements: [{ kind: 'stat', key: 'hp', min: 5 }, { kind: 'stat', key: 'qi', min: 2 }], effects: { hp: -4, qi: -2, trust: 4, relations: { 'healer-su': 10 }, addFlags: ['healer-pact'] }, outcome: '你没有给出药草，却付出了真实的体力。苏蘅记下这份帮助，约你在听雨涧见。' },
      leave('你放弃这次援助。苏蘅继续照顾伤者，没有与你约定后续会面。'),
    ],
  },
  {
    id: 'bamboo-fangyuan', title: '半页地图的交换', location: 'bamboo', tag: '竞逐', priority: 80,
    requirements: [{ kind: 'stat', key: 'clues', min: 1 }],
    description: '方源在竹影里晾干半张拓印。他知道一段排水暗槽，你知道旧坡有人来往。双方只交换讲清楚的那部分，各自保留底牌。',
    choices: [
      { id: 'trade-supplies', label: '以一坛酒和矿料换取暗槽图', description: '消耗 1 酒、1 矿料；情报 +1，方源关系 +8，疑心 +3。', requirements: [{ kind: 'resource', key: 'wine', min: 1 }, { kind: 'resource', key: 'ore', min: 1 }], effects: { resources: { wine: -1, ore: -1 }, clues: 1, suspicion: 3, relations: { 'fang-yuan': 8 }, addFlags: ['fang-trade'] }, outcome: '你当场比对暗槽与水流，拓印确实有用。方源拿走约定的材料，没有索要你未曾承诺的消息。' },
      { id: 'agree-boundary', label: '先约定互不阻断退路', description: '支付 3 元石作标记物；疑心 -2，方源关系 +5，可在遗藏处兑现约定。', requirements: [{ kind: 'resource', key: 'stones', min: 3 }], effects: { resources: { stones: -3 }, suspicion: -2, relations: { 'fang-yuan': 5 }, addFlags: ['fang-boundary'] }, outcome: '你们各留一处不封堵的通路标记。合作范围很窄，却足够在有人抢先时避免无谓冲突。' },
      leave('你放弃这次交换或立约。双方收起各自的地图，各走各的路。'),
    ],
  },
  {
    id: 'bamboo-eargrass', title: '会听地声的草', location: 'bamboo', tag: '蛊虫', dayMin: 3, priority: 50,
    requirements: [{ kind: 'stat', key: 'rank', min: 2 }],
    description: '树根下，一株地听肉耳草贴着地面轻轻振动。苏蘅愿意教你将它带走，但维持这片草床需要你的药与酒。',
    choices: [
      { id: 'transplant-ear', label: '留下养料，取走草蛊', description: '消耗 3 药草、1 酒；获得地听肉耳草。', requirements: [{ kind: 'resource', key: 'herbs', min: 3 }, { kind: 'resource', key: 'wine', min: 1 }], effects: { resources: { herbs: -3, wine: -1 }, gu: { 'earth-ear': 1 }, relations: { 'healer-su': 5 } }, outcome: '你没有毁掉整片草床。地听肉耳草收入蛊囊，装备且供养后，就能在特定地点听辨暗处的动静。' },
      { id: 'study-roots', label: '只研究根系的反应', description: '消耗 2 真元；修为 +2，获得 1 药草。', requirements: [{ kind: 'stat', key: 'qi', min: 2 }], effects: { qi: -2, cultivation: 2, resources: { herbs: 1 } }, outcome: '你暂时不增加供养负担，带回了少量草药和一页观察记录。' },
      leave('你放弃这次移植与观察，保留了自己的材料。'),
    ],
  },
  {
    id: 'stream-rubbing', title: '水线之下的刻字', location: 'stream', tag: '情报', priority: 120,
    description: '水退后露出的石面刻着三个灯盏，不同水位各对一个刻槽。要把纹路拓完整，得用药汁显色，并在冷水里多站一阵。',
    choices: [
      { id: 'make-rubbing', label: '用药汁拓下水位刻痕', description: '消耗 1 药草、1 真元；情报 +1。', requirements: [{ kind: 'resource', key: 'herbs', min: 1 }, { kind: 'stat', key: 'qi', min: 1 }], effects: { resources: { herbs: -1 }, qi: -1, clues: 1, addFlags: ['water-rubbing'] }, outcome: '三道水线对应灯室的三次换气。你将拓片晒干，确认它与遗藏的开门顺序有关。' },
      { id: 'trace-by-hand', label: '徒手摸出完整刻槽', description: '消耗 5 生命、2 真元；情报 +1。', requirements: [{ kind: 'stat', key: 'hp', min: 6 }, { kind: 'stat', key: 'qi', min: 2 }], effects: { hp: -5, qi: -2, clues: 1, addFlags: ['water-rubbing'] }, outcome: '冰冷的溪水让手指失去知觉，但你逐一确认了刻槽，没有把猜想当成事实。' },
      leave('你放弃这次取拓，没有下水；若还缺开门线索，需要从别处补齐。'),
    ],
  },
  {
    id: 'stream-rope', title: '桥另一端的巡山人', location: 'stream', tag: '委托', priority: 80,
    description: '兰渡的绳桥断了一半。她需要有人送去替换的扣件；硬涉水能过去，跳跳草则能借着两块落脚石越过急流。',
    choices: [
      { id: 'jump-across', label: '借跳跳草送去扣件', description: '需装备苏醒的跳跳草；消耗 1 矿料、1 真元，获得 9 元石、4 信任。', requirements: [{ kind: 'gu', id: 'jumping-grass', equipped: true }, { kind: 'resource', key: 'ore', min: 1 }, { kind: 'stat', key: 'qi', min: 1 }], effects: { resources: { ore: -1, stones: 9 }, qi: -1, trust: 4, relations: { 'scout-lan': 12 }, addFlags: ['scout-pact'] }, outcome: '你踩着落脚石把扣件送到。兰渡记下这次帮助，愿意为你的巡山报告作证。' },
      { id: 'ford-stream', label: '绑紧绳索，涉水送件', description: '消耗 1 矿料、5 生命、2 真元；获得 11 元石、4 信任。', requirements: [{ kind: 'resource', key: 'ore', min: 1 }, { kind: 'stat', key: 'hp', min: 6 }, { kind: 'stat', key: 'qi', min: 2 }], effects: { resources: { ore: -1, stones: 11 }, hp: -5, qi: -2, trust: 4, relations: { 'scout-lan': 12 }, addFlags: ['scout-pact'] }, outcome: '湍流划伤了你的小腿。桥重新连上，兰渡把更高的报酬付给了真正下水的人。' },
      leave('你放弃送件，兰渡转向别处求助，你保住了手边的材料。'),
    ],
  },
  {
    id: 'stream-wolf', title: '浅滩上的独狼', location: 'stream', tag: '遭遇', dayMin: 2, priority: 60,
    description: '一头落单的山狼堵住采石人的回程。它不肯离开水边，像是在看守什么。战胜它能拿到酬劳，地听也许能查清原因。',
    choices: [
      { id: 'fight-wolf', label: '正面赶走独狼', description: '进入战斗；获胜额外获得 2 矿料、3 信任。', effects: {}, encounterId: 'stream-wolf', victoryEffects: { resources: { ore: 2 }, trust: 3, relations: { 'scout-lan': 5 } }, victoryText: '采石人得以离开浅滩，把答应的矿料交给了你。', defeatEffects: { suspicion: 2 }, outcome: '狼在石间压低身子，准备扑击。它会逼你浪费真元，留意自己的余力。' },
      { id: 'hear-den', label: '以地听确认它的巢穴', description: '需装备苏醒的地听肉耳草；消耗 2 真元，获得 5 元石、1 情报。', requirements: [{ kind: 'gu', id: 'earth-ear', equipped: true }, { kind: 'stat', key: 'qi', min: 2 }], effects: { qi: -2, resources: { stones: 5 }, clues: 1, relations: { 'scout-lan': 4 } }, outcome: '你听到幼兽抓石的声音，也发现狼穴绕过了一段旧灯室暗道。采石人换路离开，付了你一份指路钱。' },
      leave('你绕开浅滩，放弃了这次驱狼或探巢的机会。'),
    ],
  },
  {
    id: 'stream-hidden-pouch', title: '石缝里的包袱', location: 'stream', tag: '取舍', priority: 45,
    requirements: [{ kind: 'flag', key: 'water-rubbing' }],
    description: '依照拓片的位置，你在石缝发现一只新包袱，布角绣着公仓的记号。里面是玉皮蛊与一小袋元石，不像无主旧物。',
    choices: [
      { id: 'return-pouch', label: '封好包袱，送还公仓', description: '消耗 2 真元跑一趟；获得 6 元石、8 信任，执事关系 +10。', requirements: [{ kind: 'stat', key: 'qi', min: 2 }], effects: { qi: -2, resources: { stones: 6 }, trust: 8, relations: { 'steward-zheng': 10 }, addFlags: ['returned-pouch'] }, outcome: '正岑点清了东西，把酬劳给你。日后你递交山中消息时，他会记得这次归还。' },
      { id: 'keep-pouch', label: '取走蛊与元石', description: '获得玉皮蛊与 7 元石；疑心 +12、信任 -6，执事关系 -12。', effects: { gu: { 'jade-skin': 1 }, resources: { stones: 7 }, suspicion: 12, trust: -6, relations: { 'steward-zheng': -12 }, addFlags: ['kept-pouch'] }, outcome: '收获来得很快，包袱失踪却一定会有人追问。你多了一只防御蛊，也多了一件要解释的事。' },
      leave('你没有碰包袱，放弃了这次处理它的机会。'),
    ],
  },
  {
    id: 'stream-healer-return', title: '苏蘅记得那次帮忙', location: 'stream', tag: '人情', priority: 90,
    requirements: [{ kind: 'flag', key: 'healer-pact' }],
    description: '苏蘅如约而来。她能够告诉你灯室草纹的含义，也愿意用随身药先把你的伤治好；眼下的余暇只够做一件。',
    choices: [
      { id: 'learn-herb-code', label: '请她辨认灯室草纹', description: '情报 +1，采药人关系 +5；兑现此前的帮助。', effects: { clues: 1, relations: { 'healer-su': 5 }, addFlags: ['herb-code'] }, outcome: '草纹标出了旧主人存放解毒药的位置，顺序也能与灯盏刻槽对应。此前的帮助换成了一条确切消息。' },
      { id: 'take-treatment', label: '请她处理自己的伤', description: '生命最多恢复 12，获得 1 药草；兑现此前的帮助。', effects: { hp: 12, resources: { herbs: 1 }, relations: { 'healer-su': 5 } }, outcome: '她替你清理伤口，留下一小包药。这次你选择保住走完山路的体力。' },
      leave('你谢过苏蘅，没有接受这次回报。她收好药，继续照顾其他巡山人。'),
    ],
  },
  {
    id: 'clan-patrol-report', title: '有人肯为你的报告作证', location: 'clan', tag: '宗族', priority: 100,
    requirements: [{ kind: 'flag', key: 'patrol-order' }, { kind: 'stat', key: 'clues', min: 1 }],
    description: '正岑需要的是可核查的巡山结果。你可以交一份简报，也可以请此前合作过的兰渡证明山路情况。',
    choices: [
      { id: 'witness-report', label: '请兰渡共同署名', description: '需先帮助过巡山人；信任 +12、获得 9 元石。', requirements: [{ kind: 'flag', key: 'scout-pact' }], effects: { trust: 12, resources: { stones: 9 }, relations: { 'scout-lan': 5, 'steward-zheng': 8 }, addFlags: ['report-filed'] }, outcome: '兰渡核对了你说的每个转弯。正岑不再把这份报告当作寻宝者的自说自话。' },
      { id: 'file-report', label: '交上自己署名的简报', description: '消耗 1 真元整理；信任 +8，获得 5 元石。', requirements: [{ kind: 'stat', key: 'qi', min: 1 }], effects: { qi: -1, trust: 8, resources: { stones: 5 }, relations: { 'steward-zheng': 5 }, addFlags: ['report-filed'] }, outcome: '你交出了入口周边的情况，保留了核心开门顺序。宗族认可这份工作，至于下一步还要再谈。' },
      leave('你放弃了这次呈报，没有领取差事报酬。木签只留下你曾接过委托的记录。'),
    ],
  },
  {
    id: 'clan-grain', title: '仓单上的缺口', location: 'clan', tag: '取舍', dayMin: 2, priority: 65,
    description: '公仓一批药草受了潮，执事希望补齐损耗再交账。你可以按实情帮忙，也可以收一笔钱，在旧仓单上照常画押。',
    choices: [
      { id: 'replace-herbs', label: '补进三份干燥药草', description: '消耗 3 药草；获得 8 元石、8 信任。', requirements: [{ kind: 'resource', key: 'herbs', min: 3 }], effects: { resources: { herbs: -3, stones: 8 }, trust: 8, relations: { 'steward-zheng': 7 }, addFlags: ['honest-ledger'] }, outcome: '仓单按实际入库重新誊写。你拿了合理的工钱，也让自己的名字与一笔能查清的账相连。' },
      { id: 'sign-old-ledger', label: '收钱，在旧仓单上画押', description: '获得 15 元石；疑心 +14、信任 -7。', effects: { resources: { stones: 15 }, suspicion: 14, trust: -7, relations: { 'steward-zheng': -4 }, addFlags: ['false-ledger'] }, outcome: '钱袋比正常酬劳重得多。空缺并没有被填上，签名却真实地留在了旧纸上。' },
      leave('你拒绝替这笔仓账签名，放弃了这次补损的酬劳。'),
    ],
  },
  {
    id: 'clan-bargain', title: '先给一份诚意', location: 'clan', tag: '交涉', priority: 70,
    requirements: [{ kind: 'stat', key: 'clues', min: 2 }],
    description: '正岑愿意把遗藏调查交给一个可靠的人。你可以提交部分独家消息换取认可，也可以凭先前的归还包袱来谈一份更宽松的约定。',
    choices: [
      { id: 'sell-first-clue', label: '交出一条独家线索', description: '情报 -1；信任 +14、获得 10 元石。', requirements: [{ kind: 'stat', key: 'clues', min: 2 }], effects: { clues: -1, trust: 14, resources: { stones: 10 }, relations: { 'steward-zheng': 8 }, addFlags: ['clan-negotiation'] }, outcome: '宗族会自行核实这条路。你拿到了报酬和认可，但若仍想独掌遗藏，就得找到新的情报补上空白。' },
      { id: 'invoke-honesty', label: '以归还公物的记录作担保', description: '需曾送还包袱；信任 +8、疑心 -4。', requirements: [{ kind: 'flag', key: 'returned-pouch' }], effects: { trust: 8, suspicion: -4, relations: { 'steward-zheng': 6 }, addFlags: ['clan-negotiation'] }, outcome: '正岑查到那张归还记录，接受你先保留开门方法。这次得到宽待，有此前行动作根据。' },
      leave('你放弃了这次预先交涉，保留手中筹码；这份报价就此作罢。'),
    ],
  },
  {
    id: 'clan-standing', title: '宗族愿给你的位置', location: 'clan', tag: '去路', priority: 200, repeatable: true,
    requirements: [{ kind: 'stat', key: 'clues', min: 2 }, { kind: 'stat', key: 'trust', min: 35 }],
    description: '你带回了足够的消息，也有足够的信用。正岑提出由宗族接管遗藏，而你负责巡查与分配，领取稳定资源；签下名字就不再独占遗藏。',
    choices: [
      { id: 'accept-seat', label: '签下约定，在宗族立足', description: '需 2 情报、35 信任；达成「宗族立足」结局。', requirements: [{ kind: 'stat', key: 'clues', min: 2 }, { kind: 'stat', key: 'trust', min: 35 }], effects: { relations: { 'steward-zheng': 10 }, addFlags: ['clan-compact'] }, ending: 'clan', outcome: '遗藏被划入宗族公产，你成为负责此地的巡查蛊师。你让出独占的机会，换来了有来源、有规矩的修行资源。' },
      defer('你没有签字。只要消息与信用仍在，期限到来前仍能回到这张桌前。'),
    ],
  },
  {
    id: 'cave-survey', title: '灯室门外的刻槽', location: 'cave', tag: '情报', priority: 110,
    requirements: [{ kind: 'stat', key: 'clues', min: 1 }],
    description: '旧门后传来细小的齿轮声。你可以用矿片探测三处卡槽，弄清一条新的开门顺序；蛮力试门只会让暗处的人更快察觉。',
    choices: [
      { id: 'survey-lock', label: '用矿片逐一试出刻槽', description: '消耗 2 矿料、2 真元；情报 +1，疑心 +3。', requirements: [{ kind: 'resource', key: 'ore', min: 2 }, { kind: 'stat', key: 'qi', min: 2 }], effects: { resources: { ore: -2 }, qi: -2, clues: 1, suspicion: 3, addFlags: ['gate-survey'] }, outcome: '两片矿料卡在门里，你记下了它们对应的齿轮位置。开门顺序多了一段能验证的依据。' },
      { id: 'listen-lock', label: '以地听辨认内侧齿轮', description: '需装备苏醒的地听肉耳草；消耗 2 真元，情报 +1。', requirements: [{ kind: 'gu', id: 'earth-ear', equipped: true }, { kind: 'stat', key: 'qi', min: 2 }], effects: { qi: -2, clues: 1, addFlags: ['gate-survey'] }, outcome: '你分清了三组齿轮的回声，没有留下明显的撬动痕迹。' },
      leave('你放弃这次刻槽勘测，没有取得新情报；若要开门，需要从别处补齐线索。'),
    ],
  },
  {
    id: 'cave-lamp', title: '还能点燃的旧灯', location: 'cave', tag: '准备', dayMin: 2, priority: 70,
    description: '门廊里放着一盏旧灯，灯座嵌有护身蛊的容器。火重新点亮，容器才能打开，烟雾也会沿旧通风口散到山外。',
    choices: [
      { id: 'light-lamp', label: '兑酒续灯，取出玉皮蛊', description: '消耗 1 酒、2 矿料；获得玉皮蛊，疑心 +5。', requirements: [{ kind: 'resource', key: 'wine', min: 1 }, { kind: 'resource', key: 'ore', min: 2 }], effects: { resources: { wine: -1, ore: -2 }, gu: { 'jade-skin': 1 }, suspicion: 5 }, outcome: '玉色小蛊醒了过来。灯烟也在山腰升起，附近的人会知道这里有人活动。' },
      { id: 'strip-lamp', label: '只拆下能用的灯座矿片', description: '消耗 2 真元；获得 2 矿料、1 修为。', requirements: [{ kind: 'stat', key: 'qi', min: 2 }], effects: { qi: -2, resources: { ore: 2 }, cultivation: 1 }, outcome: '你绕开封着蛊的容器，仔细拆下外层矿片，用来补充之后的合炼材料。' },
      leave('你放弃拆取旧灯，保留了手里的材料与真元。'),
    ],
  },
  {
    id: 'cave-boundary', title: '先前约好的那条退路', location: 'cave', tag: '人情', priority: 220,
    requirements: [{ kind: 'flag', key: 'fang-boundary' }],
    description: '方源已在侧洞做完标记。他没有封住你们约定的通道，也提出用一块矿料交换一条关于守关者的发现。',
    choices: [
      { id: 'honour-boundary', label: '按约交换守关者的情报', description: '消耗 1 矿料；情报 +1、疑心 -3，方源关系 +5。', requirements: [{ kind: 'resource', key: 'ore', min: 1 }], effects: { resources: { ore: -1 }, clues: 1, suspicion: -3, relations: { 'fang-yuan': 5 } }, outcome: '守关木傀会在换气后牵动吸元丝。你亲耳核实了这点，双方继续各走各的路。' },
      { id: 'keep-distance', label: '只确认退路，各取所需', description: '疑心 -3；保留手中的全部材料。', effects: { suspicion: -3, relations: { 'fang-yuan': 2 } }, outcome: '约定仅限退路，也照这个边界兑现。没有人强迫另一方追加合作。' },
      leave('你没有追加交换，沿先前约定的通道离开；这次会面到此结束。'),
    ],
  },
  {
    id: 'cave-guardian', title: '石灯第三次亮起', location: 'cave', tag: '终局', priority: 200, repeatable: true,
    requirements: [{ kind: 'stat', key: 'clues', min: 3 }],
    description: '三条经核实的情报拼出了开门顺序。门开之后，守关木傀会封住灯室中央。你可以现在试关，也可以先离开，备好二转蛊、护身或疗伤的手段再来。',
    choices: [
      { id: 'challenge', label: '进入灯室，挑战守关木傀', description: '需 3 情报；只有真正获胜，才能独掌石灯遗藏。', requirements: [{ kind: 'stat', key: 'clues', min: 3 }], effects: {}, encounterId: 'guardian', victoryEffects: { addFlags: ['inheritance-secured'], cultivation: 3 }, victoryEnding: 'inheritance', victoryText: '最后一道齿轮停了。你凭核实过的线索与自己的战斗准备取得石灯遗藏，将今后的修行资源握在自己手里。', defeatEffects: { suspicion: 5 }, outcome: '木傀先把双臂交叠成护势。它的动作会按次序重复，贸然把全部真元打进护势里并不划算。' },
      defer('你退回安全门廊。三条线索没有消失，补充资源、装备蛊或突破之后仍可回来挑战。'),
    ],
  },
  {
    id: 'market-rain-bond', title: '压在雨路上的押金', location: 'market', tag: '雨路 · 托付', dayMin: 2, dayMax: 6, priority: 25,
    requirements: [{ kind: 'stat', key: 'clues', min: 1 }],
    description: '连日山雨冲坏了商队的旧道。严砚愿出二十块元石，请你与兰渡核实听雨涧的一条绕行路，押金也算在这笔结款内。最迟第八日要带回核验结果，第四至第九日可回市集结账；若空手回来，押金便用来另雇人。',
    choices: [
      {
        id: 'post-bond', label: '押八块元石，接下验路单',
        description: '支付 8 元石、1 矿料作路标；开启听雨涧验路。尚未获得报酬。',
        requirements: [{ kind: 'resource', key: 'stones', min: 8 }, { kind: 'resource', key: 'ore', min: 1 }],
        effects: { resources: { stones: -8, ore: -1 }, relations: { 'merchant-yan': 3 }, addFlags: ['rain-route-bonded'] },
        outcome: '严砚把钱压在验路单下，矿料交给兰渡布标。去听雨涧找到可靠通路，第四至第九日再来谈结款；口头保证不算完成。',
      },
      {
        id: 'use-merchant-credit', label: '凭先前的合作减半押金',
        description: '需与严砚建立过互惠约定；支付 4 元石、1 矿料，结款总额仍为 20 元石。',
        requirements: [{ kind: 'flag', key: 'merchant-pact' }, { kind: 'resource', key: 'stones', min: 4 }, { kind: 'resource', key: 'ore', min: 1 }],
        effects: { resources: { stones: -4, ore: -1 }, relations: { 'merchant-yan': 5 }, addFlags: ['rain-route-bonded'] },
        outcome: '此前送到的货替你说了话。严砚只收半份押金，仍要求你在第八日结束前核验听雨涧的通路。',
      },
      leave('你放弃了这份验路单，没有占用自己的盘缠，也没有取得这笔结款的资格。'),
    ],
  },
  {
    id: 'stream-rain-survey', title: '积水里的第二条路', location: 'stream', tag: '雨路 · 验证', dayMin: 2, dayMax: 8, priority: 25,
    requirements: [{ kind: 'flag', key: 'rain-route-bonded' }],
    description: '兰渡在旧路尽头等你：高处有断续的落脚石，低处有被山狼占住的浅滩，地底还可能藏着涵洞。验出一条真正能走的路，才能换回押金与酬劳。冒险失败或放弃，本次验路便不再重做。',
    choices: [
      {
        id: 'listen-for-culvert', label: '以地听找出涵洞的回声',
        description: '需装备苏醒的地听肉耳草；消耗 2 真元，情报 +1，取得验路凭据。',
        requirements: [{ kind: 'gu', id: 'earth-ear', equipped: true }, { kind: 'stat', key: 'qi', min: 2 }],
        effects: { qi: -2, clues: 1, relations: { 'scout-lan': 8 }, addFlags: ['rain-route-verified'] },
        outcome: '地听分清了空洞与实岩，兰渡沿你指出的方向探到了旧涵洞。你们留下双重路标；第四至第九日可去市集结算。',
      },
      {
        id: 'jump-the-ridge', label: '借跳跳草试走高处石脊',
        description: '需装备苏醒的跳跳草；消耗 3 真元、2 生命，情报 +1，取得验路凭据。',
        requirements: [{ kind: 'gu', id: 'jumping-grass', equipped: true }, { kind: 'stat', key: 'qi', min: 3 }, { kind: 'stat', key: 'hp', min: 3 }],
        effects: { qi: -3, hp: -2, clues: 1, relations: { 'scout-lan': 8 }, addFlags: ['rain-route-verified'] },
        outcome: '湿石擦破了你的手掌，但高处通路确实能走。兰渡记下每处落脚点，第四至第九日把凭据交给市集账房即可结款。',
      },
      {
        id: 'clear-the-shallows', label: '赶走山狼，实走低处浅滩',
        description: '进入战斗；只有获胜才获得 1 情报与验路凭据。败退会失去这次结款机会。',
        effects: {}, encounterId: 'stream-wolf',
        victoryEffects: { clues: 1, relations: { 'scout-lan': 12 }, addFlags: ['rain-route-verified'] },
        victoryText: '浅滩终于可以逐段踏查。兰渡与你核完了水深，把验路凭据交给你；第四至第九日去市集结算。',
        defeatEffects: { relations: { 'merchant-yan': -4 }, addFlags: ['rain-route-failed'] },
        outcome: '山狼伏在必经的石隙前。若未能胜过它，你就无法交出可信的验路结果，已经交付的押金也无法领回。',
      },
      leave('你放弃了这次验路，没有取得凭据；押金将留作另雇验路人的费用。'),
    ],
  },
  {
    id: 'market-rain-settlement', title: '一条路，两种结款', location: 'market', tag: '雨路 · 兑现', dayMin: 4, dayMax: 9, priority: 25,
    requirements: [{ kind: 'flag', key: 'rain-route-verified' }],
    description: '严砚与兰渡的路标对上了。你可以结清二十块元石，也可以只取八块现金，把其余报酬换成正岑认可的巡路推荐。两种结法只能选一次。',
    choices: [
      {
        id: 'collect-route-fee', label: '结清押金与全部酬款',
        description: '获得 20 元石；与账房关系 +8。现金可留作供养或离山盘缠。',
        effects: { resources: { stones: 20 }, relations: { 'merchant-yan': 8 }, addFlags: ['rain-route-settled'] },
        outcome: '二十块元石中已包含应结的押金。严砚划去欠款，你把一场有失败风险的委托换成了真正握在手里的盘缠。',
      },
      {
        id: 'take-clan-endorsement', label: '少取现金，换一份共同署名',
        description: '获得 8 元石、12 宗族信任；账房与执事记下这次合作。',
        effects: { resources: { stones: 8 }, trust: 12, relations: { 'merchant-yan': 4, 'steward-zheng': 8 }, addFlags: ['rain-route-settled', 'rain-route-endorsed'] },
        outcome: '你舍去十二块现钱，让验路的实绩送到了议事楼。正岑接受这份共同署名，往后评估你时多了一件能核查的事。',
      },
      leave('你谢绝了这次结款，押金与额外酬劳都不再领取。验过的山路仍记在你的手札里。'),
    ],
  },
  {
    id: 'bamboo-remedy-pledge', title: '先把引路药备好', location: 'bamboo', tag: '药匣 · 委托', dayMin: 2, dayMax: 6, priority: 22,
    requirements: [{ kind: 'stat', key: 'clues', min: 1 }],
    description: '苏蘅想取回石灯旧药室里仍在生长的止血药苗，但伤员让她脱不开身。你须先备引路药或留一只小光作引灯，最迟第八日取出封匣。第四日起，她会在议事楼旁的药棚结算：可换合炼用蛊，也可计作宗族贡献。准备的药与蛊都不退回。',
    choices: [
      {
        id: 'prepare-remedy-kit', label: '拿药草与酒配好引路药',
        description: '消耗 2 药草、1 酒、1 真元；开启遗藏取匣，药师关系 +6。',
        requirements: [{ kind: 'resource', key: 'herbs', min: 2 }, { kind: 'resource', key: 'wine', min: 1 }, { kind: 'stat', key: 'qi', min: 1 }],
        effects: { resources: { herbs: -2, wine: -1 }, qi: -1, relations: { 'healer-su': 6 }, addFlags: ['medicine-pledged'] },
        outcome: '引路药点上了试火，你现在可以去石灯遗藏寻找药匣。苏蘅提醒你保留一份药草护住口鼻，或带能听辨风道的蛊去。',
      },
      {
        id: 'pledge-little-light', label: '把一只小光交给她作引灯',
        description: '交出 1 只小光蛊，不会退回；开启遗藏取匣，药师关系 +6。',
        requirements: [{ kind: 'gu', id: 'little-light', count: 1 }],
        effects: { gu: { 'little-light': -1 }, relations: { 'healer-su': 6 }, addFlags: ['medicine-pledged'] },
        outcome: '小光被留作药苗的引灯，已经不属于你的行囊。你省下了药与酒，也暂时失去它对攻势或合炼的帮助；下一站是石灯旧药室。',
      },
      {
        id: 'share-healer-supplies', label: '请她分担这次的准备',
        description: '需与苏蘅有过互助；消耗 1 药草、1 真元，其余用她的存料。',
        requirements: [{ kind: 'flag', key: 'healer-pact' }, { kind: 'resource', key: 'herbs', min: 1 }, { kind: 'stat', key: 'qi', min: 1 }],
        effects: { resources: { herbs: -1 }, qi: -1, relations: { 'healer-su': 8 }, addFlags: ['medicine-pledged'] },
        outcome: '苏蘅记得你帮过伤员，愿意垫上酒料。你留下少量药草作引路药，约好第八日前取匣、第四日起去议事楼药棚结算。',
      },
      leave('你没有接下取匣委托，保留自己的材料与蛊；也不再领取这次取药的报酬。'),
    ],
  },
  {
    id: 'cave-remedy-cache', title: '药烟后的一只封匣', location: 'cave', tag: '药匣 · 取物', dayMin: 3, dayMax: 8, priority: 22,
    requirements: [{ kind: 'flag', key: 'medicine-pledged' }],
    description: '药匣就在窄门后，漏出的药烟会灼伤皮肤。地听能帮你找到侧面的通风卡扣；没有它，也可以用湿药布护住口鼻硬闯，但带着伤再试守关会更危险。匣旁的检修牌片也能补上一段灯室线索。',
    choices: [
      {
        id: 'vent-medicine-room', label: '听辨风道，先打开通风扣',
        description: '需装备苏醒的地听肉耳草；消耗 1 矿料、2 真元，情报 +1，取得完整药匣。',
        requirements: [{ kind: 'gu', id: 'earth-ear', equipped: true }, { kind: 'resource', key: 'ore', min: 1 }, { kind: 'stat', key: 'qi', min: 2 }],
        effects: { resources: { ore: -1 }, qi: -2, clues: 1, addFlags: ['medicine-box-recovered'] },
        outcome: '你用矿片撑开侧扣，等药烟散去再取匣，也抄下了检修次序。第四日起把封匣带到议事楼旁的药棚，才能兑现报酬。',
      },
      {
        id: 'cross-medicine-smoke', label: '用湿药布掩面，赶在换气前取匣',
        description: '消耗 1 药草、2 真元、7 生命；情报 +1、疑心 +3，取得完整药匣。',
        requirements: [{ kind: 'resource', key: 'herbs', min: 1 }, { kind: 'stat', key: 'qi', min: 2 }, { kind: 'stat', key: 'hp', min: 8 }],
        effects: { resources: { herbs: -1 }, qi: -2, hp: -7, clues: 1, suspicion: 3, addFlags: ['medicine-box-recovered'] },
        outcome: '你护住药匣与牌片冲出窄门，肩背却被药烟灼伤，洞口的烟迹也暴露了这次行动。第四日起可去议事楼药棚结算；试关之前最好先养伤。',
      },
      leave('你放弃了这次取匣，没有取得报酬凭据；此前交付的引路药或小光也不再收回。'),
    ],
  },
  {
    id: 'clan-remedy-settlement', title: '药匣该送向哪张桌', location: 'clan', tag: '药匣 · 兑现', dayMin: 4, dayMax: 10, priority: 22,
    requirements: [{ kind: 'flag', key: 'medicine-box-recovered' }],
    description: '苏蘅在药棚验过了封匣。按约，你能拿两只合炼用蛊，或少取私利、将药苗计入公仓。若有熟悉的商队账房，也能谈一笔买断价；苏蘅会结清自己的份额，但公仓不会乐见这批药随商队离山。',
    choices: [
      {
        id: 'claim-refining-gu', label: '领取白豕与玉皮，留作自己的修行',
        description: '获得白豕蛊、玉皮蛊各 1 只，药师关系 +12；可再备辅材合炼白玉蛊。',
        effects: { gu: { 'white-boar': 1, 'jade-skin': 1 }, relations: { 'healer-su': 12 }, addFlags: ['medicine-settled'] },
        outcome: '苏蘅收下药匣，把约好的两只蛊交到你手里。你选择把这一趟的代价换成自己的战斗准备，合炼所需辅材仍要自行备齐。',
      },
      {
        id: 'supply-public-medicine', label: '把药苗列入公仓，领取部分报酬',
        description: '获得 10 元石、12 宗族信任；药师关系 +6，执事关系 +10。',
        effects: { resources: { stones: 10 }, trust: 12, relations: { 'healer-su': 6, 'steward-zheng': 10 }, addFlags: ['medicine-settled', 'medicine-public-stock'] },
        outcome: '你没有领取那两只蛊。药苗入了公仓，正岑将这次补给记在你的贡献下；十块元石补回了部分投入，余下收益落在了族中的信用上。',
      },
      {
        id: 'sell-through-caravan', label: '请熟悉的账房买断药苗',
        description: '需有商队互惠约定；获得 26 元石，信任 -6、疑心 +4，执事关系 -6、账房关系 +8。',
        requirements: [{ kind: 'flag', key: 'merchant-pact' }],
        effects: { resources: { stones: 26 }, trust: -6, suspicion: 4, relations: { 'merchant-yan': 8, 'steward-zheng': -6, 'healer-su': 3 }, addFlags: ['medicine-settled', 'medicine-diverted'] },
        outcome: '严砚付清买断款，苏蘅也拿到了自己的份额。你握住更多盘缠，却让公仓少了这批期待中的药；正岑对你优先考虑族中事务的信心下降了。',
      },
      leave('你谢绝这次结算，把完整封匣留给药棚处理；不领取蛊、现金或贡献报酬。'),
    ],
  },
];

export const RECIPES: RecipeDef[] = [
  {
    id: 'refine-moon-glow', name: '月光生芒', description: '一只月光与两只小光合炼月芒。普通失败只损失辅材，稳炼加料确保成功。',
    result: 'moon-glow', gu: { moonlight: 1, 'little-light': 2 }, resources: { stones: 6, ore: 2, wine: 1 }, successRate: 0.74, safeExtra: { stones: 5, herbs: 1 },
  },
  {
    id: 'refine-white-jade', name: '豕力凝玉', description: '白豕与玉皮合炼，得到持续护身的白玉蛊。合炼后原有两只蛊合为一只。',
    result: 'white-jade', gu: { 'white-boar': 1, 'jade-skin': 1 }, resources: { stones: 6, herbs: 2 }, successRate: 0.78, safeExtra: { stones: 4, ore: 1 },
  },
  {
    id: 'refine-moon-mark', name: '石纹留月', description: '本篇简化配方：以矿料代替原型所需的痕石蛊，与月光合炼为月痕。',
    result: 'moon-mark', gu: { moonlight: 1 }, resources: { stones: 8, ore: 5, wine: 1 }, successRate: 0.8, safeExtra: { stones: 4, herbs: 1 },
  },
];

export const SHOP: ShopItem[] = [
  ...GU.map((gu): ShopItem => ({
    id: `buy-${gu.id}`, name: gu.name, description: `${gu.rank} 转 · ${gu.description}`,
    price: gu.price, stock: gu.id === 'little-light' ? 4 : gu.id === 'moonlight' ? 3 : 1,
    effects: { gu: { [gu.id]: 1 } }, guId: gu.id,
  })),
  { id: 'buy-herbs', name: '晒干药草', description: '2 份药草，可用于合炼或向采药人交付。', price: 4, stock: 6, effects: { resources: { herbs: 2 } } },
  { id: 'buy-ore', name: '筛好的矿料', description: '2 份矿料，可用于试探门槽与合炼。', price: 5, stock: 6, effects: { resources: { ore: 2 } } },
  { id: 'buy-wine', name: '竹筒清酿', description: '1 份酒，可用于合炼、交易与野外事件。', price: 4, stock: 8, effects: { resources: { wine: 1 } } },
];

export const ENEMIES: EnemyDef[] = [
  {
    id: 'bamboo-boar', name: '竹林山豕', subtitle: '先冲撞，后护住要害', hp: 18,
    moves: [{ label: '低头冲撞', type: 'attack', power: 5 }, { label: '缩身护颈', type: 'guard', power: 2 }, { label: '獠牙挑击', type: 'attack', power: 6 }],
    reward: { resources: { stones: 9, herbs: 1 }, cultivation: 2 },
  },
  {
    id: 'stream-wolf', name: '浅滩独狼', subtitle: '扑击之间夹着扰乱真元的嚎声', hp: 24,
    moves: [{ label: '踏石扑咬', type: 'attack', power: 7 }, { label: '尖嚎扰息', type: 'drain', power: 2 }, { label: '绕石伏身', type: 'guard', power: 3 }, { label: '侧扑撕咬', type: 'attack', power: 6 }],
    reward: { resources: { stones: 12, herbs: 1 }, cultivation: 2 },
  },
  {
    id: 'road-duelist', name: '练武坪同门', subtitle: '守势之后才是真正的进招', hp: 23,
    moves: [{ label: '架起护势', type: 'guard', power: 3 }, { label: '短刃直进', type: 'attack', power: 6 }, { label: '虚招扰息', type: 'drain', power: 2 }, { label: '踏步重击', type: 'attack', power: 7 }],
    reward: { resources: { stones: 7 }, cultivation: 2 },
  },
  {
    id: 'courier-thief', name: '截货独行客', subtitle: '依仗护具，攻势直接', hp: 21,
    moves: [{ label: '横刀封路', type: 'attack', power: 6 }, { label: '护臂格挡', type: 'guard', power: 2 }, { label: '突步抢攻', type: 'attack', power: 6 }],
    reward: { resources: { stones: 9, wine: 1 }, cultivation: 2 },
  },
  {
    id: 'guardian', name: '守关木傀', subtitle: '护势 → 重锤 → 吸元 → 横扫，反复轮转', hp: 38,
    moves: [{ label: '双臂合锁', type: 'guard', power: 4 }, { label: '落灯重锤', type: 'attack', power: 9 }, { label: '牵丝吸元', type: 'drain', power: 3 }, { label: '石臂横扫', type: 'attack', power: 8 }],
    reward: { resources: { stones: 22, ore: 3 } },
  },
];

export const ENDINGS: EndingDef[] = [
  {
    id: 'inheritance', title: '独掌传承', subtitle: '一盏旧灯，由你点亮', color: '#d6bd7d',
    description: '你将零散线索核成一条路，亲手越过守关者，把石灯遗藏握在自己手中。自由的资源也意味着往后的风险由自己承担。',
  },
  {
    id: 'clan', title: '宗族立足', subtitle: '把一次机缘，变成一份位置', color: '#91b6a5',
    description: '你的消息与信用换来了宗族的承认。遗藏由公仓接管，你获得稳定的修行份额，也承接了守住约定的责任。',
  },
  {
    id: 'departure', title: '离山', subtitle: '山路之外，还有更远的去处', color: '#9ab3c9',
    description: '这一页行程在寨门外合上。主动付清路费、期限耗尽或受挫败退，各有不同的结算；旅程的具体结果会如实记在行记中。',
  },
];
