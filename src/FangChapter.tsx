import { useId } from 'react';
import { getCampaignEvents, getCampaignGu, getCampaignLabel, getCampaignLocations, getCampaignNpcs, getLocationError, isFangYuan } from './game/campaign';
import { FANG_STEPS } from './game/fang-content';
import { getActionError, getAvailableEvents, getEventActionCost, getUpkeep } from './game/engine';
import type { GameAction, GameState } from './game/types';
import { getRealmLabel, Icon, SectionHeading } from './ui';

export const FANG_ACT_TITLES = ['重生开窍', '藏锋立足', '寻虫探藏', '炼蛊报验'] as const;
const ACT_NOTES = [
  '五百年经历回到少年身上。先理清处境，再经历开窍大典，确认今生的空窍与资质。',
  '月光蛊尚未炼化。处理家宅中的交涉，尝试炼蛊，再安排客栈中的落脚处。',
  '循着前世记忆准备青竹酒，引出酒虫，沿溪追入石缝。记得路径，仍要亲自走到。',
  '看过花酒行者留下的影像后，回客栈炼蛊，查明空窍中的异变，再以月光蛊完成学堂报验。',
];

function fangProgress(game: GameState) {
  const completed = FANG_STEPS.filter(step => game.flags.includes(step.flag));
  const next = FANG_STEPS.find(step => !game.flags.includes(step.flag));
  return { completed, next, act: next?.act ?? 4 };
}

function FangNextEvent({ game, onAction }: { game: GameState; onAction: (action: GameAction) => void }) {
  const detailId = useId();
  const { next } = fangProgress(game);
  const event = getCampaignEvents(game).find(item => item.id === next?.eventId);
  if (!event) return <p className="fang-next-note">本段经历已经记入手札，可在结算中回看此行。</p>;

  if (game.combat || game.activeEvent) return <p className="fang-next-note"><Icon name="book" size={16} /><span>先完成当前{game.combat ? '战斗' : '事件'}，这段经历才会记入进度。</span></p>;

  const place = getCampaignLocations(game).find(item => item.id === event.location);
  const atLocation = game.location === event.location;
  const there = atLocation ? game : { ...game, location: event.location };
  const locationError = getLocationError(game, event.location);
  const available = !locationError && getAvailableEvents(there).some(item => item.id === event.id);
  const action: GameAction = atLocation ? { type: 'EXPLORE', eventId: event.id } : { type: 'TRAVEL', location: event.location };
  const error = getActionError(game, action);
  const actionCost = getEventActionCost(event);

  return <div className="fang-next-event">
    <div><span className="fang-small-label">眼前这一件事 · {place?.name ?? '当前地点'}</span><h3>{event.title}</h3></div>
    {available ? <div className="fang-next-cta"><button className="button button-primary" type="button" disabled={Boolean(error)} aria-describedby={detailId} data-fang-next={event.id} onClick={() => { if (!getActionError(game, action)) onAction(action); }}>{atLocation ? '继续主线' : `前往${place?.name ?? '下一处地点'}`}<Icon name="arrow" size={17} /></button><small id={detailId}>{error ?? (atLocation ? actionCost === 0 ? '这段剧情不消耗行动' : `消耗 ${actionCost} 次行动，查看选项后作出选择` : `移动不消耗行动 · 到达后剧情${actionCost === 0 ? '不耗行动' : `消耗 ${actionCost} 次行动`}`)}</small></div>
      : <p className="fang-next-note">{locationError ?? '这段剧情的准备尚未齐备。留意下方建议，补足条件后再继续。'}</p>}
  </div>;
}

export function FangGuStatus({ game, compact = false }: { game: GameState; compact?: boolean }) {
  if (!isFangYuan(game)) return null;
  const has = (flag: string) => game.flags.includes(flag);
  const refined = has('fy-cicada-revealed');
  const rows = [
    { id: 'moonlight', name: '月光蛊', obtained: has('fy-moonlight-claimed'), waiting: '已领取，尚未炼化', unknown: '开窍后到学堂领取' },
    { id: 'liquor-worm', name: '酒虫', obtained: has('fy-cave-found'), waiting: '已寻获，尚未炼化', unknown: '循着记忆寻找它的踪迹' },
  ];

  return <div className={`fang-gu-status${compact ? ' fang-gu-status-compact' : ''}`} aria-label="本章蛊虫状态">
    <ul>{rows.map(row => {
      const count = game.inventory[row.id] ?? 0;
      const usable = count > 0;
      const status = usable ? game.hungry.includes(row.id) ? '已炼化 · 休眠中' : game.equipped.includes(row.id) ? '已炼化 · 已携带' : '已炼化 · 已入蛊囊' : row.obtained && !refined ? row.waiting : refined ? '当前蛊囊中未持有' : row.unknown;
      return <li key={row.id} className={usable ? 'fang-gu-refined' : row.obtained ? 'fang-gu-unrefined' : ''}><span className="fang-gu-state-mark"><Icon name={usable ? 'check' : row.obtained ? 'moon' : 'eye'} size={17} /></span><div><strong>{row.name}{usable && <small> × {count}</small>}</strong><p>{status}</p></div></li>;
    })}</ul>
    {!refined && rows.some(row => row.obtained) && <p className="fang-status-note">拿到蛊还不等于炼化。未炼化的蛊会记在剧情进度中，暂不能装备。</p>}
    {refined && <div className="fang-cicada-note"><Icon name="spark" size={17} /><div><strong>春秋蝉 · 六转本命，重伤沉眠</strong><p>{compact ? '已借其气息炼蛊；不能发动重生，也不列入随身战斗蛊。' : '你已借其气息压服低转蛊的意志。春秋蝉仍重伤沉眠，不能发动重生，也不作为战斗蛊装备。'}</p></div></div>}
  </div>;
}

export default function FangChapter({ game, onAction }: { game: GameState; onAction: (action: GameAction) => void }) {
  const headingId = useId();
  if (!isFangYuan(game) || game.ending) return null;
  const { completed, next, act } = fangProgress(game);

  return <section className="chapter-panel fang-chapter" aria-labelledby={headingId} data-fang-act={act}>
    <div className="chapter-kicker"><span><Icon name="book" size={17} />{getCampaignLabel(game)}</span><small>已完成 {completed.length} / {FANG_STEPS.length} 段经历</small></div>
    <ol className="fang-act-list" aria-label="方源篇四段主线">{FANG_ACT_TITLES.map((title, index) => {
      const stepAct = index + 1;
      const done = FANG_STEPS.filter(step => step.act === stepAct).every(step => game.flags.includes(step.flag));
      const current = next?.act === stepAct;
      return <li key={title} className={`${done ? 'fang-act-done' : ''}${current ? ' fang-act-current' : ''}`} aria-current={current ? 'step' : undefined}><span className="fang-act-number">{done ? <Icon name="check" size={16} /> : String(stepAct).padStart(2, '0')}</span><span>{title}<small>{done ? '已经历' : current ? '正在经历' : '尚未开始'}</small></span></li>;
    })}</ol>
    <div className="fang-act-copy"><h2 id={headingId}>{FANG_ACT_TITLES[act - 1]}</h2><p>{ACT_NOTES[act - 1]}</p></div>
    <FangNextEvent game={game} onAction={onAction} />
    <details className="fang-details"><summary><span><Icon name="eye" size={16} />方源所知与手中之蛊</span><span>展开<Icon name="arrow" size={15} /></span></summary><div className="fang-details-body"><p className="fang-memory">{game.flags.includes('fy-reborn') ? '你是古月方源。前世的五百年经历仍在记忆中，但今生的资源、蛊虫和旁人的态度，都要从眼前一步步取得。' : '少年时的房间重新出现在眼前。先完成重生事件，理清此刻的处境。'}</p><FangGuStatus game={game} /></div></details>
    <details className="fang-details"><summary><span><Icon name="book" size={16} />已记下的经历</span><span>{completed.length} 段<Icon name="arrow" size={15} /></span></summary><div className="fang-details-body">{completed.length ? <ol className="fang-completed-list">{completed.map(step => <li key={step.eventId}><Icon name="check" size={15} /><span>{step.title}</span></li>)}</ol> : <p className="fang-next-note">第一段经历尚未落笔。</p>}</div></details>
  </section>;
}

export function FangQuestPanel({ game }: { game: GameState }) {
  const { completed, next } = fangProgress(game);
  const upkeep = getUpkeep(game);
  const refinedCount = getCampaignGu(game).filter(gu => (game.inventory[gu.id] ?? 0) > 0).length;
  return <aside className="panel quest-panel fang-quest" aria-label="方源篇当前目标">
    <SectionHeading eyebrow="重生初炼" title="眼前的准备"><span className="quest-day">{completed.length}<small> / {FANG_STEPS.length} 段</small></span></SectionHeading>
    <div className="quest-hint"><Icon name="compass" size={17} /><p>{game.activeEvent ? '先作出当前事件的选择，经历才会推进。' : next ? `接下来：${next.title}。地图上的主线提示会指出实际可去的地点。` : '首次炼蛊与报验已经完成，回顾本段所得。'}</p></div>
    <dl className="fang-preparation-list"><div><dt>空窍</dt><dd>{getRealmLabel(game)}</dd></div><div><dt>已炼化并持有</dt><dd>{refinedCount} 种蛊</dd></div><div><dt>今夜供养</dt><dd>{upkeep} 元石</dd></div><div><dt>手中元石</dt><dd>{game.resources.stones}</dd></div><div><dt>引来的疑心</dt><dd>{game.suspicion}</dd></div></dl>
    <p className="fang-sidebar-note">{game.rank === 0 ? '开窍之前，先处理剧情；空窍与修炼会在大典后开启。' : game.hungry.length ? '已有蛊休眠，补足供养后才能继续借力。' : game.resources.stones < upkeep ? '今夜供养还未备齐，可按行路建议筹措元石。' : '每个行动日有三次行动。夜晚结清供养，次日可继续推进。'}</p>
    <p className="fang-sidebar-note">本段止于首次炼蛊报验；深层花酒传承尚未开放。</p>
  </aside>;
}

export function FangEndingReview({ game }: { game: GameState }) {
  if (!isFangYuan(game) || !game.ending) return null;
  const completed = FANG_STEPS.filter(step => game.flags.includes(step.flag));
  const success = game.ending.outcome === 'success' && game.ending.id === 'fy-first-gu';
  const gu = getCampaignGu(game).filter(item => (game.inventory[item.id] ?? 0) > 0);
  const people = getCampaignNpcs(game).filter(person => person.name !== game.name && person.name !== '方源');
  return <section className="chapter-ending fang-ending" aria-label="方源篇本段回顾">
    <div className="chapter-ending-intro"><span className="chapter-ending-kicker">今生留下的记录</span><h2 className="chapter-ending-heading">{success ? '月光示人，秘密留于空窍' : '尚未走完的初炼之路'}</h2><p>{success ? '你以月光蛊完成学堂报验，并在报验时领取二十块元石。酒虫与春秋蝉仍未向学堂公开，以下列出当前手札中实际留下的资源与关系。' : `这次行程完成了 ${completed.length} 段经历。尚未完成的主线不会计作报验成功；此刻的得失仍可从手札中回看。`}</p></div>
    <details className="fang-details"><summary><span><Icon name="bag" size={16} />此刻的所得</span><span>查看<Icon name="arrow" size={15} /></span></summary><div className="fang-details-body"><dl className="fang-ending-stats"><div><dt>境界</dt><dd>{getRealmLabel(game)}</dd></div><div><dt>当前修为</dt><dd>{game.cultivation}</dd></div><div><dt>元石余额</dt><dd>{game.resources.stones}</dd></div><div><dt>药草</dt><dd>{game.resources.herbs}</dd></div><div><dt>酒</dt><dd>{game.resources.wine}</dd></div><div><dt>疑心</dt><dd>{game.suspicion}</dd></div></dl><p className="fang-status-note">{game.rank > 0 ? '丙等、四成四（44%）是开窍时测得的资质；当前修为与真元另行记录。' : '尚未开窍，没有可用真元。'}</p><h3 className="fang-review-subheading">蛊囊中实际持有</h3>{gu.length ? <ul className="chapter-gu-list">{gu.map(item => <li key={item.id}>{item.name}<span>× {game.inventory[item.id]}</span></li>)}</ul> : <p className="fang-next-note">当前没有已炼化并入囊的蛊。</p>}<FangGuStatus game={game} compact /></div></details>
    <details className="fang-details"><summary><span><Icon name="people" size={16} />人物与风险记录</span><span>查看<Icon name="arrow" size={15} /></span></summary><div className="fang-details-body"><p className="fang-memory">宗族信任 {game.trust} · 疑心 {game.suspicion}。这些是此刻记录的结果，关系没有变化的人不会被写成已经取得支持。</p><ul className="fang-relationship-review">{people.map(person => { const value = game.relations[person.id] ?? 0; return <li key={person.id}><strong>{person.name}</strong><span>关系记录 {value > 0 ? '+' : ''}{value}</span></li>; })}</ul></div></details>
    <details className="fang-details"><summary><span><Icon name="book" size={16} />已经完成的主线</span><span>{completed.length} / {FANG_STEPS.length}<Icon name="arrow" size={15} /></span></summary><div className="fang-details-body"><ol className="fang-completed-list">{completed.map(step => <li key={step.eventId}><Icon name="check" size={15} /><span>{step.title}</span></li>)}</ol></div></details>
    <div className="chapter-future"><Icon name="mountain" size={21} /><div><strong>深层传承与下一章尚未开放</strong><p>目前可经历重生、开窍、寻得酒虫与首次炼蛊报验。花酒行者更深处的安排，还没有进入可玩的章节。</p><small>保存此行手札，可保留当前资源、关系、主线进度与完整行记。</small></div></div>
  </section>;
}
