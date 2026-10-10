import type {
  EndingDef, EnemyDef, EventChoice, EventDef, GuDef, LocationDef,
  NpcDef, RecipeDef, Requirement, ShopItem,
} from './types';

/** The playable opening follows sections 1–20, not the later, deeper inheritance. */
export const FANG_STEPS = [
  { eventId: 'fy-rebirth', flag: 'fy-reborn', title: '夜雨重生', act: 1 },
  { eventId: 'fy-awakening', flag: 'fy-awakened', title: '开窍大典', act: 1 },
  { eventId: 'fy-claim-moonlight', flag: 'fy-moonlight-claimed', title: '领下月光', act: 2 },
  { eventId: 'fy-family', flag: 'fy-family-settled', title: '家宅交涉', act: 2 },
  { eventId: 'fy-rain-refining', flag: 'fy-rain-prepared', title: '雨中试炼', act: 2 },
  { eventId: 'fy-inn', flag: 'fy-lodged', title: '客栈避人', act: 2 },
  { eventId: 'fy-bamboo-wine', flag: 'fy-wine-bought', title: '青竹酒香', act: 3 },
  { eventId: 'fy-lure', flag: 'fy-liquor-lured', title: '月下诱虫', act: 3 },
  { eventId: 'fy-follow', flag: 'fy-trail-found', title: '不捕而随', act: 3 },
  { eventId: 'fy-cave', flag: 'fy-cave-found', title: '山缝遗骸', act: 3 },
  { eventId: 'fy-recording', flag: 'fy-recording-seen', title: '影壁真相', act: 3 },
  { eventId: 'fy-refine-liquor', flag: 'fy-refining-attempted', title: '酒虫难炼', act: 4 },
  { eventId: 'fy-cicada', flag: 'fy-cicada-revealed', title: '六转本命', act: 4 },
  { eventId: 'fy-report', flag: 'fy-first-gu-complete', title: '月光报验', act: 4 },
] as const satisfies ReadonlyArray<{ eventId: string; flag: string; title: string; act: 1 | 2 | 3 | 4 }>;

type FangEventId = typeof FANG_STEPS[number]['eventId'];
type StepContent = Omit<EventDef, 'id' | 'requirements' | 'repeatable' | 'priority'> & { requirements?: Requirement[] };

const prepareLater = (outcome: string): EventChoice => ({
  id: 'prepare-later', label: '暂缓准备',
  description: '保留当前进度；补足所需后，可以回到这里继续。已经用去的探索行动不会返还。',
  effects: {}, outcome,
});

function stepEvent(id: FangEventId, content: StepContent): EventDef {
  const index = FANG_STEPS.findIndex(step => step.eventId === id);
  const step = FANG_STEPS[index];
  const previous = FANG_STEPS[index - 1];
  return {
    ...content, id, priority: 400, repeatable: true,
    requirements: [
      ...(previous ? [{ kind: 'flag' as const, key: previous.flag }] : []),
      { kind: 'flag', key: step.flag, value: false },
      ...(content.requirements ?? []),
    ],
    // A deferred conversation may be reopened; only a resolved choice advances it.
    choices: content.choices.map(choice => choice.id === 'prepare-later' ? choice : {
      ...choice,
      effects: { ...choice.effects, addFlags: [step.flag, ...(choice.effects.addFlags ?? [])] },
    }),
  };
}

export const FANG_EVENTS: EventDef[] = [
  stepEvent('fy-rebirth', {
    title: '夜雨重生', location: 'clan', tag: '第一幕 · 再入青茅', actionCost: 0,
    description: '你是古月方源。窗外仍是青茅山的春雨，手掌却已变回十五岁少年的模样。五百年的经历留在记忆中，旧日修为没有回来，春秋蝉也感应不到。明日便是开窍大典；眼下先借家族立足，寻找能握在自己手里的资源。长生才是你的目标，眼前的轻视与赞誉都只是路上的声音。',
    choices: [
      {
        id: 'recall-future', label: '先整理还记得的机缘',
        description: '记下 1 条线索。你知道酒虫与花酒遗藏有关，却不知道洞口的确切位置。',
        effects: { clues: 1, addFlags: ['fy-memory-planned'] },
        outcome: '你记得，前世有人循着酒虫找到了花酒行者的遗骸。时间、地点都不能照记忆硬猜，真正能用的先机还要亲自查证。方正来替你关窗，你让他先回去休息。',
      },
      {
        id: 'hide-emotions', label: '先收住异样，照常应对弟弟',
        description: '方正关系 +2；记下谨慎行事的打算。',
        effects: { relations: { 'fy-fang-zheng': 2 }, addFlags: ['fy-kept-composure'] },
        outcome: '方正只当你睡不着，没有追问。你不向他透露重生，也没有忘记那只可能引向遗藏的酒虫。先赴开窍大典，再把模糊的记忆变成能用的机会。',
      },
    ],
  }),
  stepEvent('fy-awakening', {
    title: '二十七步，四成四', location: 'academy', tag: '第一幕 · 开窍', actionCost: 0,
    description: '地下花海中，希望蛊投入你的体内。第二十七步，空窍开启，青铜元海只占四成四：丙等资质，与前世一样。家老们的期待迅速冷却。方正匆忙下水，你扶起失足的弟弟，看他继续走到第四十三步。甲等资质，让岸边重新响起惊呼。',
    choices: [
      {
        id: 'accept-result', label: '接受结果，平静退回岸边',
        description: '正式成为一转初阶蛊师；疑心 -2。资质固定为丙等、元海四成四。',
        effects: { suspicion: -2, addFlags: ['fy-accepted-aptitude'] },
        outcome: '你检查空窍，把旁人的失望留在身后。丙等只是眼下的条件，不是停步的理由。学堂会发给新学员一只蛊，那是目前最稳妥的起点。',
      },
      {
        id: 'help-fang-zheng', label: '多叮嘱方正一句，再观察众人',
        description: '正式成为一转初阶蛊师；方正关系 +3、线索 +1。资质不变。',
        effects: { relations: { 'fy-fang-zheng': 3 }, clues: 1, addFlags: ['fy-observed-the-clan'] },
        outcome: '方正还没适应骤然翻转的处境，你已经记住了家老们的目光转向哪里。家族的投入随资质而变；你需要它提供的起点，也需要家族之外的本钱。',
      },
    ],
  }),
  stepEvent('fy-claim-moonlight', {
    title: '领下月光，另留打算', location: 'academy', tag: '第二幕 · 第一只待炼之蛊', actionCost: 0,
    description: '学堂讲完蛊师的基础，也讲起族史中的花酒行者。你记得的遗藏传闻，却与那段英雄故事有些对不上。此前几夜，你已用普通酒水探过寨外，仍不见酒虫。轮到进入蛊室，你领下一只一转月光蛊：它尚未炼化，眼下还不能催动。第一个完成炼蛊的学员，可得二十块元石。',
    choices: [
      {
        id: 'keep-a-reserve', label: '收好月光蛊，继续保留酒虫计划',
        description: '获得待炼月光蛊的记录；疑心 -1。尚不加入可装备蛊囊。',
        effects: { suspicion: -1, addFlags: ['fy-moonlight-held-unrefined'] },
        outcome: '蓝色月牙被你收进衣袋。若始终找不到酒虫，它就是退路；在那之前，你不会急着把手中有限的元石全部投入炼化。先回家宅听听舅父的安排。',
      },
      {
        id: 'ask-about-prize', label: '领蛊时问清头名考核的规矩',
        description: '获得待炼月光蛊的记录；学堂家老关系 +2、疑心 +1。',
        effects: { relations: { 'fy-academy-elder': 2 }, suspicion: 1, addFlags: ['fy-moonlight-held-unrefined', 'fy-prize-understood'] },
        outcome: '你问清了报验流程，家老也多看了你一眼。月光蛊仍未炼成，头名更不是眼下能够保证的事。你带着蛊回家宅，准备先解决修行的花销。',
      },
    ],
  }),
  stepEvent('fy-family', {
    title: '六块元石，两种算盘', location: 'clan', tag: '第二幕 · 家宅', actionCost: 0,
    description: '舅父古月冻土给兄弟俩各六块元石，接着提起过继。方正欣然改口，你却知道：过继之后，便失去继承亲生父母遗产的资格。舅父又提出用两百块元石资助你提前独立门户。十五岁分家同样不合继承条件，这笔钱不能拿。',
    choices: [
      {
        id: 'refuse-adoption', label: '收下应有的资助，明确拒绝过继',
        description: '元石 +6；舅父关系 -4、方正关系 -1、疑心 +1。保留日后的继承资格。',
        effects: { resources: { stones: 6 }, relations: { 'fy-dong-tu': -4, 'fy-fang-zheng': -1 }, suspicion: 1, addFlags: ['fy-refused-adoption'] },
        outcome: '你收下六块元石，却没有接那两百块。舅父的笑容淡了，方正也不理解；你无意解释全部筹算。眼下先把每块元石用在修行和寻虫上。',
      },
      {
        id: 'delay-decision', label: '以尚在学堂为由，把分家之议推后',
        description: '元石 +6；舅父关系 -1、方正关系 +1、疑心 +3。没有答应过继或提前分家。',
        effects: { resources: { stones: 6 }, relations: { 'fy-dong-tu': -1, 'fy-fang-zheng': 1 }, suspicion: 3, addFlags: ['fy-delayed-family-pressure'] },
        outcome: '话说得平缓，结果仍旧清楚：六块修行资助留下，两百块分家钱不动。舅父听出了你的防备，往后恐怕会更留意你的行踪。',
      },
    ],
  }),
  stepEvent('fy-rain-refining', {
    title: '雨洗酒气，暂试炼蛊', location: 'clan', tag: '第二幕 · 雨中筹备', actionCost: 1,
    description: '连日暴雨冲散了酒香，再在寨外游荡也难有收获。你收住探索，在屋内尝试炼化月光蛊。丙等空窍的真元有限，蛊的意志却不断排斥入侵。此时只为摸清代价，月光蛊仍未炼成；还得留钱租下客栈房间，并寻找更合适的酒。',
    choices: [
      {
        id: 'spend-one-stone', label: '用一块元石补充真元，细察抵抗',
        description: '支付 1 元石；真元 +4、线索 +1，记下炼化经验。',
        requirements: [{ kind: 'resource', key: 'stones', min: 1 }],
        effects: { resources: { stones: -1 }, qi: 4, clues: 1, addFlags: ['fy-refining-cost-measured'] },
        outcome: '你看清了真元消耗的速度，没有继续把钱填进去。雨势将歇，家中的监视也越发碍事；换个住处，才能把探索与炼蛊握在自己手里。',
      },
      {
        id: 'wait-for-qi', label: '任真元自然恢复，把元石留下',
        description: '不花元石；真元 +2。记录试炼，月光蛊尚未炼成。',
        effects: { qi: 2, addFlags: ['fy-kept-refining-reserve'] },
        outcome: '这场雨正好让你确认：按眼下资质硬追头名，耗费太大。你将元石留住，准备避开家中监视，到客栈租一间能独处的房间。',
      },
      prepareLater('你停下这次试炼，保留月光蛊与已经知道的情况。之后仍可在家宅完成雨中的准备。'),
    ],
  }),
  stepEvent('fy-inn', {
    title: '借一间房，避开耳目', location: 'market', tag: '第二幕 · 客栈', actionCost: 0,
    description: '沈翠的试探让你看清，家宅里的耳目不会让你安静修行。你离开暂住客栈，这不等于提前分家。店家要两块元石，饭堂里人来人往；选好应对方式，便有了一处暂时能关上房门的地方。',
    choices: [
      {
        id: 'rent-quiet-room', label: '支付房钱，少说自己的行程',
        description: '支付 2 元石；疑心 -2。入住客栈，避开家中的贴身监视。',
        requirements: [{ kind: 'resource', key: 'stones', min: 2 }],
        effects: { resources: { stones: -2 }, suspicion: -2, addFlags: ['fy-quiet-room'] },
        outcome: '你把行李放进房内，没有向掌柜解释夜间出入的打算。饭堂中飘来酒气，你下楼吃饭，也留心起这里卖的酒。',
      },
      {
        id: 'rent-and-register', label: '支付房钱，请掌柜照应日常起居',
        description: '支付 2 元石；掌柜关系 +3、疑心 +1。店家会记住这位新住客。',
        requirements: [{ kind: 'resource', key: 'stones', min: 2 }],
        effects: { resources: { stones: -2 }, relations: { 'fy-innkeeper': 3 }, suspicion: 1, addFlags: ['fy-innkeeper-remembers'] },
        outcome: '掌柜收了钱，记下你的饭食与住处。有人照应日常，也意味着行踪更容易被记住。你来到饭堂，准备再看一看这里的酒。',
      },
      prepareLater('你没有交房钱，入住尚未办妥。回家宅整理份例可以补足元石，之后再来客栈继续。'),
    ],
  }),
  stepEvent('fy-bamboo-wine', {
    title: '青竹酒香', location: 'market', tag: '第三幕 · 换一种酒', actionCost: 0,
    description: '饭堂中，江牙借一坛酒威吓猎户，青竹酒的香气却让你留了心。此前的普通酒水没有引出酒虫，眼前这坛酒也许值得试试。你是一名学员，没必要为这场争执出手；用两块元石买酒，把它带到雨后的竹林才是正事。',
    choices: [
      {
        id: 'buy-after-dispute', label: '等争执缓下来，再向小二买酒',
        description: '支付 2 元石，获得 1 份青竹酒；疑心 -1。',
        requirements: [{ kind: 'resource', key: 'stones', min: 2 }],
        effects: { resources: { stones: -2, wine: 1 }, suspicion: -1, addFlags: ['fy-wine-bought-quietly'] },
        outcome: '你拿到青竹酒，没有把自己卷进那场威吓。雨已经停了，未搜过的竹林还有一片。今晚带着这坛酒去试。',
      },
      {
        id: 'buy-openly', label: '当着江牙的面，照价买下一坛',
        description: '支付 2 元石，获得 1 份青竹酒；江牙关系 +2、疑心 +2。',
        requirements: [{ kind: 'resource', key: 'stones', min: 2 }],
        effects: { resources: { stones: -2, wine: 1 }, relations: { 'fy-jiang-ya': 2 }, suspicion: 2, addFlags: ['fy-jiang-ya-recognized'] },
        outcome: '江牙认出你身上的真元气息，换了副对学弟的面孔。你提酒离开，没有解释用途。饭堂里却已有几个人记住，这个少年买走了一坛好酒。',
      },
      prepareLater('这坛青竹酒还没有买下。先补足两块元石再来；寻找酒虫的计划仍然保留。'),
    ],
  }),
  stepEvent('fy-lure', {
    title: '月下竹林，一点白影', location: 'bamboo', tag: '第三幕 · 诱虫', actionCost: 1,
    description: '雨后的空气清澈，酒香更易散开；此前搜过的区域已被逐一排除。你在尚未探过的竹林中揭开青竹酒，等着记忆里的机会出现。酒虫不会因为你重生便自己送上门，布饵与等待仍要亲自完成。',
    choices: [
      {
        id: 'spread-the-bait', label: '分几处布下酒饵，逐一等待',
        description: '消耗 1 份青竹酒；线索 +1。耐心观察酒香覆盖的区域。',
        requirements: [{ kind: 'resource', key: 'wine', min: 1 }],
        effects: { resources: { wine: -1 }, clues: 1, addFlags: ['fy-bait-spread'] },
        outcome: '几处草叶都沾了酒露。就在你以为仍会落空时，月光照出竹竿上的一团白影。是酒虫。它尚在警惕，先退开，让它喝醉，再往溪边追踪。',
      },
      {
        id: 'use-the-last-drops', label: '把余酒集中在花丛，隐身守候',
        description: '消耗 1 份青竹酒；疑心 -2，记下守候的位置。',
        requirements: [{ kind: 'resource', key: 'wine', min: 1 }],
        effects: { resources: { wine: -1 }, suspicion: -2, addFlags: ['fy-bait-concentrated'] },
        outcome: '浓香留在一处，你在远一些的竹影中安静等候。白色酒虫终于落下来。现在硬扑很可能惊走它；让它喝足，才能跟上它飞向溪边的方向。',
      },
      prepareLater('你先收住这次布饵，保留已经排查的范围。若酒已用尽，客栈酒肆仍可补买青竹酒；备妥后回竹林继续。'),
    ],
  }),
  stepEvent('fy-follow', {
    title: '让它带路', location: 'stream', tag: '第三幕 · 追踪', actionCost: 1,
    description: '酒虫喝得摇摇晃晃，飞行也慢了下来。你没有趁机捉住它，而是追出竹林，沿着溪水向上。流水声渐渐变成瀑声，酒虫将要钻进一块巨石的狭缝。先认清去路，再谈收获。',
    choices: [
      {
        id: 'follow-from-distance', label: '沿岸留些距离，压低脚步声',
        description: '疑心 -1；记住通向石缝的路径，不损耗生命。',
        effects: { suspicion: -1, addFlags: ['fy-followed-carefully'] },
        outcome: '你没有逼近到惊动酒虫的距离。白影在巨石边一闪而没，水从狭缝里渗出来。入口已经找到，可以前往花酒石洞查看。',
      },
      {
        id: 'keep-close', label: '踏过湿石，贴近观察它的去向',
        description: '生命 -2；线索 +1。需要至少 3 生命，避免带着重伤冒险。',
        requirements: [{ kind: 'stat', key: 'hp', min: 3 }],
        effects: { hp: -2, clues: 1, addFlags: ['fy-followed-closely'] },
        outcome: '湿石擦破了小腿，你也看清了酒虫钻入狭缝的位置与水流方向。它没有被抓走，仍在洞中。先留意伤势，再进入石洞。',
      },
      prepareLater('你记住溪边已经走过的路，暂时收住脚步。调整好状态后，可以从这里继续追踪。'),
    ],
  }),
  stepEvent('fy-cave', {
    title: '山缝中的遗骸', location: 'cave', tag: '第三幕 · 初探遗藏', actionCost: 1,
    description: '你侧身穿过巨石狭缝，洞内有淡淡红光。酒囊花与饭袋草大多早已枯死，酒虫就在死根上沉睡。拨开枯藤，花酒行者的遗骸露了出来。眼前是他遗留的洞厅，不是已经探尽的整座传承。',
    choices: [
      {
        id: 'check-the-exit', label: '先认清退路，再收起酒虫与钱袋',
        description: '元石 +15、疑心 -1；得到待炼酒虫。它尚不能装备或使用。',
        effects: { resources: { stones: 15 }, suspicion: -1, addFlags: ['fy-liquor-held-unrefined', 'fy-exit-checked'] },
        outcome: '你收好酒虫，钱袋里只有十五块元石。数量不多，却足以让起步轻松些。枯藤移动时，石壁忽然传来声音；先别急着把它当作活人。',
      },
      {
        id: 'search-before-rest', label: '忍着擦伤，先检查遗骸周围',
        description: '元石 +15、线索 +1、生命 -2；得到待炼酒虫。需要至少 3 生命。',
        requirements: [{ kind: 'stat', key: 'hp', min: 3 }],
        effects: { resources: { stones: 15 }, hp: -2, clues: 1, addFlags: ['fy-liquor-held-unrefined', 'fy-remains-examined'] },
        outcome: '你确认了洞内枯死的花草蛊，收下沉睡的酒虫与十五块元石。再没有一袋凭空出现的巨款。就在此时，石壁上浮出的人影打断了你的检查。',
      },
      prepareLater('你先退出狭缝，没有取走酒虫和钱袋。入口仍然记着，状态好转后可以再来。'),
    ],
  }),
  stepEvent('fy-recording', {
    title: '石壁记着另一段历史', location: 'cave', tag: '第三幕 · 留影存声', actionCost: 0,
    description: '声音与影像来自留影存声蛊。你看到四代族长战败求饶后出手偷袭，又被花酒行者击杀；花酒也带着重伤遁走。学堂里传颂的版本颠倒了双方的位置。你终于理解，前世发现遗藏的蛊师为什么会把消息交给家族。这个秘密的分量，不止一只酒虫。',
    choices: [
      {
        id: 'study-the-recording', label: '把影像中的先后次序完整记住',
        description: '线索 +2、疑心 +1。停留更久，保留较完整的见闻。',
        effects: { clues: 2, suspicion: 1, addFlags: ['fy-recording-studied', 'fy-inheritance-kept-secret'] },
        outcome: '你把影像与学堂的说法逐条对照。夜归得更晚，也换来了更完整的判断。你没有交出酒虫与洞口，接下来回客栈，先解决炼化它的难题。',
      },
      {
        id: 'remember-the-outline', label: '记住关键事实，及时收住行踪',
        description: '线索 +1、疑心 -2。保留要点后离开，暂不对外声张。',
        effects: { clues: 1, suspicion: -2, addFlags: ['fy-recording-summary', 'fy-inheritance-kept-secret'] },
        outcome: '你已知道这处遗藏不能轻易拿去邀功。影壁仍留在洞内，你带着酒虫与元石返回客栈，没有宣称自己已取得花酒行者的全部传承。',
      },
    ],
  }),
  stepEvent('fy-refine-liquor', {
    title: '旧主留下的意志', location: 'market', tag: '第四幕 · 初炼酒虫', actionCost: 1,
    description: '客栈房内，酒虫对真元的抵抗远超预料。你判断，这或许曾是花酒行者的本命蛊，品阶虽已跌落，强者的意志却仍残留其中。求助家老会暴露来历；你关好门，准备独自处理。此时月光与酒虫都还没有炼成。',
    choices: [
      {
        id: 'rest-between-attempts', label: '分段尝试，用自然恢复维持真元',
        description: '不花元石；真元 +2、疑心 +1。减少支出，但长期闭门会被人留意。',
        effects: { qi: 2, suspicion: 1, addFlags: ['fy-refined-patiently'] },
        outcome: '你没有把全部元石耗在一次蛮攻里。反复侵入后，酒虫突然蜷成一团，意志直冲空窍。你停下其他念头，准备迎住反噬；这件事还没有结束。',
      },
      {
        id: 'use-stones', label: '用三块元石维持持续炼化',
        description: '支付 3 元石；真元 +4、疑心 -1。缩短反复恢复所花的时间。',
        requirements: [{ kind: 'resource', key: 'stones', min: 3 }],
        effects: { resources: { stones: -3 }, qi: 4, suspicion: -1, addFlags: ['fy-refined-with-stones'] },
        outcome: '有元石补充，真元能持续包住酒虫，它却始终不肯屈服。突然，酒虫把残留意志推入你的空窍，孤注一掷地反噬。你立刻收拢心神，准备应对。',
      },
      prepareLater('你中止这一轮炼化，酒虫与月光仍由你保管。先休整或补足元石，回到客栈房间后仍可继续。'),
    ],
  }),
  stepEvent('fy-cicada', {
    title: '六转本命，仍在空窍', location: 'market', tag: '第四幕 · 春秋蝉', actionCost: 0,
    description: '反噬冲入空窍，一只枯木色的蝉忽然显形。六转春秋蝉并未消亡，只是重伤沉眠，连你先前也感应不到。它的气息顷刻压服酒虫。前世的炼化联系仍在，它才是你的本命蛊。现在催动重生只会送命；借一丝气息镇住低转蛊的意志，却足以改写这次炼蛊的局面。',
    choices: [
      {
        id: 'steady-the-aperture', label: '稳住空窍，依次炼成酒虫与月光',
        description: '获得可用酒虫、月光蛊各 1；线索 +1。春秋蝉仍是虚弱的六转本命蛊。',
        effects: { gu: { 'liquor-worm': 1, moonlight: 1 }, clues: 1, removeFlags: ['fy-moonlight-held-unrefined', 'fy-liquor-held-unrefined'], addFlags: ['fy-liquor-refined', 'fy-moonlight-refined', 'fy-vital-cicada', 'fy-cicada-understood'] },
        outcome: '你先彻底炼成酒虫，再用同样的气息压服并炼成月光蛊。酒虫可提纯青铜真元，资质却仍是丙等，修为仍是一转初阶。你让春秋蝉重新隐去，把酒虫藏妥，准备只向学堂报验月光。',
      },
      {
        id: 'conceal-the-aura', label: '只借最少气息，炼成后立即收敛',
        description: '获得可用酒虫、月光蛊各 1；疑心 -2。没有催动春秋蝉的重生能力。',
        effects: { gu: { 'liquor-worm': 1, moonlight: 1 }, suspicion: -2, removeFlags: ['fy-moonlight-held-unrefined', 'fy-liquor-held-unrefined'], addFlags: ['fy-liquor-refined', 'fy-moonlight-refined', 'fy-vital-cicada', 'fy-cicada-aura-hidden'] },
        outcome: '酒虫先被炼成，月光随后也归你掌控。你收拢气息，让虚弱的春秋蝉继续休养；它不是一件可拿去交锋的兵器。只留下月光的印记，学堂的头名奖励现在有机会争取。',
      },
    ],
  }),
  stepEvent('fy-report', {
    title: '只报月光，取下头名', location: 'academy', tag: '第四幕 · 本章收束', actionCost: 0,
    requirements: [{ kind: 'gu', id: 'moonlight' }, { kind: 'gu', id: 'liquor-worm' }],
    description: '春秋蝉已经隐去，酒虫也已被你妥善藏起，不向家老展示。你来到学堂，只展示已炼成的月光蛊。家老起初把你认作方正，听清名字才露出惊讶。丙等资质的方源先一步完成了报验，二十块元石的头名奖励就在眼前。',
    choices: [
      {
        id: 'report-moonlight', label: '按规矩报验，领取二十块元石',
        description: '元石 +20；学堂家老关系 +4、疑心 +2。完成本章，保留真实所得与选择记录。',
        effects: { resources: { stones: 20 }, relations: { 'fy-academy-elder': 4 }, suspicion: 2, addFlags: ['fy-reported-directly'] },
        ending: 'fy-first-gu',
        outcome: '家老核验了月光蛊，将头名奖励交给你。资质没有改变，手中的资源与先机却已不同。酒虫、月光和十五块遗藏元石的来路，由你自己记着；花酒洞中更深的传承还没有开启。',
      },
      {
        id: 'answer-briefly', label: '简短答话，把炼蛊细节留在心里',
        description: '元石 +20；学堂家老关系 +1、疑心 -1。照常领取头名，不透露酒虫与春秋蝉。',
        effects: { resources: { stones: 20 }, relations: { 'fy-academy-elder': 1 }, suspicion: -1, addFlags: ['fy-reported-briefly'] },
        ending: 'fy-first-gu',
        outcome: '你回答了报验所需的问题，没有谈起洞中所得与空窍里的秘密。二十块元石到手，这只是重新起步。下一步仍要供养蛊虫、温养空窍，再探影壁之后的路。',
      },
    ],
  }),
];

export const FANG_LOCATIONS: LocationDef[] = [
  {
    id: 'academy', name: '古月学堂', subtitle: '开窍入道 · 月光初炼', x: 23, y: 36, danger: 'safe',
    description: '宗族以资质安排资源，也以炼蛊成绩衡量学员。你的起点来自这里，真正的打算不必全写在名册上。',
    activity: { label: '整理课册', description: '耗 1 行动，获得 2 元石。做些课册杂务，为修行补足开支。', effects: { resources: { stones: 2 } } },
  },
  {
    id: 'market', name: '客栈酒肆', subtitle: '暂借一室 · 酒香有价', x: 64, y: 72, danger: 'safe',
    description: '楼下有饭食与青竹酒，楼上有一间能关上门的客房。照料日常、搜集消息与避开耳目，都要在这里拿捏分寸。',
    activity: { label: '帮工结账', description: '耗 1 行动，获得 2 元石。帮掌柜整理货物，换取一点报酬。', effects: { resources: { stones: 2 } } },
  },
  {
    id: 'bamboo', name: '寨外竹林', subtitle: '雨停风清 · 借酒诱虫', x: 73, y: 22, danger: 'wild',
    description: '青矛竹遮住寨中的灯火。你已排除一些旧搜索区域，这片尚未细查的竹林值得带着好酒再试一次。',
    activity: { label: '收集止血草', description: '耗 1 行动，获得 1 药草。沿已经认清的林边备些伤药。', effects: { resources: { herbs: 1 } } },
  },
  {
    id: 'stream', name: '山溪石径', subtitle: '白影循溪 · 瀑声渐近', x: 81, y: 46, danger: 'wild',
    description: '酒虫沿着溪水上行，湿石和水声掩着它的去向。你要跟住它，也要记住回来的路。',
    activity: { label: '择石歇脚', description: '耗 1 行动，恢复 2 生命、2 真元。避开湿滑处，缓一缓奔行的疲惫。', effects: { hp: 2, qi: 2 } },
  },
  {
    id: 'cave', name: '花酒石洞', subtitle: '遗骸初见 · 影壁藏史', x: 43, y: 13, danger: 'danger',
    description: '巨石狭缝通向一处隐秘洞厅。酒虫、遗骸与留影存声蛊留下了先机，也留下不能轻易示人的旧史。',
    activity: { label: '掩去入口足迹', description: '耗 1 行动，疑心 -2。整理自己留下的痕迹，不会开启新的传承。', effects: { suspicion: -2 } },
  },
  {
    id: 'clan', name: '舅父家宅', subtitle: '寄身屋檐 · 家产未归', x: 24, y: 69, danger: 'safe',
    description: '舅父古月冻土与舅母代管着双亲遗产。你与方正住在同一屋檐下，两人的资质却让长辈有了不同的算盘。',
    activity: { label: '整理份例', description: '耗 1 行动，获得 2 元石。清点分给自己的杂物，换回可用的零碎元石。', effects: { resources: { stones: 2 } } },
  },
];

export const FANG_NPCS: NpcDef[] = [
  { id: 'fy-fang-zheng', name: '古月方正', role: '孪生弟弟', motive: '多年活在兄长的才名之下，希望证明自己；甲等资质使他的处境迅速改变。', location: 'clan' },
  { id: 'fy-dong-tu', name: '古月冻土', role: '舅父', motive: '代管兄弟双亲的家产，试图用过继或提前分家保住利益。', location: 'clan' },
  { id: 'fy-aunt', name: '舅母', role: '抚养你的长辈', motive: '与舅父共同盘算家产，也会把照顾与期待投向更有前途的一方。', location: 'clan' },
  { id: 'fy-shen-cui', name: '沈翠', role: '家中侍女', motive: '依靠舅母与管家母亲的安排寻找出路，也是家宅留意你行踪的一双眼睛。', location: 'clan' },
  { id: 'fy-academy-elder', name: '学堂家老', role: '学堂负责人', motive: '看重资质与成绩，按族规分配学员的修行资源。', location: 'academy' },
  { id: 'fy-clan-chief', name: '古月博', role: '古月族长', motive: '希望培养出支撑宗族的天才，对甲等资质的方正寄予厚望。', location: 'academy' },
  { id: 'fy-innkeeper', name: '客栈掌柜', role: '客栈与酒食生意人', motive: '照价做生意，愿意照应付清房钱的住客，也记得谁常在夜里出入。', location: 'market' },
  { id: 'fy-jiang-ya', name: '江牙', role: '一转蛊师', motive: '看重蛊师身份，在饭堂对凡人逞威，对学员却另眼相看。', location: 'market' },
];

export const FANG_GU: GuDef[] = [
  {
    id: 'moonlight', name: '月光蛊', glyph: '☾', rank: 1, role: 'attack',
    description: '以真元催发月刃：6 伤害，消耗 2 真元。每日供养折算为 1 元石，用于采购月兰花瓣。',
    lore: '古月一族的代表蛊虫。你先在蛊室领下它，直到借春秋蝉的气息压服其意志，才真正炼成。',
    upkeep: 1, price: 14, ability: 'strike', power: 6, qiCost: 2, passive: false,
  },
  {
    id: 'liquor-worm', name: '酒虫', glyph: '酿', rank: 1, role: 'support',
    description: '提纯真元。携带且供养正常时，一次温养空窍最多获得 4 修为，通常最多为 3；每日供养折算为 1 元石采购酒食。',
    lore: '循酒香引出的珍贵蛊。它使真元具备高一小阶的质量，不改变丙等资质或当前境界。温养收益是本章对提纯优势的简化。',
    upkeep: 1, price: 18, ability: 'purify', power: 0, qiCost: 0, passive: true,
  },
];

export const FANG_SHOP: ShopItem[] = [
  { id: 'fy-bamboo-wine', name: '青竹酒', description: '补备一份可用于竹林诱虫的好酒。', price: 2, stock: 99, effects: { resources: { wine: 1 } } },
  { id: 'fy-herbs', name: '止血药草', description: '两份常备药草，留作处理山路擦伤的储备。', price: 2, stock: 99, effects: { resources: { herbs: 2 } } },
];

export const FANG_ENEMIES: EnemyDef[] = [];
export const FANG_RECIPES: RecipeDef[] = [];
export const FANG_ENDINGS: EndingDef[] = [
  {
    id: 'fy-first-gu', title: '月光在明，春秋在隐', subtitle: '第一章 · 初炼双蛊', color: '#91b6a5',
    description: '你以月光蛊拿到学堂头名，酒虫与虚弱的春秋蝉仍藏在自己的安排之中。一转初阶、丙等四成四，起点没有改写；五百年经验换来的先机，已经落成手中的资源。花酒洞的更深传承与之后的学堂生活，尚待下一章。',
  },
];
