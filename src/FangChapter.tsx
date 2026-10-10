import { useId } from 'react';
import { getCampaignEvents, getCampaignGu, getCampaignLabel, getCampaignLocations, getCampaignNpcs, getLocationError, isFangYuan } from './game/campaign';
import { FANG_STEPS } from './game/fang-content';
import { getActionError, getAvailableEvents, getEventActionCost, getUpkeep } from './game/engine';
import { SEASON_NAMES, WOLF_TIDE_DAY, daysUntilWolfTide, getSeason, nextWorldEvent } from './game/world-clock';
import type { GameAction, GameState } from './game/types';
import { getRealmLabel, Icon, SectionHeading } from './ui';

export const FANG_ACT_TITLES = ['重生开窍', '藏锋立足', '寻虫探藏', '炼蛊报验'] as const;
const ACT_NOTES = [
  '五百年经历回到少年身上。开窍大典只在第 2–5 日举行，错过便此生无路。',
  '月光蛊尚未炼化。家宅、客栈、学堂的窗口各有期限，先立住脚再谈修行。',
  '循着前世记忆准备青竹酒，引出酒虫，沿溪追入石缝。记得路径，仍要亲自走到。',
  '报验是里程碑，不是终点。头名到手后，狼潮仍在前面。',
];

function fangProgress(game: GameState) {
  const completed = FANG_STEPS.filter(step => game.flags.includes(step.flag));
  const missed = FANG_STEPS.filter(step => game.flags.includes(`missed-${step.eventId}`));
  // The first open, un-missed opportunity whose causal prerequisites are met.
  const next = FANG_STEPS.find(step => {
    if (game.flags.includes(step.flag) || game.flags.includes(`missed-${step.eventId}`)) return false;
    const after: readonly string[] = 'after' in step ? step.after : [];
    return after.every(flag => game.flags.includes(flag));
  });
  return { completed, missed, next, act: next?.act ?? 4 };
}

function FangNextEvent({ game, onAction }: { game: GameState; onAction: (action: GameAction) => void }) {
  const detailId = useId();
  const { next } = fangProgress(game);
  const event = getCampaignEvents(game).find(item => item.id === next?.eventId);
  if (!event) return <p className="fang-next-note">主线机遇都已处理或错过。接下来靠日常筹备、温养空窍，把本钱攒到狼潮之前。</p>;

  if (game.combat || game.activeEvent) return <p className="fang-next-note"><Icon name="book" size={16} /><span>先完成当前{game.combat ? '战斗' : '事件'}，这段经历才会记入进度。</span></p>;

  const place = getCampaignLocations(game).find(item => item.id === event.location);
  const atLocation = game.location === event.location;
  const there = atLocation ? game : { ...game, location: event.location };
  const locationError = getLocationError(game, event.location);
  const available = !locationError && getAvailableEvents(there).some(item => item.id === event.id);
  const action: GameAction = atLocation ? { type: 'EXPLORE', eventId: event.id } : { type: 'TRAVEL', location: event.location };
  const error = getActionError(game, action);
  const actionCost = getEventActionCost(event);

  const deadline = 'closes' in next! ? next!.closes : undefined;
  return <div className="fang-next-event">
    <div><span className="fang-small-label">眼前这一件事 · {place?.name ?? '当前地点'}{deadline !== undefined && <> · 第 {deadline} 日前</>}</span><h3>{event.title}</h3></div>
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
  const { missed, next } = fangProgress(game);
  const upkeep = getUpkeep(game);
  const refinedCount = getCampaignGu(game).filter(gu => (game.inventory[gu.id] ?? 0) > 0).length;
  const left = daysUntilWolfTide(game.day);
  const nextEvent = nextWorldEvent(game.day);
  return <aside className="panel quest-panel fang-quest" aria-label="方源篇当前处境">
    <SectionHeading eyebrow="青茅生存" title="眼前的准备"><span className="quest-day">{SEASON_NAMES[getSeason(game.day)]}<small> · 第 {game.day} 日</small></span></SectionHeading>
    <div className={`quest-hint${left <= 10 ? ' is-urgent' : ''}`}><Icon name={left <= 10 ? 'flag' : 'compass'} size={17} /><p>{left <= 10 ? `狼潮将在第 ${WOLF_TIDE_DAY} 日到来，只剩 ${left} 日。` : nextEvent ? `下一件大事：${nextEvent.name}（第 ${nextEvent.opens} 日）。` : `距狼潮 ${left} 日。`}{next ? ` 接下来：${next.title}。` : ''}</p></div>
    <dl className="fang-preparation-list"><div><dt>空窍</dt><dd>{getRealmLabel(game)}</dd></div><div><dt>已炼化并持有</dt><dd>{refinedCount} 种蛊</dd></div><div><dt>今夜供养</dt><dd>{upkeep} 元石</dd></div><div><dt>手中元石</dt><dd>{game.resources.stones}</dd></div><div><dt>引来的疑心</dt><dd>{game.suspicion}</dd></div><div><dt>距狼潮</dt><dd>{left} 日</dd></div></dl>
    {missed.length > 0 && <p className="fang-sidebar-note">已错失：{missed.map(step => step.title).join('、')}。这些窗口不会重开。</p>}
    <p className="fang-sidebar-note">{game.rank === 0 ? '开窍大典只在第 2–5 日举行；错过就没有空窍。' : game.hungry.length ? '已有蛊休眠，补足供养后才能继续借力。' : game.resources.stones < upkeep ? '今夜供养还未备齐，可按行路建议筹措元石。' : '每个行动日有三次行动。狼潮到来前，把境界、蛊虫与元石都攒起来。'}</p>
  </aside>;
}

export function FangEndingReview({ game }: { game: GameState }) {
  if (!isFangYuan(game) || !game.ending) return null;
  const { completed, missed } = fangProgress(game);
  const stood = game.ending.id === 'fy-wolf-tide-stood';
  const gu = getCampaignGu(game).filter(item => (game.inventory[item.id] ?? 0) > 0);
  const people = getCampaignNpcs(game).filter(person => person.name !== game.name && person.name !== '方源');
  return <section className="chapter-ending fang-ending" aria-label="方源篇本局回顾">
    <div className="chapter-ending-intro"><span className="chapter-ending-kicker">这一世留下的记录</span><h2 className="chapter-ending-heading">{stood ? '狼潮之中，站住了' : game.ending.outcome === 'survived' ? '活过第一夜' : '没有走到狼潮之后'}</h2><p>你活到了第 {game.day} 日，完成了 {completed.length} 段主线机遇{missed.length ? `，错过了 ${missed.length} 段` : ''}。以下是此刻手中实际留下的本钱。</p></div>
    <details className="fang-details" open><summary><span><Icon name="bag" size={16} />此刻的本钱</span><span>查看<Icon name="arrow" size={15} /></span></summary><div className="fang-details-body"><dl className="fang-ending-stats"><div><dt>境界</dt><dd>{getRealmLabel(game)}</dd></div><div><dt>当前修为</dt><dd>{game.cultivation}</dd></div><div><dt>元石余额</dt><dd>{game.resources.stones}</dd></div><div><dt>药草</dt><dd>{game.resources.herbs}</dd></div><div><dt>酒</dt><dd>{game.resources.wine}</dd></div><div><dt>疑心</dt><dd>{game.suspicion}</dd></div></dl><p className="fang-status-note">{game.rank > 0 ? '丙等、四成四（44%）是开窍时测得的资质；当前修为与真元另行记录。' : '尚未开窍，没有可用真元。'}</p><h3 className="fang-review-subheading">蛊囊中实际持有</h3>{gu.length ? <ul className="chapter-gu-list">{gu.map(item => <li key={item.id}>{item.name}<span>× {game.inventory[item.id]}</span></li>)}</ul> : <p className="fang-next-note">当前没有已炼化并入囊的蛊。</p>}<FangGuStatus game={game} compact /></div></details>
    {missed.length > 0 && <details className="fang-details"><summary><span><Icon name="flag" size={16} />错失的窗口</span><span>{missed.length} 段<Icon name="arrow" size={15} /></span></summary><div className="fang-details-body"><ol className="fang-completed-list">{missed.map(step => <li key={step.eventId}><Icon name="flag" size={15} /><span>{step.title}{'closes' in step && <small> · 第 {step.closes} 日前</small>}</span></li>)}</ol><p className="fang-status-note">错过的机遇不会重开；它们本可成为狼潮前的本钱。</p></div></details>}
    <details className="fang-details"><summary><span><Icon name="people" size={16} />人物与风险记录</span><span>查看<Icon name="arrow" size={15} /></span></summary><div className="fang-details-body"><p className="fang-memory">宗族信任 {game.trust} · 疑心 {game.suspicion}。这些是此刻记录的结果，关系没有变化的人不会被写成已经取得支持。</p><ul className="fang-relationship-review">{people.map(person => { const value = game.relations[person.id] ?? 0; return <li key={person.id}><strong>{person.name}</strong><span>关系记录 {value > 0 ? '+' : ''}{value}</span></li>; })}</ul></div></details>
    <details className="fang-details"><summary><span><Icon name="book" size={16} />已经完成的主线机遇</span><span>{completed.length} / {FANG_STEPS.length}<Icon name="arrow" size={15} /></span></summary><div className="fang-details-body"><ol className="fang-completed-list">{completed.map(step => <li key={step.eventId}><Icon name="check" size={15} /><span>{step.title}</span></li>)}</ol></div></details>
    <div className="chapter-future"><Icon name="mountain" size={21} /><div><strong>狼潮之后的路尚未开放</strong><p>目前可玩至狼潮结算。商队、石林传承、三寨联盟、白凝冰与血湖，都在后续阶段。</p><small>保存此行手札，可保留当前资源、关系、主线进度与完整行记。</small></div></div>
  </section>;
}
