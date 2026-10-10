import { ENDINGS, EVENTS, GU, NPCS } from './content';
import { getActionError, getAvailableEvents } from './engine';
import type { GameState, LegacyEndingId } from './types';

export interface ChapterProgress {
  stage: 1 | 2 | 3;
  stageTitle: string;
  stageDescription: string;
  beats: Array<{ id: string; title: string; description: string; done: boolean; current: boolean }>;
  nextEventId: string | null;
  milestones: Array<{ id: string; label: string; detail: string; done: boolean }>;
  looseEnds: Array<{ id: string; title: string; description: string; eventId: string; status: 'pending' | 'settled' | 'avoided' }>;
}

export interface ChapterEpilogue {
  heading: string;
  introduction: string;
  threads: Array<{ id: string; title: string; text: string; tone: 'good' | 'warn' | 'neutral' }>;
  people: Array<{ id: string; name: string; relation: number; text: string }>;
  carryover: {
    rank: number;
    cultivation: number;
    stones: number;
    gu: Array<{ id: string; name: string; count: number }>;
    choices: string[];
  };
  future: string;
}

const ROUTE_NAMES: Record<LegacyEndingId, string> = {
  inheritance: '独掌遗藏', clan: '宗族立足', departure: '随队远行',
};
const ROUTES: LegacyEndingId[] = ['inheritance', 'clan', 'departure'];
const has = (game: GameState, flag: string): boolean => game.flags.includes(flag);
const seen = (game: GameState, eventId: string): boolean => game.seenEvents.includes(eventId);
const recordedRoute = (game: GameState, prefix: string): LegacyEndingId | undefined => ROUTES.find(route => has(game, `${prefix}${route}`));

function accounts(game: GameState): ChapterProgress['looseEnds'] {
  return ([
    { id: 'pouch', flag: 'kept-pouch', title: '石缝包袱的旧账', eventId: 'chapter-pouch-inquiry', goods: '公物', source: '你曾取走包袱中的玉皮蛊与七块元石' },
    { id: 'ledger', flag: 'false-ledger', title: '旧仓单的假押', eventId: 'chapter-ledger-inquiry', goods: '公仓损失', source: '你曾收钱在缺货的旧仓单上画押' },
  ] as const).filter(item => has(game, item.flag)).map(item => {
    const repaid = has(game, `${item.id}-repaid`);
    const confessed = has(game, `${item.id}-confessed`);
    const concealed = has(game, `${item.id}-concealed`);
    const answered = has(game, `${item.id}-account-settled`);
    const description = repaid
      ? `${item.source}，后来已归还或折价赔付${item.goods}。先前行为仍有记录，偿还只挽回了部分信用。`
      : confessed
        ? `${item.source}，在追问中认责但未偿还。这次问话已结束，未偿旧账仍保留。`
        : concealed
          ? `${item.source}，在追问中仍选择隐瞒。口供争议与未追回的${item.goods}仍然存在，没有因此免罪。`
          : answered
            ? `${item.source}。本次问话已有记录，但没有足额偿还的凭据，仍须保留这笔未偿旧账。`
            : `${item.source}，尚未对这笔旧账作出交代。事情未解决，欠物与失信没有因此消失。`;
    return {
      id: `${item.id}-account`, title: item.title, description, eventId: item.eventId,
      status: concealed ? 'avoided' as const : repaid || confessed || answered ? 'settled' as const : 'pending' as const,
    };
  });
}

/** Read-only chapter presentation. Growth records are suggestions, never ending requirements. */
export function getChapterProgress(game: GameState): ChapterProgress | null {
  if (game.campaign === 'fang-yuan' || !has(game, 'chapter-one')) return null;
  const definitions = [
    { id: 'chapter-arrival', flag: 'chapter-arrival-read', title: '入山立足', description: '在学堂说明为何起行，认清十日期限与三条去路。' },
    { id: 'chapter-council', flag: 'chapter-council-read', title: '查证交涉', description: '核实至少一条情报，再到议事楼说明合作边界；此时不会交出遗藏。' },
    { id: 'chapter-resolution', flag: 'chapter-ready', title: '决意去留', description: '回学堂理清准备方向，再到遗藏、议事楼或市集完成最后的选择。' },
  ];
  const pendingIndex = definitions.findIndex(item => !has(game, item.flag));
  const stage = (pendingIndex < 0 ? 3 : pendingIndex + 1) as ChapterProgress['stage'];
  const plan = recordedRoute(game, 'chapter-plan-');
  const definition = definitions[stage - 1]!;
  const stageDescription = game.ending
    ? '此行已经结束。章末按实际选择与结果回顾；未完成的准备和旧账也会如实保留。'
    : pendingIndex < 0
      ? `你已理清${plan ? `「${ROUTE_NAMES[plan]}」的` : ''}准备方向。仍可改变去路；满足对应条件后作出终局选择，合炼、突破与普通战斗均为可选准备。`
      : definition.description;
  let nextEventId: string | null = null;
  if (pendingIndex >= 0 && !game.ending && !game.combat && !game.activeEvent) {
    const eventId = definitions[pendingIndex]!.id;
    const event = EVENTS.find(item => item.id === eventId);
    if (event) {
      const there = { ...game, location: event.location };
      if (getAvailableEvents(there).some(item => item.id === eventId)
        && !getActionError(there, { type: 'EXPLORE', eventId })) nextEventId = eventId;
    }
  }
  return {
    stage, stageTitle: definition.title, stageDescription, nextEventId,
    beats: definitions.map((item, index) => ({
      id: item.id, title: item.title, description: item.description,
      done: index === 2 ? game.ending?.outcome === 'success' : has(game, item.flag),
      current: index === stage - 1 && !game.ending,
    })),
    milestones: [
      { id: 'equipped', label: '调整随身蛊', detail: '记录一次有效装备，确认蛊的品阶与作用。', done: has(game, 'milestone-equipped') },
      { id: 'upkeep', label: '安排供养', detail: '结清一次真实供养，或成功补喂休眠的蛊。', done: has(game, 'milestone-upkeep') },
      { id: 'trained', label: '积累修为', detail: '进行一次修炼，为可选的境界突破作准备。', done: has(game, 'milestone-trained') },
      { id: 'battle', label: '赢下一场交锋', detail: '赢下一场普通遭遇；和平路线可以跳过。', done: has(game, 'milestone-battle') },
      { id: 'crafted', label: '完成一次合炼', detail: '成功合炼一种蛊；按需选择，并非通关门槛。', done: has(game, 'milestone-crafted') },
      { id: 'rank', label: '突破二转', detail: '达到二转可用更多蛊；一转也能完成和平结局。', done: game.rank >= 2 },
    ],
    looseEnds: accounts(game),
  };
}

function commissionThreads(game: GameState): ChapterEpilogue['threads'] {
  const result: ChapterEpilogue['threads'] = [];
  if (has(game, 'rain-route-bonded')) {
    const verified = has(game, 'rain-route-verified');
    const settled = has(game, 'rain-route-settled');
    const failed = has(game, 'rain-route-failed');
    const taskAbandoned = seen(game, 'stream-rain-survey') && !verified && !failed;
    const settlementAbandoned = seen(game, 'market-rain-settlement') && !settled;
    const text = settled
      ? has(game, 'rain-route-endorsed')
        ? '你验明了雨路，领取八块元石，并把其余报酬换成共同署名与宗族信用；这份委托已结清。'
        : '你验明了雨路，已领取包含押金在内的二十块元石。现金结款已完成，没有同时领取宗族推荐。'
      : failed ? '验路战斗未能完成，结款机会已经失去。押金用于另雇验路人，没有获得验路报酬。'
        : taskAbandoned ? '你放弃了验路，没有取得凭据。押金没有退回，这份委托未完成。'
          : settlementAbandoned ? '你验明了通路，却谢绝了这次结款；押金和酬劳均未领取，结款机会已经结束。'
            : verified
              ? game.day < 4
                ? '雨路已核验，但第 4 日才开放结款。本章提前结束时尚未领取报酬，不能记作已兑现。'
                : game.day > 9
                  ? '雨路已核验，却错过了第 4–9 日的市集结款期；押金和酬劳均未领取。'
                  : '雨路已核验，凭据齐备；本章结束时尚未在市集结款，押金和酬劳仍未领取。'
              : game.day > 8
                ? '你交过验路押金，却未在第 8 日结束前核验通路；已错过验路期限，没有结款资格。'
                : '你交过押金，但本章结束时还没有验路凭据。验路与报酬均未完成，投入没有退回。';
    result.push({ id: 'rain-route', title: '雨路验路单', text, tone: settled ? 'good' : 'warn' });
  }
  if (has(game, 'medicine-pledged')) {
    const recovered = has(game, 'medicine-box-recovered');
    const settled = has(game, 'medicine-settled');
    const taskAbandoned = seen(game, 'cave-remedy-cache') && !recovered;
    const settlementAbandoned = seen(game, 'clan-remedy-settlement') && !settled;
    const diverted = has(game, 'medicine-diverted');
    const text = settled
      ? diverted
        ? '药苗由商队买断，你领取二十六块元石，苏蘅也分得报酬；公仓未得到这批药，宗族信任因此受损。'
        : has(game, 'medicine-public-stock')
          ? '药苗交入公仓，你领取十块元石与宗族信用。这次没有领取白豕、玉皮，委托已经兑现。'
          : '你交付药匣，领取白豕蛊与玉皮蛊各一只。这是当时得到的报酬，当前是否仍持有以蛊囊快照为准。'
      : taskAbandoned ? '你放弃取匣，尚未取得药匣或报酬。前期交付的引路药或小光蛊没有退还。'
        : settlementAbandoned ? '你已把封匣留给药棚，却主动谢绝结算；没有领取蛊、元石或贡献报酬。'
          : recovered
            ? game.day < 4
              ? '药匣已经取回，但第 4 日才开放交付。本章提前结束，药匣未交付，报酬未领取。'
              : '药匣已回收，但本章结束时尚未交付药棚，也未选择报酬；不能算作药苗已经入公仓。'
            : game.day > 8
              ? '准备的引路药或小光蛊已经交付，但第 8 日结束前未取回药匣；取匣期限已过，没有领取报酬。'
              : '你做过取药准备，本章结束时仍未取回药匣。前期投入没有退回，也没有得到报酬。';
    result.push({ id: 'medicine', title: '遗藏药匣', text, tone: settled ? diverted ? 'neutral' : 'good' : 'warn' });
  }
  return result;
}

function peopleNotes(game: GameState): ChapterEpilogue['people'] {
  const notes = new Map<string, string[]>();
  const add = (id: string, text: string) => notes.set(id, [...(notes.get(id) ?? []), text]);
  if (has(game, 'chapter-arrival-read')) add('mentor-qiu', '秋衡向你说明十日期限，听过你的起行动机。');
  if (has(game, 'chapter-council-read')) {
    add('steward-zheng', '正岑与你谈过宗族合作的条件；当时的表态并未决定遗藏归属。');
    add('merchant-yan', '严砚与你说明过商队同行的期限和费用。');
  }
  if (has(game, 'mentor-promise')) add('mentor-qiu', seen(game, 'academy-private-lesson')
    ? '额外指点的会面已告一段落，灯下的这份交情留在了手札中。'
    : '他答应过额外指点，本章结束时这次机会尚未处理。');
  if (has(game, 'merchant-pact')) add('merchant-yan', has(game, 'merchant-settled')
    ? '先前送货的互惠约定已兑现，你领取过现金或熟客换蛊的其中一种回报。'
    : seen(game, 'market-commission')
      ? '你建立过送货交情，但放弃了那次佣金或熟客换蛊的机会。'
      : '先前送货换来的回报机会，本章结束时尚未兑现。');
  if (has(game, 'scout-pact')) add('scout-lan', '你帮助她接通绳桥，取得过巡山报告的共同署名资格。');
  if (has(game, 'rain-route-verified')) add('scout-lan', '她与你实地核验过雨路；结款结果另见验路单。');
  if (has(game, 'returned-pouch')) add('steward-zheng', '你当初将包袱送还公仓，归还记录已经留下。');
  if (has(game, 'honest-ledger')) add('steward-zheng', '你按实物补进药草，留下了一份能够核查的仓单。');
  if (has(game, 'report-filed')) add('steward-zheng', '你递交的巡山简报已被收下，山路实绩有了凭据。');
  if (has(game, 'healer-pact')) add('healer-su', has(game, 'herb-code')
    ? '你的援助换回了经过辨认的灯室草纹情报。'
    : seen(game, 'stream-healer-return')
      ? '你们在听雨涧的这次会面已经结束，此前的援助仍留在她的记忆中。'
      : '她记着此前的援助，但约好的听雨涧会面尚未处理。');
  if (has(game, 'medicine-pledged')) add('healer-su', '你们建立了取药匣的委托，实际交付结果见药匣记录。');
  if (has(game, 'fang-trade')) add('fang-yuan', '你们交换过材料与经过核实的暗槽图，各自保留其余消息。');
  if (has(game, 'fang-boundary')) add('fang-yuan', seen(game, 'cave-boundary')
    ? '你们处理过互不封堵退路的约定；没有因此建立更广泛的同盟。'
    : '你们约定互不封堵退路，本章结束时尚未在遗藏处处理后续会面。');
  for (const account of accounts(game)) {
    if (account.status !== 'pending' || seen(game, account.eventId)) {
      add(account.id === 'ledger-account' ? 'mentor-qiu' : 'steward-zheng', account.description);
    }
  }
  return NPCS.filter(npc => notes.has(npc.id) || Object.hasOwn(game.relations, npc.id)).map(npc => {
    const relation = game.relations[npc.id] ?? 0;
    const tone = relation > 0 ? '往来留下了一些好感。' : relation < 0 ? '往来仍有隔阂。' : '彼此还谈不上亲近，也没有更多嫌隙。';
    return {
      id: npc.id, name: npc.name, relation,
      text: `${(notes.get(npc.id) ?? ['你们在此行中有过往来，尚未结下具体的互惠约定。']).join(' ')} ${tone}`,
    };
  });
}

/** Build a fresh ending snapshot from saved facts; no source arrays or objects escape. */
export function getChapterEpilogue(game: GameState): ChapterEpilogue | null {
  const { ending } = game;
  if (game.campaign === 'fang-yuan' || !ending || ending.id.startsWith('fy-')) return null;
  const endingId = ending.id as LegacyEndingId;
  const success = ending.outcome === 'success';
  const heading = success
    ? `${ENDINGS.find(item => item.id === ending.id)?.title ?? '旅途结束'} · 本章完成`
    : ending.outcome === 'survived' ? '十日期满 · 存活离山' : '此行败退 · 本章结束';
  const routeText = success
    ? ending.id === 'inheritance'
      ? '你实际战胜了守关木傀，取得石灯遗藏。这次成果归你支配，宗族没有因先前的合作意向自动取得遗藏。'
      : ending.id === 'clan'
        ? '你正式签下宗族约定，让遗藏纳入公产，换得负责此地巡查的位置与修行份额。'
        : '你实际付清三十五块元石路费，凭沿路情报主动取得商队同行资格。遗藏没有因此成为你的所有物。'
    : ending.outcome === 'survived'
      ? '十日期限已到，你未达成三条主动结局，按存活离山结束。本次没有自动买到商队名额，也没有取得遗藏或宗族职位。'
      : '这次行程按败退结束，没有取得终局胜利。本章已获得的物品仍按存档记录保留，未赢下的战斗不会补发奖励。';
  const threads: ChapterEpilogue['threads'] = [{ id: 'route', title: '此行的实际归属', text: routeText, tone: success ? 'good' : 'warn' }];
  const motive = recordedRoute(game, 'chapter-motive-');
  const plan = recordedRoute(game, 'chapter-plan-');
  const stance = has(game, 'chapter-independent') ? '独立调查' : has(game, 'chapter-public') ? '洽谈宗族合作' : has(game, 'chapter-caravan') ? '了解商队同行' : null;
  if (has(game, 'chapter-one')) {
    const initial = motive ? `起行时，你想走「${ROUTE_NAMES[motive]}」的路。` : '最初的动机未在这份手札中写明。';
    const intent = plan ? `你后来按「${ROUTE_NAMES[plan]}」作过准备。` : '你没有完成临行前的方向确认。';
    const outcome = !success ? '这次尚未把计划变成主动结局。' : motive && motive !== ending.id ? '最终选择与最初动机不同，实际归属以本次结局为准。' : '最终成果以你实际作出的终局选择为准。';
    threads.push({ id: 'intention', title: '从初衷到选择', text: `${initial}${stance ? `交涉时，你选择${stance}。` : ''}${intent}${outcome}`, tone: 'neutral' });
  }
  threads.push(...commissionThreads(game));
  const looseEnds = accounts(game);
  threads.push(...looseEnds.map(item => ({
    id: item.id, title: item.title, text: item.description,
    tone: has(game, item.id === 'pouch-account' ? 'pouch-repaid' : 'ledger-repaid') ? 'good' as const : 'warn' as const,
  })));
  const choices = [
    ...(motive ? [`起行动机：${ROUTE_NAMES[motive]}`] : []),
    ...(stance ? [`交涉立场：${stance}`] : []),
    ...(plan ? [`准备方向：${ROUTE_NAMES[plan]}`] : []),
    `实际结果：${success ? ROUTE_NAMES[endingId] : ending.outcome === 'survived' ? '十日期满，存活离山' : '败退'}`,
    ...threads.filter(item => ['rain-route', 'medicine', 'pouch-account', 'ledger-account'].includes(item.id)).map(item => `${item.title}：${item.text}`),
  ];
  return {
    heading, introduction: `${game.name}的青茅山行程停在第 ${game.day} 日。${ending.reason}`,
    threads, people: peopleNotes(game),
    carryover: {
      rank: game.rank, cultivation: game.cultivation, stones: game.resources.stones,
      gu: GU.filter(gu => (game.inventory[gu.id] ?? 0) > 0).map(gu => ({ id: gu.id, name: gu.name, count: game.inventory[gu.id]! })),
      choices,
    },
    future: '本章已经结束，第二章尚未开放。导出存档可以保留当前蛊囊、修为、资源、关系与选择记录，供以后查看；目前不能直接进入第二章。',
  };
}
