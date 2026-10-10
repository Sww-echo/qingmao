import type { EventDef } from './types';

// 石灯遗藏是青茅山背景下的原创第一章；新节点只在新章节模式出现。
export const CHAPTER_EVENTS: EventDef[] = [
  {
    id: 'chapter-arrival', title: '十日之内，一盏旧灯', location: 'academy', tag: '第一章 · 起行',
    actionCost: 0, priority: 350,
    requirements: [{ kind: 'flag', key: 'chapter-one' }],
    description: '你是一名刚有立足之力的低阶蛊师，眼下的本钱只够维持一段短途修行。青茅山传来石灯遗藏的消息：旧灯室仍有守关木傀，入口却被三段失散的线索遮住。秋衡给了你十日；期限一到，最后一班商队离山，这次巡山名册也将封存。你可以查清遗藏、凭实绩在宗族立足，或攒足路费随队远行。没有人替你选定结局，今天先想清楚为何出发。',
    choices: [
      {
        id: 'seek-own-path', label: '想有一份由自己支配的修行资源',
        description: '先寻找可核实的线索，再决定是否独闯遗藏。只表明动机，不消耗行动或资源。',
        effects: { addFlags: ['chapter-arrival-read', 'chapter-motive-inheritance'] },
        outcome: '你把石灯遗藏记在纸页中央。独掌机缘需要自己承担风险，先从竹林足迹、听雨涧刻痕或市集断页查起。',
      },
      {
        id: 'seek-clan-place', label: '想凭一件做成的事，在族中立足',
        description: '先挣得消息与信用，再谈宗族给的位置。只表明动机，不消耗行动或资源。',
        effects: { addFlags: ['chapter-arrival-read', 'chapter-motive-clan'] },
        outcome: '你决定先让自己的名字与一份可靠的报告相连。学堂有巡山差事，但是否交出遗藏，仍要等你查清之后再谈。',
      },
      {
        id: 'seek-long-road', label: '想带着本钱与见识，去更远的地方',
        description: '留意路费、供养与商队期限，也查一条真正有用的山路消息。只表明动机，不消耗行动或资源。',
        effects: { addFlags: ['chapter-arrival-read', 'chapter-motive-departure'] },
        outcome: '你记住了商队第六日起分批离山、十日后不再等人的期限。去路需要三十五块元石和至少一条情报，不必把全部身家压在一场争夺上。',
      },
    ],
  },
  {
    id: 'chapter-council', title: '消息落在同一张桌上', location: 'clan', tag: '第一章 · 交涉',
    actionCost: 0, priority: 300,
    requirements: [{ kind: 'flag', key: 'chapter-one' }, { kind: 'flag', key: 'chapter-arrival-read' }, { kind: 'stat', key: 'clues', min: 1 }],
    description: '你带回的消息已有实据，议事楼才为你留了座。正岑愿让宗族接管遗藏，前提是消息足够、你也值得信任；严砚关心山路是否能走，愿让能付清路费的人随队离开。秋衡提醒你，独自打开石灯也算一条路，但守关者不会因为你先发现入口便让步。这次只说明合作边界，不交出线索，也不签终局约定。',
    choices: [
      {
        id: 'keep-independent', label: '暂不许诺归属，继续自己调查',
        description: '保留情报与去路；记下独立调查的立场，不消耗行动或资源。',
        effects: { addFlags: ['chapter-council-read', 'chapter-independent'] },
        outcome: '你答应只以核实过的消息交涉，没有把尚未取得的遗藏许给任何人。离开前回学堂理清准备，之后仍能改走宗族或商队的路。',
      },
      {
        id: 'consider-public', label: '愿谈宗族合作，但先说清条件',
        description: '记下共同开发的意向；暂不交出情报，也不增加信任或资源。',
        effects: { addFlags: ['chapter-council-read', 'chapter-public'] },
        outcome: '你问清了宗族接管意味着什么：稳定份额，也有巡查责任。两条情报和三十五点信任才够正式签约，眼下的表态不等于完成这件事。',
      },
      {
        id: 'consider-caravan', label: '先问明商队的期限和同行条件',
        description: '记下随队远行的意向；暂不订位，也不支付路费。',
        effects: { addFlags: ['chapter-council-read', 'chapter-caravan'] },
        outcome: '严砚说清了同行条件：第六日起、至少一条情报、三十五块元石。你没有当场订位，先回学堂安排剩下的行程。',
      },
    ],
  },
  {
    id: 'chapter-resolution', title: '临行前的交代', location: 'academy', tag: '第一章 · 定向',
    actionCost: 0, priority: 300,
    requirements: [{ kind: 'flag', key: 'chapter-one' }, { kind: 'flag', key: 'chapter-council-read' }],
    description: '秋衡把你的调查笔记合上，让你说出接下来的打算。装备是否苏醒、伤药是否足够、答应别人的事是否交代，都比一句豪言实在。你不用为了交卷强求合炼或突破；三条去路各有条件。这里留下的是眼下的准备方向，以后仍可调整，真正的结局由遗藏、议事楼或市集的最后一次选择决定。',
    choices: [
      {
        id: 'prepare-inheritance', label: '按独自开灯来准备',
        description: '目标为 3 情报与守关战；检查攻击、防护、疗伤和供养。只确认计划，不消耗行动或资源。',
        effects: { addFlags: ['chapter-ready', 'chapter-plan-inheritance'] },
        outcome: '你把要核实的线索与战斗准备列成两栏。可以先练步法、备蛊与药，再去遗藏；若途中改变主意，宗族和商队仍是去路。',
      },
      {
        id: 'prepare-clan', label: '按兑现宗族约定来准备',
        description: '目标为 2 情报与 35 信任；巡山报告、救助与清点公仓都可积累信用。只确认计划，不消耗行动或资源。',
        effects: { addFlags: ['chapter-ready', 'chapter-plan-clan'] },
        outcome: '你准备拿能查清的实绩换一个位置。倘若曾留下包袱或仓单的旧账，议事楼的追问也值得先回应；本次计划还没有交出遗藏。',
      },
      {
        id: 'prepare-departure', label: '按付清路费、随队远行来准备',
        description: '目标为第 6 日起、1 情报与 35 元石；另留每日供养钱。只确认计划，不消耗行动或资源。',
        effects: { addFlags: ['chapter-ready', 'chapter-plan-departure'] },
        outcome: '你把路费与供养分开记下，准备在市集做工、兑现已经完成的委托。真正付费订位之前，你仍能继续调查或改走其他路。',
      },
    ],
  },
  {
    id: 'chapter-pouch-inquiry', title: '公仓来问那只包袱', location: 'clan', tag: '旧账 · 包袱',
    dayMin: 2, priority: 260,
    requirements: [{ kind: 'flag', key: 'chapter-one' }, { kind: 'flag', key: 'kept-pouch' }, { kind: 'flag', key: 'pouch-account-settled', value: false }],
    description: '公仓找到了包袱的运送记录，也查到你曾在那段河石停留。正岑把清单放在桌上：一只玉皮蛊、七块元石。原物还在，可以交回；若蛊已经合炼或元石已经花掉，可以按二十一块元石赔付，其中两块是核查费用。认责但暂不偿还，会留下欠账与信用损失；继续否认也不能抹去已被发现的行踪。',
    choices: [
      {
        id: 'return-pouch-goods', label: '交还玉皮蛊与七块元石',
        description: '消耗 1 只玉皮蛊、7 元石；信任 +4、疑心 -8，执事关系 +6。已发生的侵占记录仍保留。',
        requirements: [{ kind: 'gu', id: 'jade-skin' }, { kind: 'resource', key: 'stones', min: 7 }],
        effects: { gu: { 'jade-skin': -1 }, resources: { stones: -7 }, trust: 4, suspicion: -8, relations: { 'steward-zheng': 6 }, addFlags: ['pouch-account-settled', 'pouch-repaid'] },
        outcome: '你按清单交还公物，若玉皮蛊仍在身上，也当场解下。正岑在欠物栏画了一道销记；归还挽回了部分信用，先前取走包袱的记录没有被删掉。',
      },
      {
        id: 'pay-pouch-compensation', label: '以二十一块元石折价赔付',
        description: '支付 21 元石；保留现有蛊，信任 +4、疑心 -8，执事关系 +6。可用于原物已消耗的情况。',
        requirements: [{ kind: 'resource', key: 'stones', min: 21 }],
        effects: { resources: { stones: -21 }, trust: 4, suspicion: -8, relations: { 'steward-zheng': 6 }, addFlags: ['pouch-account-settled', 'pouch-repaid'] },
        outcome: '十二块折抵玉皮蛊，七块补回原钱，两块支付核查。欠物已清，你保留了现有的蛊；正岑承认赔偿，也没有把迟来的偿还写成最初就守约。',
      },
      {
        id: 'confess-pouch', label: '承认取走，记下尚未偿还的欠物',
        description: '不花资源；信任 -10、疑心 +3，执事关系 -6。结束本次追问，欠物仍会记入章末。',
        effects: { trust: -10, suspicion: 3, relations: { 'steward-zheng': -6 }, addFlags: ['pouch-account-settled', 'pouch-confessed'] },
        outcome: '你承认取走了公物，却没有交还足额赔偿。正岑记下欠物与认责，不再重复这次问话；宗族对你的信任降低，这笔未偿旧账将跟着本章的经历一起留下。',
      },
      {
        id: 'conceal-pouch', label: '仍称自己没有见过包袱',
        description: '保留资源；信任 -5、疑心 +12，执事关系 -12。结束本次追问，疑案仍会记入章末。',
        effects: { trust: -5, suspicion: 12, relations: { 'steward-zheng': -12 }, addFlags: ['pouch-account-settled', 'pouch-concealed'] },
        outcome: '你坚持否认，正岑没有当场搜身，只把相互矛盾的口供一并封存。公物未追回，疑心与隔阂更深；这次问话结束，不代表那只包袱从此无主。',
      },
    ],
  },
  {
    id: 'chapter-ledger-inquiry', title: '旧仓单与新盘点对不上', location: 'clan', tag: '旧账 · 仓单',
    dayMin: 3, priority: 250,
    requirements: [{ kind: 'flag', key: 'chapter-one' }, { kind: 'flag', key: 'false-ledger' }, { kind: 'flag', key: 'ledger-account-settled', value: false }],
    description: '新盘点仍缺三份药草，你在旧仓单上的签名却写着已经入库。秋衡把两张账并排放下，请正岑和你各说清经手的部分。十五块元石不是那次正常工作的酬劳。你可以退钱补货，也可以用二十一块元石连同药草折价结清；空手认责会留下未偿账，继续维护旧账则要承担更深的疑心。',
    choices: [
      {
        id: 'replace-ledger-goods', label: '退回收款，补齐三份药草',
        description: '消耗 15 元石、3 药草；信任 +4、疑心 -8，教习关系 +4。假账历史仍保留。',
        requirements: [{ kind: 'resource', key: 'stones', min: 15 }, { kind: 'resource', key: 'herbs', min: 3 }],
        effects: { resources: { stones: -15, herbs: -3 }, trust: 4, suspicion: -8, relations: { 'mentor-qiu': 4 }, addFlags: ['ledger-account-settled', 'ledger-repaid'] },
        outcome: '你退回十五块元石，三份干燥药草也确实送进公仓。秋衡另写了更正页，让旧账与补货各自留存；物资损失补齐了，曾经画过的假押仍有记录。',
      },
      {
        id: 'pay-ledger-compensation', label: '按二十一块元石退赔',
        description: '支付 21 元石，保留药草；信任 +4、疑心 -8，教习关系 +4。无需手中还有原材料。',
        requirements: [{ kind: 'resource', key: 'stones', min: 21 }],
        effects: { resources: { stones: -21 }, trust: 4, suspicion: -8, relations: { 'mentor-qiu': 4 }, addFlags: ['ledger-account-settled', 'ledger-repaid'] },
        outcome: '十五块退回不当收款，六块用于补购三份药草。更正页写明钱的去向，也写明原仓单并不属实。这笔账已补齐，信用只能慢慢重建。',
      },
      {
        id: 'confess-ledger', label: '承认假押，留下未偿账的记录',
        description: '不花资源；信任 -10、疑心 +4，教习关系 -8。结束本次核查，未偿账仍会记入章末。',
        effects: { trust: -10, suspicion: 4, relations: { 'mentor-qiu': -8 }, addFlags: ['ledger-account-settled', 'ledger-confessed'] },
        outcome: '你说出自己收钱画押、没有验货的经过。秋衡收起更正说明，认责没有替公仓补回损失；他对你的判断也变了。这次核查告一段落，未偿账仍留下。',
      },
      {
        id: 'conceal-ledger', label: '坚持旧仓单无误，把缺货推给后来的人',
        description: '保留资源；信任 -5、疑心 +14，教习关系 -12、执事关系 -8。留下尚未澄清的假账争议。',
        effects: { trust: -5, suspicion: 14, relations: { 'mentor-qiu': -12, 'steward-zheng': -8 }, addFlags: ['ledger-account-settled', 'ledger-concealed'] },
        outcome: '你继续维护旧仓单，另外两人的说法却对不上你的时间。盘点材料被一并封存，没人再凭这张签名相信你。这次核查结束，账面与实物的缺口仍没有解释。',
      },
    ],
  },
];
