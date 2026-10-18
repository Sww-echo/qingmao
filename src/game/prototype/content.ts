import type { PrototypeContent } from './types.ts';

/** Authoritative, serializable P1 content. No executable predicates or effects. */
export const PROTOTYPE_CONTENT: PrototypeContent = {
  scenarioId: 'qingmao-fourteen-day-prototype',
  rulesVersion: 'prototype-rules-1',
  contentVersion: 'prototype-content-1',
  parameters: {
    days: 14, actionsPerDay: 3, startingHp: 28, startingQi: 12,
    startingStones: 12, startingHerbs: 2, laborIncome: 2,
    trainingQi: 3, trainingGain: 3, liquorTrainingBonus: 2,
    cultivationCap: 60, cultivationStep: 12, maxQiBonusPerStep: 2,
    herbCarryLimit: 6, wineCarryLimit: 3, herbPrice: 2, winePrice: 3,
    herbHealing: 10, wineQi: 6, nightlyHealing: 4, suspicionDecay: 1,
    scoutQi: 3, clueCap: 8, sealCost: 1, wakeSealedCost: 2,
    wakeDormantCost: 1, clearExposureCost: 4,
    crisisThreatMin: 8, crisisThreatMax: 12, shelterCost: 6,
    retreatDamage: 6, retreatStoneLoss: 2, scoutProtection: 4,
  },
  locations: [
    { id: 'academy', name: '学堂', description: '劳作、修炼、护卫委托与战备。普通走动不耗行动。' },
    { id: 'inn', name: '客栈', description: '劳作、买补给、经营店主人情和筹备庇护。' },
    { id: 'bamboo', name: '竹林', description: '侦察与巡山。侦察会耗真元；无侦察蛊时可能受伤、留下越界痕迹或遇敌。' },
  ],
  gu: [
    { id: 'moonlight', name: '月光蛊', role: 'attack', upkeep: 1, qiCost: 3, power: 8, description: '月刃伤害8，每6修为再加2；一击耗3真元。' },
    { id: 'jade-skin', name: '玉皮蛊', role: 'guard', upkeep: 1, qiCost: 2, power: 2, description: '有效时每次受击减伤2；主动催动再获得8点当回合护盾。' },
    { id: 'ear-grass', name: '地听肉耳草', role: 'scout', upkeep: 1, qiCost: 2, power: 2, description: '竹林侦察多得1情报且避开随机遇敌；开辟信号路线，撤退少受4伤害。' },
    { id: 'liquor-worm', name: '酒虫', role: 'growth', upkeep: 1, qiCost: 0, power: 2, description: '每次修炼额外获得2修为；仍需日常供养。' },
  ],
  relations: [
    { id: 'guard-captain', name: '巡山队长', purpose: '有限的巡山、补给和守望委托；信任能支持庇护撤离。' },
    { id: 'innkeeper', name: '客栈掌柜', purpose: '账册、口信和物资委托；落实庇护契约，不能仅凭关系值免费避险。' },
  ],
  exposures: [
    { id: 'unlicensed-survey', source: '无地听蛊越界勘察', consequence: '所有山狼战斗的每次敌方伤害+2，庇护准备值−1；关注自然衰减不清除此痕迹。', remedy: '客栈花1行动和4元石处理物证。' },
  ],
  enemies: [
    { id: 'scout-wolf', name: '落单山狼', hpMin: 18, hpMax: 24, intents: [{ label: '扑咬', damage: 5 }, { label: '蓄力猛扑', damage: 8 }, { label: '绕行轻咬', damage: 3 }], rewardStones: 10 },
    { id: 'crisis-pack', name: '竹林狼群', hpMin: 60, hpMax: 76, intents: [{ label: '前锋扑咬', damage: 6 }, { label: '群狼猛扑', damage: 10 }, { label: '侧翼试探', damage: 4 }, { label: '夹击', damage: 8 }], rewardStones: 0 },
  ],
  events: [
    {
      id: 'briefing', title: '十四日守望', location: 'academy', fromDay: 1, throughDay: 3, actionCost: 0,
      requirements: [],
      description: '你已开窍，一转丙等四成四。第14日日暮狼群将抵达。可备战，也可侦察并落实两位人物的庇护安排。钱能供养和补给，不能代替这些准备。',
      choices: [{ id: 'acknowledge', label: '记下期限和两种准备方向', costs: {}, requirements: [], effects: [{ kind: 'flag', id: 'briefed' }], risk: '免费查看。第3日后未领月光仍可劳作，但会失去学堂赠蛊窗口。' }],
    },
    {
      id: 'moonlight-issue', title: '领取本命月光', location: 'academy', fromDay: 1, throughDay: 3, actionCost: 1,
      requirements: [{ kind: 'flag', id: 'briefed', present: true }], description: '学堂发放并协助炼化月光蛊。炼化持有就有每日供养，卸装不会免责；可以花行动封存。',
      choices: [{ id: 'receive', label: '花1行动领取并装备', costs: {}, requirements: [], effects: [{ kind: 'gu', id: 'moonlight' }], risk: '每日日暮1元石供养；缺钱会休眠。' }],
    },
    {
      id: 'inn-introduction', title: '替掌柜搬货', location: 'inn', fromDay: 1, throughDay: 4, actionCost: 1,
      requirements: [{ kind: 'flag', id: 'briefed', present: true }], description: '有限的一批到货需要清点搬运，付钱也记人情。',
      choices: [{ id: 'help', label: '搬完这批货', costs: {}, requirements: [], effects: [{ kind: 'resource', id: 'stones', amount: 4 }, { kind: 'relation', id: 'innkeeper', amount: 2 }], risk: '一次委托，过期不再补发。' }],
    },
    {
      id: 'academy-commission', title: '接下巡山口信', location: 'academy', fromDay: 2, throughDay: 5, actionCost: 1,
      requirements: [{ kind: 'flag', id: 'briefed', present: true }], description: '巡山队长需要可靠的送信人，也愿意接纳以后参加巡山的人。',
      choices: [{ id: 'enrol', label: '送信并登记候补', costs: {}, requirements: [], effects: [{ kind: 'resource', id: 'stones', amount: 4 }, { kind: 'relation', id: 'guard-captain', amount: 1 }, { kind: 'flag', id: 'patrol-contract' }], risk: '狼群前锋在第4至7日出现；接委托不强制迎战，后面还有补给任务。' }],
    },
    {
      id: 'supply-ledger', title: '核对客栈账册', location: 'inn', fromDay: 2, throughDay: 6, actionCost: 1,
      requirements: [{ kind: 'relation', id: 'innkeeper', min: 2 }], description: '掌柜将这一批物资的账册交给熟人，整理后可取得后续委托。',
      choices: [{ id: 'balance', label: '核账交付', costs: {}, requirements: [], effects: [{ kind: 'resource', id: 'stones', amount: 6 }, { kind: 'relation', id: 'innkeeper', amount: 2 }], risk: '只有这批账册可领报酬，暂缓不领奖。' }],
    },
    {
      id: 'jade-offer', title: '学堂防护蛊', location: 'academy', fromDay: 2, throughDay: 8, actionCost: 1,
      requirements: [{ kind: 'flag', id: 'briefed', present: true }], description: '教习有一只玉皮蛊可转让。能减伤，但维持也要钱。',
      choices: [{ id: 'buy-jade', label: '支付8元石炼化玉皮', costs: { stones: 8 }, requirements: [], effects: [{ kind: 'gu', id: 'jade-skin' }], risk: '多承担1元石每日供养；只有装备、清醒时才减伤。' }],
    },
    {
      id: 'eargrass-offer', title: '侦察蛊转让', location: 'inn', fromDay: 3, throughDay: 8, actionCost: 1,
      requirements: [{ kind: 'relation', id: 'innkeeper', min: 2 }], description: '熟客转让地听肉耳草，用于探知竹林动静。',
      choices: [{ id: 'buy-ears', label: '支付8元石炼化地听草', costs: { stones: 8 }, requirements: [], effects: [{ kind: 'gu', id: 'ear-grass' }], risk: '多承担1元石每日供养；侦察及危机时必须清醒装备。' }],
    },
    {
      id: 'liquor-offer', title: '温养酒虫', location: 'inn', fromDay: 3, throughDay: 7, actionCost: 1,
      requirements: [{ kind: 'flag', id: 'briefed', present: true }], description: '一只独立试玩情境中的酒虫可用于提纯真元，提升修炼效率。',
      choices: [{ id: 'buy-liquor', label: '支付6元石炼化酒虫', costs: { stones: 6 }, requirements: [], effects: [{ kind: 'gu', id: 'liquor-worm' }], risk: '多承担1元石每日供养；省行动的收益要与购价和饲养比较。' }],
    },
    {
      id: 'bamboo-signs', title: '林缘狼迹', location: 'bamboo', fromDay: 3, throughDay: 7, actionCost: 1,
      requirements: [{ kind: 'flag', id: 'briefed', present: true }], description: '林缘足迹显示狼群的往返方向。',
      choices: [
        { id: 'listen', label: '借地听草确认狼迹', costs: { qi: 3 }, requirements: [{ kind: 'gu', id: 'ear-grass', usable: true }], effects: [{ kind: 'clues', amount: 3 }], risk: '固定获得3情报，无随机伤害。' },
        { id: 'trespass', label: '徒步越界追踪', costs: { qi: 3 }, requirements: [], effects: [{ kind: 'clues', amount: 2 }, { kind: 'hp', amount: -3 }, { kind: 'suspicion', amount: 3 }, { kind: 'exposure', id: 'unlicensed-survey', source: '林缘狼迹：徒步越界' }], risk: '必受3伤害并留下持久暴露；关注衰减不能消除暴露。' },
      ],
    },
    {
      id: 'patrol-rescue', title: '巡山队遇险', location: 'bamboo', fromDay: 4, throughDay: 7, actionCost: 1,
      requirements: [{ kind: 'flag', id: 'patrol-contract', present: true }], description: '一只落单山狼堵住巡山队。胜利才取得10元石及队长信任。',
      choices: [{ id: 'intervene', label: '进入回合战斗救援', costs: {}, requirements: [], effects: [{ kind: 'battle', enemyId: 'scout-wolf', purpose: 'patrol' }], risk: '山狼生命18–24，意图依次5/8/3伤害。撤退失2元石并受6伤（地听草减4），没有胜利报酬。' }],
    },
    {
      id: 'healer-herbs', title: '教习药圃', location: 'academy', fromDay: 4, throughDay: 10, actionCost: 1,
      requirements: [{ kind: 'flag', id: 'briefed', present: true }], description: '帮教习整理药圃，领取一批疗伤药草。',
      choices: [{ id: 'sort-herbs', label: '花1行动换3药草', costs: {}, requirements: [], effects: [{ kind: 'resource', id: 'herbs', amount: 3 }], risk: '药草携带上限6，超出部分留在药圃；不会兑成额外报酬。' }],
    },
    {
      id: 'academy-service', title: '交付守望补给', location: 'academy', fromDay: 5, throughDay: 9, actionCost: 1,
      requirements: [{ kind: 'relation', id: 'guard-captain', min: 1 }], description: '送信人可以认购并运送一批守望补给，赢得具体信任。',
      choices: [{ id: 'deliver', label: '付4元石并运送补给', costs: { stones: 4 }, requirements: [], effects: [{ kind: 'relation', id: 'guard-captain', amount: 2 }, { kind: 'flag', id: 'guard-supplied' }], risk: '这笔投入不退；后续守望任务要求队长关系至少3。' }],
    },
    {
      id: 'guide-report', title: '向导口供', location: 'inn', fromDay: 6, throughDay: 10, actionCost: 1,
      requirements: [{ kind: 'clues', min: 2 }, { kind: 'relation', id: 'innkeeper', min: 3 }], description: '用已验证的狼迹与向导交叉核对，形成可用情报。',
      choices: [{ id: 'cross-check', label: '核对路线口供', costs: {}, requirements: [], effects: [{ kind: 'clues', amount: 1 }, { kind: 'relation', id: 'innkeeper', amount: 1 }], risk: '只给这次独立证词，不重复领奖。' }],
    },
    {
      id: 'alarm', title: '狼群预警', location: 'academy', fromDay: 8, throughDay: 14, actionCost: 0,
      requirements: [{ kind: 'flag', id: 'briefed', present: true }], description: '第14日日暮狼群抵达。正面应对需要修为、有效攻击与防护蛊和补给；庇护要地听草、路线、备粮、契约及两位人物支持。',
      choices: [{ id: 'read-alarm', label: '核对筹备清单', costs: {}, requirements: [], effects: [{ kind: 'flag', id: 'warned' }], risk: '庇护需求强度为8–12，准备值=情报+队长关系−暴露数。低于实际强度会被截住，转入受伤后的战斗。' }],
    },
    {
      id: 'signal-markers', title: '设置撤离信号', location: 'bamboo', fromDay: 8, throughDay: 12, actionCost: 1,
      requirements: [{ kind: 'clues', min: 2 }], description: '听清林间动静后在安全点设置识别标记。',
      choices: [{ id: 'mark-route', label: '用地听草确认并标记路线', costs: { qi: 2 }, requirements: [{ kind: 'gu', id: 'ear-grass', usable: true }], effects: [{ kind: 'clues', amount: 2 }, { kind: 'flag', id: 'route-chart' }], risk: '路线只在本局有效；最终撤离仍需有效侦察蛊。' }],
    },
    {
      id: 'shelter-pledge', title: '落实客栈庇护', location: 'inn', fromDay: 8, throughDay: 11, actionCost: 1,
      requirements: [{ kind: 'relation', id: 'innkeeper', min: 4 }, { kind: 'clues', min: 3 }], description: '掌柜愿意留出藏身处，但必须先落实费用及后续供粮。',
      choices: [{ id: 'pledge', label: '付8元石立下庇护约定', costs: { stones: 8 }, requirements: [], effects: [{ kind: 'flag', id: 'shelter-pledged' }, { kind: 'relation', id: 'innkeeper', amount: 1 }], risk: '第12日前还须交付2药草作为备粮药资；危机时另付6元石护送费。' }],
    },
    {
      id: 'watch-duty', title: '完成守望班次', location: 'academy', fromDay: 9, throughDay: 12, actionCost: 1,
      requirements: [{ kind: 'relation', id: 'guard-captain', min: 3 }], description: '队长把一个真实守望班次交给你，完成后愿为你的撤离作担保。',
      choices: [{ id: 'serve', label: '带1药草完成班次', costs: { herbs: 1 }, requirements: [], effects: [{ kind: 'relation', id: 'guard-captain', amount: 2 }, { kind: 'resource', id: 'stones', amount: 4 }, { kind: 'flag', id: 'watch-served' }], risk: '这是需要交付的具体安排，单纯囤钱不能代替。' }],
    },
    {
      id: 'shelter-stock', title: '庇护所备粮', location: 'inn', fromDay: 9, throughDay: 12, actionCost: 1,
      requirements: [{ kind: 'flag', id: 'shelter-pledged', present: true }], description: '将约定药资交付给掌柜，庇护所才真正可用。',
      choices: [{ id: 'stock', label: '交付2药草', costs: { herbs: 2 }, requirements: [], effects: [{ kind: 'flag', id: 'shelter-stocked' }, { kind: 'relation', id: 'innkeeper', amount: 1 }], risk: '不能只付订金而忽略交付；截止第12日。' }],
    },
    {
      id: 'crisis-arrival', title: '第十四日：狼群抵达', location: 'academy', fromDay: 14, throughDay: 14, actionCost: 0,
      requirements: [{ kind: 'flag', id: 'crisis-arrived', present: true }], description: '最后一轮供养已经结清；战斗及危机选择不再收日程行动，不能在此时买蛊、训练或领过期委托。',
      choices: [
        { id: 'stand', label: '正面守住通道', costs: {}, requirements: [], effects: [{ kind: 'crisis', response: 'fight' }], risk: '敌人生命60–76，意图6/10/4/8伤害循环；每条未处理暴露再加2。缺修为、防护或清醒蛊会明显增加伤亡。战斗每类补给最多用3次，背包容量有限。' },
        { id: 'take-shelter', label: '履约支付6元石，按信号撤入庇护所', costs: { stones: 6 }, requirements: [{ kind: 'gu', id: 'ear-grass', usable: true }, { kind: 'clues', min: 5 }, { kind: 'relation', id: 'guard-captain', min: 3 }, { kind: 'relation', id: 'innkeeper', min: 4 }, { kind: 'flag', id: 'route-chart', present: true }, { kind: 'flag', id: 'watch-served', present: true }, { kind: 'flag', id: 'shelter-stocked', present: true }], effects: [{ kind: 'crisis', response: 'shelter' }], risk: '准备值=情报+队长关系−暴露数，需求强度8–12。成功失去护送费；不足时受10伤害并被迫迎战，没有退款。' },
      ],
    },
  ],
};

function freezeContent(value: object): void {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeContent(child);
  Object.freeze(value);
}
freezeContent(PROTOTYPE_CONTENT);
