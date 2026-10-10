import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ENDINGS, EVENTS, GU, LOCATIONS, ORIGINS } from './game/content';
import { createGame, gameReducer, getActionError, getAvailableEvents, getChoiceError, getEffectiveStats, getUpkeep } from './game/engine';
import { EMPTY_META, createSave, loadSave, parseSave, serializeSave, updateMeta, writeSave } from './game/storage';
import type { GameAction, GameState, MetaProgress, OriginId, SaveData } from './game/types';
import { getJourneyAdvice, getMapEventCounts } from './game/guidance';
import type { JourneyFocus } from './game/guidance';
import { ForgePanel, GuPanel, JournalPanel, QuestPanel, ShopPanel } from './GamePanels';
import ActionButton from './GameActionButton';
import CombatPanel from './CombatPanel';
import JourneyGuide from './JourneyGuide';
import ActionFeedback, { feedbackFor } from './ActionFeedback';
import type { ActionFeedbackData } from './ActionFeedback';
import WorldMap, { Landscape } from './WorldMap';
import { EffectList, Icon, Meter, Modal } from './ui';
import type { IconName } from './ui';

type Pane = 'map' | 'gu' | 'forge' | 'market' | 'journal';
type SaveStatus = 'saved' | 'saving' | 'error';
const NAV: { id: Pane; label: string; icon: IconName }[] = [
  { id: 'map', label: '山中行走', icon: 'compass' },
  { id: 'gu', label: '蛊虫行囊', icon: 'bag' },
  { id: 'forge', label: '合炼蛊虫', icon: 'flame' },
  { id: 'market', label: '商队货摊', icon: 'store' },
  { id: 'journal', label: '行旅手记', icon: 'book' },
];

function mergeMeta(current: MetaProgress, restored: MetaProgress): MetaProgress {
  const recordedRunIds = [...new Set([...(current.recordedRunIds ?? []), ...(restored.recordedRunIds ?? []), ...[current.lastRecordedRun, restored.lastRecordedRun].filter((id): id is string => !!id)])];
  return {
    completedRuns: Math.max(current.completedRuns, restored.completedRuns, recordedRunIds.length),
    endings: [...new Set([...current.endings, ...restored.endings])],
    discoveredGu: [...new Set([...current.discoveredGu, ...restored.discoveredGu])],
    lastRecordedRun: restored.lastRecordedRun,
    recordedRunIds,
  };
}

function saveDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function TitleScreen({ resume, meta, loading, onContinue, onStart, onHelp, onSave }: { resume: SaveData | null; meta: MetaProgress; loading: boolean; onContinue: () => void; onStart: (name: string, origin: OriginId) => void; onHelp: () => void; onSave: () => void }) {
  const [name, setName] = useState('古月行舟');
  const [origin, setOrigin] = useState<OriginId>('disciple');
  const submit = (event: FormEvent) => { event.preventDefault(); onStart(name.trim() || '无名行者', origin); };
  return <main className="title-screen">
    <div className="title-art"><Landscape title /><div className="title-vignette" /><span className="vertical-poem">山雨欲来，愿你自有去路。</span><div className="title-identity"><span className="seal">蛊</span><p>南疆 · 原创支线</p><h1>青茅山</h1><h2>传承争夺</h2><div className="title-rule" /><p className="title-pitch">十日山中路，一盏无主灯。<br />炼蛊、养蛊，辨人心，择去留。</p><div className="title-facts"><span>图文策略</span><i /><span>三条去路</span><i /><span>本地存档</span></div></div><div className="title-art-footer"><span>QINGMAO CHRONICLES</span><span>卷一 · 石灯遗藏</span></div></div>
    <div className="title-content">
      <header className="title-tools"><span className="edition">青茅手札 · 第一章</span><div><button className="icon-button" aria-label="查看游戏指南" onClick={onHelp}><Icon name="help" /></button><button className="icon-button" aria-label="管理存档" onClick={onSave} disabled={loading} title={loading ? '正在读取已有存档' : '管理存档'}><Icon name="book" /></button></div></header>
      <div className="title-form-wrap"><span className="eyebrow">山门已开</span><h2>这次，你想怎样走？</h2><p className="muted intro-description">商队将在第十日后离寨。你可以独取遗藏、在宗族立足，也可以带着所得走向山外。</p>
        {loading && <div className="loading-note" role="status">正在翻开上次的手札…</div>}
        {resume && !loading && <button className="resume-card" onClick={onContinue}><span className="resume-icon"><Icon name="book" size={22} /></span><span><strong>{resume.game.ending ? '回顾上次旅途' : '继续山中行程'}</strong><small>{resume.game.name} · 第 {resume.game.day} 日 · {saveDate(resume.savedAt)}</small></span><Icon name="arrow" /></button>}
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="traveler-name">留下你的名字</label><input id="traveler-name" className="name-input" value={name} onChange={event => setName(event.target.value)} maxLength={18} autoComplete="off" placeholder="无名行者" />
          <div className="field-label origin-label">选择出身 <span>改变起步，去路由你</span></div>
          <div className="origin-options" role="group" aria-label="选择出身">{ORIGINS.map(item => <button type="button" key={item.id} className={`origin-option${origin === item.id ? ' selected' : ''}`} aria-pressed={origin === item.id} onClick={() => setOrigin(item.id)}><span className="origin-mark">{item.name.charAt(0)}</span><span className="origin-text"><strong>{item.name}<small>{item.subtitle.split(' · ')[0]}</small></strong><span>{item.gu.map(id => GU.find(gu => gu.id === id)?.name).join(' / ')} · {item.resources.stones} 元石</span></span><span className="radio-dot">{origin === item.id && <Icon name="check" size={12} />}</span></button>)}</div>
          <p className="origin-description">{ORIGINS.find(item => item.id === origin)?.description}</p>
          <button className="button button-primary start-button" type="submit" disabled={loading}>踏入青茅山<Icon name="arrow" size={20} /></button>
        </form>
        <div className="ending-gallery" aria-label="结局见闻">{ENDINGS.map(ending => <div key={ending.id} className={meta.endings.includes(ending.id) ? 'unlocked' : ''}><Icon name={ending.id === 'inheritance' ? 'flame' : ending.id === 'clan' ? 'flag' : 'mountain'} size={17} /><span>{ending.title}</span><small>{meta.endings.includes(ending.id) ? '已抵达' : '未抵达'}</small></div>)}</div>
      </div><footer className="title-footer"><span>灵感来自《蛊真人》· 原创假设支线</span><span>v0.2</span></footer>
    </div>
  </main>;
}

function PlayerPanel({ game, onAction, onBag }: { game: GameState; onAction: (action: GameAction) => void; onBag: () => void }) {
  const stats = getEffectiveStats(game);
  return <aside className="player-panel panel"><div className="player-portrait"><span className="portrait-orbit orbit-one" /><span className="portrait-orbit orbit-two" /><span className="portrait-mountain" /><span className="portrait-glyph">{game.name.replace('古月', '').slice(0, 1) || '行'}</span><span className="rank-seal">{game.rank === 1 ? '一转' : '二转'}</span></div><div className="player-identity"><h2>{game.name}</h2><p>{ORIGINS.find(item => item.id === game.origin)?.name} · {game.rank === 1 ? '青铜元海' : '赤铁元海'}</p></div>
    <div className="player-meters"><Meter label="生命" value={game.hp} max={game.maxHp} kind="life" icon="heart" /><Meter label="真元" value={game.qi} max={game.maxQi} icon="spark" /><Meter label="修为" value={game.cultivation} max={game.rank === 1 ? 12 : Math.max(12, game.cultivation)} kind="gold" /></div>
    {game.rank === 1 && <div className="breakthrough-action"><ActionButton game={game} action={{ type: 'BREAKTHROUGH' }} onAction={onAction} icon="spark" detail="12 修为 · 12 元石 · 1 行动">突破二转</ActionButton></div>}
    <div className="player-divider" /><div className="carried-heading"><span>随身蛊虫 <b>{game.equipped.length}/4</b></span><button className="text-button" onClick={onBag} disabled={!!game.combat || !!game.activeEvent}>调整<Icon name="arrow" size={13} /></button></div><div className="carried-gu">{game.equipped.map(id => { const gu = GU.find(item => item.id === id)!; return <button className={`carried-chip${game.hungry.includes(id) ? ' asleep' : ''}`} key={id} onClick={onBag} disabled={!!game.combat || !!game.activeEvent} aria-label={`查看${gu.name}`}><span>{gu.glyph}</span><span>{gu.name}<small>{game.hungry.includes(id) ? '休眠' : gu.passive ? '自动生效' : `${gu.qiCost} 真元`}</small></span></button>; })}{game.equipped.length === 0 && <p className="muted">尚未携带蛊虫。可在行囊中装备。</p>}</div>
    <div className="upkeep-note"><Icon name="leaf" size={15} /><span>今日供养 <strong>{getUpkeep(game)} 元石</strong></span></div>
    {game.hungry.length > 0 && <ActionButton game={game} action={{ type: 'FEED' }} onAction={onAction} icon="leaf">补喂休眠蛊</ActionButton>}
    <div className="player-divider" /><div className="combat-stats"><span><Icon name="sword" size={14} />普攻 <b>{stats.attack}</b></span><span><Icon name="shield" size={14} />防御 <b>{stats.guard}</b></span></div><div className="social-stats"><span>宗族信任<b>{game.trust}</b></span><span>疑心<b>{game.suspicion}</b></span></div>
  </aside>;
}

function LocationPanel({ game, focus, onAction, onShop }: { game: GameState; focus: JourneyFocus; onAction: (action: GameAction) => void; onShop: () => void }) {
  const place = LOCATIONS.find(item => item.id === game.location)!;
  const events = getAvailableEvents(game);
  const advice = getJourneyAdvice(game, focus);
  const lastStory = [...game.journal].reverse().find(entry => entry.kind === 'story' || entry.kind === 'good' || entry.kind === 'bad');
  return <>
    <WorldMap location={game.location} eventCounts={getMapEventCounts(game)} recommended={advice?.location} onTravel={location => onAction({ type: 'TRAVEL', location })} locked={Boolean(game.combat || game.activeEvent)} />
    <section className="location-panel panel">
      <div className="location-heading"><div><span className="eyebrow">{place.subtitle}</span><h2>{place.name}</h2></div><span className={`region-tag ${place.danger}`}><i />{place.danger === 'safe' ? '山寨之内' : place.danger === 'wild' ? '山野之间' : '遗藏深处'}</span></div>
      <p className="location-description">{place.description}</p>
      {events[0] && <div className="exploration-preview"><Icon name="book" size={19} /><div><small>眼前的动静 · {events[0].tag}</small><strong>{events[0].title}</strong></div></div>}
      <div className="location-actions">
        <ActionButton game={game} action={{ type: 'EXPLORE' }} onAction={onAction} primary icon="compass" detail={events.length ? '1 行动 · 查看选项后再作选择' : undefined}>在此探查{events.length > 0 && <span className="new-event-dot" />}</ActionButton>
        <ActionButton game={game} action={{ type: 'ACTIVITY' }} onAction={onAction} icon={game.location === 'bamboo' ? 'leaf' : game.location === 'stream' || game.location === 'cave' ? 'ore' : 'book'} detail={place.activity.description}>{place.activity.label}</ActionButton>
        {game.location === 'market' && <div className="action-wrap"><button className="button" onClick={onShop}><Icon name="store" />逛逛货摊</button><small className="action-detail">购买不消耗行动</small></div>}
      </div>
      {events.length > 1 && <details className="other-events"><summary>周围还有 {events.length - 1} 处动静</summary><div>{events.slice(1).map(event => <button className="other-event-button" key={event.id} onClick={() => onAction({ type: 'EXPLORE', eventId: event.id })} disabled={Boolean(getActionError(game, { type: 'EXPLORE', eventId: event.id }))}><span>{event.tag}</span><strong>{event.title}</strong><small>1 行动</small><Icon name="arrow" size={14} /></button>)}</div></details>}
      <div className="camp-actions"><span>整顿自身</span><ActionButton game={game} action={{ type: 'TRAIN' }} onAction={onAction} icon="spark" detail="1 行动 · 3 真元 → 3 修为">温养空窍</ActionButton><ActionButton game={game} action={{ type: 'REST' }} onAction={onAction} icon="moon" detail="1 行动 · 恢复 8 生命、6 真元">原地调息</ActionButton></div>
    </section>
    {lastStory && <section className={`last-story story-${lastStory.kind}`} aria-live="polite"><Icon name="book" size={17} /><div><span>手记 · 第 {lastStory.day} 日</span><p>{lastStory.text}</p></div></section>}
  </>;
}

function EventModal({ game, onAction }: { game: GameState; onAction: (action: GameAction) => void }) {
  const event = EVENTS.find(item => item.id === game.activeEvent)!;
  return <Modal title={event.title} label={`第 ${game.day} 日 · ${event.tag} · ${LOCATIONS.find(place => place.id === event.location)?.name}`} wide><div className="event-prose">{event.description.split('\n').filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div><div className="event-resource-strip"><span><Icon name="heart" size={14} />{game.hp} 生命</span><span><Icon name="gem" size={14} />{game.resources.stones} 元石</span><span><Icon name="spark" size={14} />{game.qi} 真元</span><span><Icon name="eye" size={14} />{game.clues} 情报</span></div><div className="event-choices">{event.choices.map((choice, index) => { const error = getChoiceError(game, choice); return <button key={choice.id} className="event-choice" disabled={!!error} onClick={() => onAction({ type: 'CHOOSE', choiceId: choice.id })}><span className="choice-number">{String(index + 1).padStart(2, '0')}</span><span className="choice-body"><strong>{choice.label}{choice.encounterId && <span className="choice-tag">进入战斗</span>}{choice.ending && <span className="choice-tag ending-tag">结束旅途</span>}</strong><span className="choice-description">{choice.description}</span><EffectList effects={choice.effects} compact />{error && <span className="choice-requirement">{error}</span>}</span><Icon name="arrow" size={17} /></button>; })}</div><p className="modal-footnote">选择将写入手记。后续的人与事，会记得你付出过什么。</p></Modal>;
}

function Guide({ onClose }: { onClose: () => void }) {
  return <Modal title="一份山中行走的指南" label="初入青茅" onClose={onClose} wide><div className="guide-grid"><div><span className="guide-number">壹</span><h3>先探查，再决定去路</h3><p>地图数字表示当前可探的事件。可以按行路建议选择关注的路线，也可以自己点选地点探查。青竹林、听雨涧和市集都可能藏着线索。</p></div><div><span className="guide-number">贰</span><h3>每天只有三次行动</h3><p>探查、劳作、修炼、调息、合炼各用一次。移动、购物和调整蛊虫不耗行动。准备好后，点击「结束当日」。第十日之后行程结束。</p></div><div><span className="guide-number">叁</span><h3>蛊要养，真元要留</h3><p>每日为当天携带过的蛊支付元石，卸下也要结清。钱不够时蛊会休眠，补喂后才能恢复。封存且整日未携带的蛊不计供养，离线不消耗资源。</p></div><div><span className="guide-number">肆</span><h3>看清下一招</h3><p>敌人执行已显示的下一招，预判会比较当前护势与普通防御的结果。2 药草可恢复最多 8 生命，1 清酒可恢复最多 5 真元；补给也占一次出手。</p></div></div><div className="guide-note"><h3>三种去路，都有代价</h3><p>三条路线的进度会显示在「此行所求」。独掌传承要亲自战胜守关者；宗族立足要积累信任并分享线索；随商队离山要留够盘缠。</p><h3>准备也能改变胜负</h3><p>修为达到 12 后，可花 12 元石和一次行动突破二转。护身蛊、治疗蛊、合炼与支线回报，都能改变你的准备；打败对手的这一回合，它不会再出招。</p><h3>存档与改编</h3><p>游戏自动保存在此浏览器中。清理浏览器数据可能清除进度，可以随时在「存档」中导出备份。本篇为原创假设支线，携带上限、供养节奏、数值及部分蛊的品阶和配方经过简化；具体差异见蛊虫说明。</p></div><button className="button button-primary" onClick={onClose}>记下了，继续行走<Icon name="arrow" /></button></Modal>;
}

function EndingScreen({ game, meta, onNew, onTitle, onSave }: { game: GameState; meta: MetaProgress; onNew: () => void; onTitle: () => void; onSave: () => void }) {
  const ending = ENDINGS.find(item => item.id === game.ending!.id)!;
  const status = game.ending!.outcome;
  return <main className="ending-screen"><Landscape title /><div className="ending-content"><span className="eyebrow">青茅手札 · 此卷暂歇</span><div className={`ending-emblem ending-${ending.id}`}><Icon name={ending.id === 'inheritance' ? 'flame' : ending.id === 'clan' ? 'flag' : 'mountain'} size={42} /></div><span className="ending-status">{status === 'success' ? '达成结局' : status === 'survived' ? '期限已至 · 存活离山' : '伤势过重 · 败退结算'}</span><h1>{status === 'defeat' ? '败退离山' : ending.title}</h1><h2>{ending.subtitle}</h2><p className="ending-story">{game.ending!.reason}</p><div className="ending-stats"><div><span>停留</span><strong>{game.day}<small> 日</small></strong></div><div><span>境界</span><strong>{game.rank === 1 ? '一' : '二'}<small> 转</small></strong></div><div><span>所得情报</span><strong>{game.clues}</strong></div><div><span>剩余元石</span><strong>{game.resources.stones}</strong></div></div><div className="ending-progress">已走过 {meta.completedRuns} 段旅途 · 已抵达 {meta.endings.length} / 3 种结局</div><div className="ending-buttons"><button className="button button-primary" onClick={onNew}>再走一次，另择去路<Icon name="arrow" /></button><button className="button" onClick={onTitle}>返回山门</button><button className="text-button" onClick={onSave}><Icon name="download" size={16} />保存此行手札</button></div><details className="ending-journal"><summary>展开此行手记 <span>{game.journal.length} 条</span></summary><div>{[...game.journal].reverse().map(entry => <p key={entry.id}><span>第 {entry.day} 日</span>{entry.text}</p>)}</div></details></div></main>;
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [resume, setResume] = useState<SaveData | null>(null);
  const [meta, setMeta] = useState<MetaProgress>({ ...EMPTY_META });
  const metaRef = useRef(meta);
  const [loading, setLoading] = useState(true);
  const [atTitle, setAtTitle] = useState(true);
  const [pane, setPane] = useState<Pane>('map');
  const [focus, setFocus] = useState<JourneyFocus>('open');
  const [showSteps, setShowSteps] = useState(true);
  const [feedback, setFeedback] = useState<ActionFeedbackData | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<{ name: string; origin: OriginId } | null>(null);
  const [pendingImport, setPendingImport] = useState<SaveData | null>(null);
  const revision = useRef(0);
  const importRef = useRef<HTMLInputElement>(null);
  const importSequence = useRef(0);
  const feedbackSequence = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let alive = true;
    loadSave().then(save => {
      if (!alive) return;
      if (save) { setResume(save); setMeta(save.meta); metaRef.current = save.meta; setSavedAt(save.savedAt); }
    }).catch(error => { if (alive) { setNotice(error instanceof Error ? error.message : '无法读取本地存档，可以导入备份后继续。'); setSaveStatus('error'); } }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!game) return;
    const nextMeta = updateMeta(metaRef.current, game);
    metaRef.current = nextMeta;
    setMeta(nextMeta);
    const save = createSave(game, nextMeta);
    setResume(save);
    const currentRevision = ++revision.current;
    setSaveStatus('saving');
    writeSave(save).then(() => { if (currentRevision === revision.current) { setSaveStatus('saved'); setSavedAt(save.savedAt); } }).catch(() => { if (currentRevision === revision.current) setSaveStatus('error'); });
  }, [game]);

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(null), 7000); return () => clearTimeout(timer); }, [feedback]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [atTitle, game?.runId]);

  const scrollToGame = () => {
    requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
      if (!window.matchMedia('(max-width: 760px)').matches) return;
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      mainRef.current?.scrollIntoView({ block: 'start', behavior });
    });
  };
  const showPane = (nextPane: Pane) => { setPane(nextPane); scrollToGame(); };

  const begin = (name: string, origin: OriginId) => {
    const randomSeed = crypto.getRandomValues(new Uint32Array(1))[0];
    setGame(createGame({ name, origin, seed: randomSeed })); setAtTitle(false); setPane('map'); setFocus('open'); setFeedback(null); setPendingStart(null); setSaveOpen(false);
  };
  const requestStart = (name: string, origin: OriginId) => {
    if (loading) return;
    if (resume && !resume.game.ending) setPendingStart({ name, origin });
    else begin(name, origin);
  };
  const continueGame = () => {
    if (!resume) return;
    metaRef.current = resume.meta; setMeta(resume.meta); setGame(resume.game); setAtTitle(false); setPane('map');
  };
  const onAction = (action: GameAction) => {
    if (!game) return;
    const error = getActionError(game, action);
    if (error) { setNotice(error); return; }
    const next = gameReducer(game, action);
    if (next === game) return;
    setGame(next);
    setFeedback(feedbackFor(game, next, action, ++feedbackSequence.current));
    if (next.combat || next.activeEvent) setPane('map');
    if (next.combat && !game.combat) scrollToGame();
    if (['CHOOSE', 'CRAFT', 'FEED', 'BREAKTHROUGH'].includes(action.type) && !next.ending) setNotice(next.journal.at(-1)?.text ?? '已记入手札。');
  };
  const onGuideAction = (action: GameAction) => {
    if (action.type === 'END_DAY') setDayOpen(true);
    else onAction(action);
  };
  const exportCurrent = () => {
    const save = game ? createSave(game, metaRef.current) : resume;
    if (!save) { setNotice('开始一段旅途后，就可以导出手札。'); return; }
    const url = URL.createObjectURL(new Blob([serializeSave(save)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `qingmao-day-${save.game.day}-${save.game.seed}.json`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('手札已导出，请妥善保存这份备份。');
  };
  const readImport = async (file: File | undefined) => {
    if (!file || loading) return;
    const request = ++importSequence.current;
    setPendingImport(null);
    try {
      if (file.size > 1_000_000) throw new Error('存档过大，请选择小于 1 MB 的游戏备份。');
      const raw = await file.text();
      if (request !== importSequence.current) return;
      const save = parseSave(raw);
      setPendingImport(save);
      setSaveOpen(false);
    } catch (error) {
      if (request === importSequence.current) setNotice(error instanceof Error ? error.message : '无法读取这份存档。');
    } finally {
      if (request === importSequence.current && importRef.current) importRef.current.value = '';
    }
  };
  const confirmImport = () => {
    if (!pendingImport) return;
    const merged = mergeMeta(metaRef.current, pendingImport.meta); metaRef.current = merged; setMeta(merged); setGame(pendingImport.game); setAtTitle(false); setPane('map'); setFocus('open'); setFeedback(null); setPendingImport(null); setNotice('已载入手札，继续你的行程。');
  };

  const renderPane = () => {
    if (!game) return null;
    if (game.combat) return <CombatPanel game={game} onAction={onAction} />;
    if (pane === 'gu') return <GuPanel game={game} onAction={onAction} />;
    if (pane === 'forge') return <ForgePanel game={game} onAction={onAction} />;
    if (pane === 'market') return <ShopPanel game={game} onAction={onAction} />;
    if (pane === 'journal') return <JournalPanel game={game} />;
    return <><JourneyGuide key={game.runId} game={game} focus={focus} onFocus={setFocus} showSteps={showSteps} onHideSteps={() => setShowSteps(false)} onAction={onGuideAction} onPane={showPane} /><LocationPanel game={game} focus={focus} onAction={onAction} onShop={() => showPane('market')} /></>;
  };

  return <>
    {atTitle || !game ? <TitleScreen resume={resume} meta={meta} loading={loading} onContinue={continueGame} onStart={requestStart} onHelp={() => setHelpOpen(true)} onSave={() => setSaveOpen(true)} /> : game.ending ? <EndingScreen game={game} meta={meta} onNew={() => setAtTitle(true)} onTitle={() => setAtTitle(true)} onSave={exportCurrent} /> : <div className="game-shell">
      <header className="game-header"><button className="brand" onClick={() => setAtTitle(true)} aria-label="返回山门"><span className="brand-mark">青</span><span><strong>青茅山</strong><small>传承争夺</small></span></button><div className="chapter-label"><span>卷一</span>石灯遗藏</div><div className="header-tools"><button className="text-button save-indicator" onClick={() => setSaveOpen(true)}><span className={`save-dot ${saveStatus}`} />{saveStatus === 'saved' ? '已存档' : saveStatus === 'saving' ? '落笔中' : '保存失败，请备份'}</button><button className="icon-button" aria-label="查看游戏指南" onClick={() => setHelpOpen(true)}><Icon name="help" /></button><button className="icon-button" aria-label="管理存档" onClick={() => setSaveOpen(true)}><Icon name="book" /></button></div></header>
      <div className="day-strip"><div className="day-info"><Icon name={game.actions === 0 ? 'moon' : 'sun'} size={23} /><div><span>第 <strong>{String(game.day).padStart(2, '0')}</strong> 日 <small>/ 十日</small></span><span className="time-name">{game.actions === 3 ? '晨雾未散' : game.actions === 2 ? '日过竹梢' : game.actions === 1 ? '山色将暮' : '灯火初上'}</span></div><div className="action-dots" aria-label={`今日剩余 ${game.actions} 次行动`}>{[0, 1, 2].map(i => <i className={i < game.actions ? 'available' : ''} key={i} />)}<span>{game.actions} 次行动</span></div></div><div className="resource-row"><span><Icon name="gem" /><b>{game.resources.stones}</b><small>元石</small></span><span><Icon name="leaf" /><b>{game.resources.herbs}</b><small>药草</small></span><span><Icon name="ore" /><b>{game.resources.ore}</b><small>矿料</small></span><span><Icon name="wine" /><b>{game.resources.wine}</b><small>清酒</small></span></div><button className={`button end-day-button${game.actions === 0 ? ' button-primary' : ''}`} onClick={() => setDayOpen(true)} disabled={!!game.combat || !!game.activeEvent}><Icon name="moon" />结束当日<Icon name="arrow" size={16} /></button></div>
      <ActionFeedback feedback={feedback} />
      <nav className="game-nav" aria-label="游戏功能">{NAV.map(item => <button key={item.id} className={pane === item.id ? 'active' : ''} onClick={() => showPane(item.id)} aria-current={pane === item.id ? 'page' : undefined} disabled={Boolean(game.activeEvent) || (Boolean(game.combat) && item.id !== 'map')}><Icon name={item.icon} /><span>{item.label}</span>{item.id === 'gu' && game.hungry.length > 0 && <i className="nav-alert" />}</button>)}</nav>
      <div className="game-layout"><PlayerPanel game={game} onAction={onAction} onBag={() => showPane('gu')} /><main className="game-main" aria-label="当前游戏区域" ref={mainRef} tabIndex={-1}>{renderPane()}</main><aside className="journey-sidebar"><QuestPanel game={game} /><div className="field-note"><span className="eyebrow">行路小记</span><p>{game.actions === 0 ? '今日脚步已尽。结清供养，留力给明日。' : game.hungry.length ? '有蛊正在休眠。补喂后，才能再次借它们的力量。' : game.resources.stones < getUpkeep(game) ? '元石不够今夜的供养。市集搬货和公仓劳作，都能换些现钱。' : game.clues === 0 ? '先到学堂接下差事，再去竹林、山涧和市集辨认风声。' : '机缘有价，承诺也有价。多留一条退路，总是好的。'}</p><Icon name="leaf" size={20} /></div></aside></div><footer className="game-footer"><span>山中一日，诸事皆有代价。</span><span>{savedAt ? `最近存档 ${saveDate(savedAt)}` : '行程保存在本浏览器'}</span></footer>
    </div>}
    {game?.activeEvent && !atTitle && !pendingImport && <EventModal game={game} onAction={onAction} />}
    {helpOpen && <Guide onClose={() => setHelpOpen(false)} />}
    {dayOpen && game && <Modal title={game.day === 10 ? '最后一夜，准备离山' : '收起行囊，歇一夜'} label={`第 ${game.day} 日 · 日暮结算`} onClose={() => setDayOpen(false)}><div className="day-summary"><div><span>今日供养</span><strong>{getUpkeep(game)}<small> 元石</small></strong></div><div><span>结算后元石</span><strong>{Math.max(0, game.resources.stones - (game.resources.stones >= getUpkeep(game) ? getUpkeep(game) : 0))}</strong></div><div><span>尚余行动</span><strong>{game.actions}</strong></div></div>{game.resources.stones < getUpkeep(game) && <p className="warning-note">元石不足，不会扣款；今日携带的蛊将进入休眠，需要之后补喂。</p>}{game.actions > 0 && <p className="muted">剩余 {game.actions} 次行动不会留到明日。</p>}<p className="modal-prose">{game.day === 10 ? '十日期限已到。若现在结束当日，你将按「存活离山」结算，尚未完成的争夺也会就此放下。' : '生命恢复 4 点，真元回满，疑心减少 3。明日重新获得 3 次行动。'}</p><div className="modal-actions"><button className="button" onClick={() => setDayOpen(false)}>再想一想</button><button className="button button-primary" onClick={() => { onAction({ type: 'END_DAY' }); setDayOpen(false); }}>{game.day === 10 ? '结束旅途' : '确认休整'}<Icon name="arrow" /></button></div></Modal>}
    {saveOpen && <Modal title="行旅手札" label="保留这次选择" onClose={() => setSaveOpen(false)}><p className="modal-prose">行程会自动保存在当前浏览器。导出一份备份，可以留住此刻的进度，也可以在其他设备继续。</p><div className="save-summary"><Icon name="book" size={28} /><div><strong>{game?.name ?? resume?.game.name ?? '还没有开始的旅途'}</strong><small>{game ? `第 ${game.day} 日 · ${LOCATIONS.find(item => item.id === game.location)?.name}` : resume ? `第 ${resume.game.day} 日` : '从山门启程后，将自动记录。'}</small></div></div>{saveStatus === 'error' && <p className="warning-note">本地存档暂时不可用，请导出备份，避免关闭页面后丢失进度。</p>}<div className="save-actions"><button className="button button-primary" onClick={exportCurrent} disabled={!game && !resume}><Icon name="download" />导出存档</button><button className="button" onClick={() => importRef.current?.click()}><Icon name="upload" />导入存档</button></div><p className="modal-footnote">备份格式为 JSON，最大 1 MB。导入前会检查格式并请你确认。</p></Modal>}
    {pendingStart && <Modal title="开启新的山中行程？" onClose={() => setPendingStart(null)}><p className="modal-prose">新的行程将替换当前自动存档。已解锁的结局会保留；想留下尚未走完的这条路，可以先导出备份。</p><div className="modal-actions"><button className="button" onClick={exportCurrent}><Icon name="download" />先导出备份</button><button className="button button-primary" onClick={() => begin(pendingStart.name, pendingStart.origin)}>确认启程<Icon name="arrow" /></button></div></Modal>}
    {pendingImport && <Modal title="从这页手札继续？" onClose={() => setPendingImport(null)}><p className="modal-prose">即将载入 {pendingImport.game.name} 在第 {pendingImport.game.day} 日的行程，并替换当前自动存档。已解锁的结局会合并保留。</p><div className="modal-actions"><button className="button" onClick={() => setPendingImport(null)}>取消</button><button className="button button-primary" onClick={confirmImport}>确认载入<Icon name="arrow" /></button></div></Modal>}
    <input type="file" ref={importRef} accept=".json,application/json" className="hidden-file" aria-label="选择游戏存档" onChange={event => void readImport(event.target.files?.[0])} />
    {notice && <div className="toast" role="status"><Icon name="book" size={17} /><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}><Icon name="close" size={15} /></button></div>}
  </>;
}
