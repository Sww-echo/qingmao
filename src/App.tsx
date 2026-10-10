import { useEffect, useRef, useState } from 'react';
import { ORIGINS } from './game/content';
import { getCampaignEndings, getCampaignEvents, getCampaignGu, getCampaignLabel, getCampaignLocations, isFangYuan } from './game/campaign';
import { createGame, gameReducer, getActionError, getAvailableEvents, getChoiceError, getEffectiveStats, getEventActionCost, getUpkeep } from './game/engine';
import { EMPTY_META, createSave, loadSave, parseSave, serializeSave, updateMeta, writeSave } from './game/storage';
import type { GameAction, GameState, MetaProgress, SaveData } from './game/types';
import { getJourneyAdvice, getMapEventCounts } from './game/guidance';
import type { JourneyFocus } from './game/guidance';
import { CampActions, ForgePanel, GuPanel, JournalPanel, QuestPanel, ShopPanel } from './GamePanels';
import ActionButton from './GameActionButton';
import CombatPanel from './CombatPanel';
import JourneyGuide from './JourneyGuide';
import ChapterPanel from './ChapterPanel';
import ChapterEnding from './ChapterEnding';
import FangChapter, { FANG_ACT_TITLES, FangEndingReview } from './FangChapter';
import ActionFeedback, { feedbackFor } from './ActionFeedback';
import type { ActionFeedbackData } from './ActionFeedback';
import WorldMap, { Landscape } from './WorldMap';
import { EffectList, getRealmLabel, Icon, Meter, Modal } from './ui';
import type { IconName } from './ui';

type Pane = 'map' | 'gu' | 'forge' | 'market' | 'journal';
export type SaveStatus = 'saved' | 'saving' | 'error';

/** The write effect runs after paint; a game that differs from the last persisted one must not read as saved. */
export function displayedSaveStatus(status: SaveStatus, game: GameState | null, persisted: GameState | null): SaveStatus {
  return status === 'saved' && game && persisted !== game ? 'saving' : status;
}

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

function savedFocus(game: GameState): JourneyFocus {
  return (['inheritance', 'clan', 'departure'] as const).find(route => game.flags.includes(`chapter-plan-${route}`)) ?? 'open';
}

function TitleScreen({ resume, meta, loading, onContinue, onStart, onHelp, onSave }: { resume: SaveData | null; meta: MetaProgress; loading: boolean; onContinue: () => void; onStart: () => void; onHelp: () => void; onSave: () => void }) {
  const endings = getCampaignEndings({ campaign: 'fang-yuan' });
  const completed = endings.filter(ending => meta.endings.includes(ending.id)).length;
  return <main className="title-screen fang-title-screen">
    <div className="title-art"><Landscape title /><div className="title-vignette" /><span className="vertical-poem">旧事重临，心中自有取舍。</span><div className="title-identity"><span className="seal">蛊</span><p>南疆 · 方源视角</p><h1>青茅山</h1><h2>重生初炼</h2><div className="title-rule" /><p className="title-pitch">五百年事，一梦归来。<br />开窍、炼蛊，循记忆探寻旧路。</p><div className="title-facts"><span>图文策略</span><i /><span>原著主角</span><i /><span>本地存档</span></div></div><div className="title-art-footer"><span>QINGMAO CHRONICLES</span><span>方源篇 · 重生初炼</span></div></div>
    <div className="title-content">
      <header className="title-tools"><span className="edition">青茅手札 · 方源篇</span><div><button className="icon-button" aria-label="查看游戏指南" onClick={onHelp}><Icon name="help" /></button><button className="icon-button" aria-label="管理存档" onClick={onSave} disabled={loading} title={loading ? '正在读取已有存档' : '管理存档'}><Icon name="book" /></button></div></header>
      <div className="title-form-wrap"><span className="eyebrow">这一世，从少年时重新开始</span><h2>古月方源</h2><p className="muted intro-description">带着前世记忆回到青茅山，经历开窍、领取月光蛊，沿酒香寻到花酒行者遗藏，再完成今生的首次炼蛊报验。</p>
        {loading && <div className="loading-note" role="status">正在翻开上次的手札…</div>}
        {resume && !loading && <button className="resume-card" onClick={onContinue}><span className="resume-icon"><Icon name="book" size={22} /></span><span><strong>{resume.game.ending ? '回顾上次行程' : '继续上次行程'}</strong><small>{getCampaignLabel(resume.game)}</small><small>{resume.game.name} · 第 {resume.game.day} {isFangYuan(resume.game) ? '行动日' : '日'} · {saveDate(resume.savedAt)}</small></span><Icon name="arrow" /></button>}
        <div className="fang-protagonist-card"><span className="fang-protagonist-seal" aria-hidden="true">方</span><div><strong>固定主角 · 古月方源</strong><p>前世五百年经历，今生从未开窍开始。选择会影响筹备、资源与旁人的态度。</p></div></div>
        <ol className="fang-title-acts" aria-label="方源篇四段经历">{FANG_ACT_TITLES.map((title, index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span>{title}</li>)}</ol>
        <button className="button button-primary start-button" type="button" onClick={onStart} disabled={loading}>开始方源篇<Icon name="arrow" size={20} /></button>
        <p className="fang-title-scope">本段可玩至首次炼蛊报验。花酒行者的深层传承与后续章节尚未开放。</p>
        <div className="fang-title-completion"><Icon name={completed ? 'check' : 'book'} size={20} /><div><strong>首次炼蛊报验</strong><small>{completed ? '本篇完成记录已保留' : '本篇尚未完成'}</small></div><span>{completed} / {endings.length}</span></div>
      </div><footer className="title-footer"><span>《蛊真人》方源视角 · 交互改编</span><span>方源篇</span></footer>
    </div>
  </main>;
}

function PlayerPanel({ game, onAction, onBag }: { game: GameState; onAction: (action: GameAction) => void; onBag: () => void }) {
  const stats = getEffectiveStats(game);
  const fang = isFangYuan(game);
  const guList = getCampaignGu(game);
  const carried = game.equipped.flatMap(id => { const gu = guList.find(item => item.id === id); return gu ? [gu] : []; });
  return <aside className={`player-panel panel${fang ? ' fang-player' : ''}`}><div className="player-portrait"><span className="portrait-orbit orbit-one" /><span className="portrait-orbit orbit-two" /><span className="portrait-mountain" /><span className="portrait-glyph">{fang ? '方' : game.name.replace('古月', '').slice(0, 1) || '行'}</span><span className="rank-seal">{getRealmLabel(game)}</span></div><div className="player-identity"><h2>{game.name}</h2><p>{fang ? game.rank === 0 ? '重生归来 · 开窍大典之前' : '一转初阶 · 丙等资质' : `${ORIGINS.find(item => item.id === game.origin)?.name ?? '山中行者'} · ${game.rank === 1 ? '青铜元海' : '赤铁元海'}`}</p></div>
    {fang && game.rank > 0 && <p className="fang-aptitude">资质：四成四（44%）<small>开窍时的固定测定结果，不是当前真元余量。</small></p>}
    <div className="player-meters"><Meter label="生命" value={game.hp} max={game.maxHp} kind="life" icon="heart" />{game.rank > 0 ? <><Meter label="真元" value={game.qi} max={game.maxQi} icon="spark" /><Meter label="修为" value={game.cultivation} max={fang ? Math.max(12, game.cultivation) : game.rank === 1 ? 12 : Math.max(12, game.cultivation)} kind="gold" /></> : <div className="fang-unawakened"><Icon name="spark" size={18} /><p>空窍尚未开辟。大典之后，才能温养真元、尝试炼蛊。</p></div>}</div>
    {!fang && game.rank === 1 && <div className="breakthrough-action"><ActionButton game={game} action={{ type: 'BREAKTHROUGH' }} onAction={onAction} icon="spark" detail="12 修为 · 12 元石 · 1 行动">突破二转</ActionButton></div>}
    <div className="player-divider" /><div className="carried-heading"><span>随身蛊虫 <b>{game.equipped.length}/4</b></span><button className="text-button" onClick={onBag} disabled={!!game.combat || !!game.activeEvent}>调整<Icon name="arrow" size={13} /></button></div><div className="carried-gu">{carried.map(gu => <button className={`carried-chip${game.hungry.includes(gu.id) ? ' asleep' : ''}`} key={gu.id} onClick={onBag} disabled={!!game.combat || !!game.activeEvent} aria-label={`查看${gu.name}`}><span>{gu.glyph}</span><span>{gu.name}<small>{game.hungry.includes(gu.id) ? '休眠' : gu.passive ? '携带生效' : `${gu.qiCost} 真元`}</small></span></button>)}{carried.length === 0 && <p className="muted">{fang ? '尚未携带已炼化的蛊。领取与炼化状态可在主线或蛊囊中查看。' : '尚未携带蛊虫。可在行囊中装备。'}</p>}</div>
    <div className="upkeep-note"><Icon name="leaf" size={15} /><span>今日供养 <strong>{getUpkeep(game)} 元石</strong></span></div>
    {game.hungry.length > 0 && <ActionButton game={game} action={{ type: 'FEED' }} onAction={onAction} icon="leaf">补喂休眠蛊</ActionButton>}
    <div className="player-divider" />{!fang && <div className="combat-stats"><span><Icon name="sword" size={14} />普攻 <b>{stats.attack}</b></span><span><Icon name="shield" size={14} />防御 <b>{stats.guard}</b></span></div>}<div className="social-stats"><span>宗族信任<b>{game.trust}</b></span><span>疑心<b>{game.suspicion}</b></span></div>
  </aside>;
}

function LocationPanel({ game, focus, onAction, onShop }: { game: GameState; focus: JourneyFocus; onAction: (action: GameAction) => void; onShop: () => void }) {
  const place = getCampaignLocations(game).find(item => item.id === game.location)!;
  const events = getAvailableEvents(game);
  const advice = getJourneyAdvice(game, focus);
  const lastStory = [...game.journal].reverse().find(entry => entry.kind === 'story' || entry.kind === 'good' || entry.kind === 'bad');
  return <>
    <WorldMap game={game} location={game.location} eventCounts={getMapEventCounts(game)} recommended={advice?.location} onTravel={location => onAction({ type: 'TRAVEL', location })} locked={Boolean(game.combat || game.activeEvent)} />
    <section className="location-panel panel">
      <div className="location-heading"><div><span className="eyebrow">{place.subtitle}</span><h2>{place.name}</h2></div><span className={`region-tag ${place.danger}`}><i />{place.danger === 'safe' ? '山寨之内' : place.danger === 'wild' ? '山野之间' : isFangYuan(game) ? '遗藏初探' : '遗藏深处'}</span></div>
      <p className="location-description">{place.description}</p>
      {events[0] && <div className="exploration-preview"><Icon name="book" size={19} /><div><small>眼前的动静 · {events[0].tag}</small><strong>{events[0].title}</strong></div></div>}
      <div className="location-actions">
        <ActionButton game={game} action={{ type: 'EXPLORE' }} onAction={onAction} primary icon="compass" detail={events[0] ? `${getEventActionCost(events[0]) === 0 ? '不耗行动' : '1 行动'} · 查看选项后再作选择` : undefined}>在此探查{events.length > 0 && <span className="new-event-dot" />}</ActionButton>
        <ActionButton game={game} action={{ type: 'ACTIVITY' }} onAction={onAction} icon={game.location === 'bamboo' ? 'leaf' : game.location === 'stream' || game.location === 'cave' ? 'ore' : 'book'} detail={place.activity.description}>{place.activity.label}</ActionButton>
        {game.location === 'market' && <div className="action-wrap"><button className="button" onClick={onShop}><Icon name="store" />逛逛货摊</button><small className="action-detail">购买不消耗行动</small></div>}
      </div>
      {events.length > 1 && <details className="other-events"><summary>周围还有 {events.length - 1} 处动静</summary><div>{events.slice(1).map(event => <button className="other-event-button" key={event.id} onClick={() => onAction({ type: 'EXPLORE', eventId: event.id })} disabled={Boolean(getActionError(game, { type: 'EXPLORE', eventId: event.id }))}><span>{event.tag}</span><strong>{event.title}</strong><small>{getEventActionCost(event) === 0 ? '不耗行动' : '1 行动'}</small><Icon name="arrow" size={14} /></button>)}</div></details>}
      <CampActions game={game} onAction={onAction} />
    </section>
    {lastStory && <section className={`last-story story-${lastStory.kind}`} aria-live="polite"><Icon name="book" size={17} /><div><span>手记 · 第 {lastStory.day} 日</span><p>{lastStory.text}</p></div></section>}
  </>;
}

function EventModal({ game, onAction }: { game: GameState; onAction: (action: GameAction) => void }) {
  const event = getCampaignEvents(game).find(item => item.id === game.activeEvent)!;
  return <Modal title={event.title} label={`第 ${game.day} ${isFangYuan(game) ? '行动日' : '日'} · ${event.tag} · ${getCampaignLocations(game).find(place => place.id === event.location)?.name}`} wide><div className="event-prose" data-event-id={event.id}>{event.description.split('\n').filter(Boolean).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div><div className="event-resource-strip"><span><Icon name="heart" size={14} />{game.hp} 生命</span><span><Icon name="gem" size={14} />{game.resources.stones} 元石</span>{game.rank > 0 && <span><Icon name="spark" size={14} />{game.qi} 真元</span>}<span><Icon name="eye" size={14} />{game.clues} {isFangYuan(game) ? '线索' : '情报'}</span></div><div className="event-choices">{event.choices.map((choice, index) => { const error = getChoiceError(game, choice); return <button key={choice.id} className="event-choice" data-choice-id={choice.id} disabled={!!error} onClick={() => onAction({ type: 'CHOOSE', choiceId: choice.id })}><span className="choice-number">{String(index + 1).padStart(2, '0')}</span><span className="choice-body"><strong>{choice.label}{choice.encounterId && <span className="choice-tag">进入战斗</span>}{choice.ending && <span className="choice-tag ending-tag">{isFangYuan(game) ? '完成本段' : '结束旅途'}</span>}</strong><span className="choice-description">{choice.description}</span><EffectList effects={choice.effects} compact game={game} />{error && <span className="choice-requirement">{error}</span>}</span><Icon name="arrow" size={17} /></button>; })}</div><p className="modal-footnote">{getEventActionCost(event) === 0 ? '这段剧情不消耗行动。' : '本次探查已消耗 1 次行动，作出选择不再扣除。'}选择与得失会写入手记。</p></Modal>;
}

function Guide({ onClose, game }: { onClose: () => void; game?: GameState }) {
  if (!game || isFangYuan(game)) return <Modal title="方源篇 · 行走与炼蛊" label="重生初炼" onClose={onClose} wide><div className="guide-grid"><div><span className="guide-number">壹</span><h3>从重生到首次报验</h3><p>你固定扮演古月方源。按主线经历重生、开窍、领取月光蛊、寻觅酒虫与首次炼蛊报验；地点会随调查进度开放。当前一段的按钮会带你前往实际地点。</p></div><div><span className="guide-number">贰</span><h3>行动日与剧情代价</h3><p>每天有三次行动，剧情与活动的代价会标在按钮旁。移动、购买和调整蛊虫不消耗行动。战外可在「整顿自身」中用 2 药草恢复最多 8 生命，也不耗行动。日数用于压缩呈现行程，结束一日后仍能继续主线，没有离山倒计时。</p></div><div><span className="guide-number">叁</span><h3>领取、炼化、携带</h3><p>未炼化的月光蛊和酒虫只记在主线中，不能装备。炼化成功后才进入蛊囊，携带才能发挥能力；每日为当天携带过的蛊结清供养，休眠后需补喂。</p></div><div><span className="guide-number">肆</span><h3>资质与当前真元</h3><p>开窍测得的丙等、四成四（44%）是固定资质。真元余量和修为另行显示。每次温养消耗 1 行动、3 真元。酒虫炼化后，携带并保持苏醒可提高温养效率；实际修为收益会标在按钮旁，达到本段上限后不能继续温养。</p></div></div><div className="guide-note"><h3>本命蛊与本段范围</h3><p>{game?.flags.includes('fy-cicada-revealed') ? '春秋蝉是重伤沉眠的六转本命蛊。你已借其气息炼蛊，但不能发动重生，也不将它作为战斗蛊装备。' : '重生之因暂时无法确认，空窍中的异变还要随主线查明。'}本段保持一转初阶，合炼、二转突破与深层花酒传承尚未开放。</p><h3>手札会留下什么</h3><p>主线选择、资源得失、人物关系和风险都会写入本局手札。{game?.flags.includes('fy-cicada-revealed') ? '报验以月光蛊示人，酒虫与春秋蝉仍作为秘密保留。' : '炼蛊与报验中的秘密，会随实际经历逐步揭晓。'}完成本段后可以回看实际所得。</p><h3>保存与继续</h3><p>游戏自动保存在当前浏览器。可从「存档」导出备份，在其他设备继续；导入前会显示所属篇章并确认替换。已有石灯遗藏旧档会继续原版内容。</p></div><button className="button button-primary" onClick={onClose}>记下了，继续<Icon name="arrow" /></button></Modal>;
  return <Modal title="一份山中行走的指南" label="初入青茅" onClose={onClose} wide><div className="guide-grid"><div><span className="guide-number">壹</span><h3>先探查，再决定去路</h3><p>地图数字表示当前可探的事件。可以按行路建议选择关注的路线，也可以自己点选地点探查。青竹林、听雨涧和市集都可能藏着线索。</p></div><div><span className="guide-number">贰</span><h3>每天只有三次行动</h3><p>普通探查、劳作、修炼、调息、合炼各用一次。章节交谈标明「不耗行动」；移动、购物和调整蛊虫也不耗行动。准备好后，点击「结束当日」。第十日之后行程结束。</p></div><div><span className="guide-number">叁</span><h3>蛊要养，真元要留</h3><p>每日为当天携带过的蛊支付元石，卸下也要结清。钱不够时蛊会休眠，补喂后才能恢复。封存且整日未携带的蛊不计供养，离线不消耗资源。</p></div><div><span className="guide-number">肆</span><h3>看清下一招</h3><p>敌人执行已显示的下一招，预判会比较当前护势与普通防御的结果。战斗中，2 药草可恢复最多 8 生命，1 清酒可恢复最多 5 真元，补给占一次出手。战外可在「整顿自身」中用 2 药草疗伤，不耗每日行动。</p></div></div><div className="guide-note"><h3>三种去路，都有代价</h3><p>新行程会先经历入山、议事与临行交代，三段交谈均不耗行动。准备方向随时能改，最后仍由你选择结局。独掌传承要战胜守关者，宗族立足要分享线索、积累信任，离山要留够盘缠；成长清单是建议，不强制和平路线战斗。</p><h3>准备也能改变胜负</h3><p>修为达到 12 后，可花 12 元石和一次行动突破二转。护身蛊、治疗蛊、合炼与支线回报，都能改变你的准备；打败对手的这一回合，它不会再出招。</p><h3>存档与改编</h3><p>游戏自动保存在此浏览器中。清理浏览器数据可能清除进度，可以随时在「存档」中导出备份。本篇为原创假设支线，携带上限、供养节奏、数值及部分蛊的品阶和配方经过简化；具体差异见蛊虫说明。</p></div><button className="button button-primary" onClick={onClose}>记下了，继续行走<Icon name="arrow" /></button></Modal>;
}

function EndingScreen({ game, meta, onNew, onTitle, onSave }: { game: GameState; meta: MetaProgress; onNew: () => void; onTitle: () => void; onSave: () => void }) {
  const fang = isFangYuan(game);
  const endings = getCampaignEndings(game);
  const ending = endings.find(item => item.id === game.ending!.id);
  const unlocked = endings.filter(item => meta.endings.includes(item.id)).length;
  const status = game.ending!.outcome;
  if (fang) return <main className="ending-screen fang-ending-screen" data-campaign="fang-yuan"><Landscape title /><div className="ending-content"><span className="eyebrow">{getCampaignLabel(game)} · 此段暂歇</span><div className="ending-emblem ending-inheritance"><Icon name={status === 'success' ? 'moon' : 'book'} size={42} /></div><span className="ending-status">{status === 'success' ? '首次炼蛊 · 报验完成' : '行程中断 · 本段未完成'}</span><h1>{status === 'success' ? ending?.title ?? '首次炼蛊报验' : '初炼未竟'}</h1><h2>{status === 'success' ? ending?.subtitle ?? '月光示人，秘密留于空窍' : '已走过的经历，仍留在手札中'}</h2><p className="ending-story">{game.ending!.reason}</p><div className="ending-stats"><div><span>行程</span><strong>{game.day}<small> 行动日</small></strong></div><div><span>境界</span><strong className="fang-ending-realm">{getRealmLabel(game)}</strong></div><div><span>当前修为</span><strong>{game.cultivation}</strong></div><div><span>元石余额</span><strong>{game.resources.stones}</strong></div></div><div className="ending-progress">方源篇完成记录：{unlocked} / {endings.length}</div><FangEndingReview game={game} /><div className="ending-buttons"><button className="button button-primary" onClick={onNew}>重新经历方源篇<Icon name="arrow" /></button><button className="button" onClick={onTitle}>返回山门</button><button className="text-button" onClick={onSave}><Icon name="download" size={16} />保存此行手札</button></div><details className="ending-journal"><summary>展开此行手记 <span>{game.journal.length} 条</span></summary><div>{[...game.journal].reverse().map(entry => <p key={entry.id}><span>第 {entry.day} 行动日</span>{entry.text}</p>)}</div></details></div></main>;
  if (!ending) return <main className="ending-screen"><div className="ending-content"><h1>此行暂歇</h1><p className="ending-story">{game.ending!.reason}</p><button className="button button-primary" onClick={onSave}>保存此行手札</button><button className="button" onClick={onTitle}>返回山门</button></div></main>;
  return <main className="ending-screen"><Landscape title /><div className="ending-content"><span className="eyebrow">青茅手札 · 此卷暂歇</span><div className={`ending-emblem ending-${ending.id}`}><Icon name={ending.id === 'inheritance' ? 'flame' : ending.id === 'clan' ? 'flag' : 'mountain'} size={42} /></div><span className="ending-status">{status === 'success' ? '达成结局' : status === 'survived' ? '期限已至 · 存活离山' : '伤势过重 · 败退结算'}</span><h1>{status === 'defeat' ? '败退离山' : ending.title}</h1><h2>{ending.subtitle}</h2><p className="ending-story">{game.ending!.reason}</p><div className="ending-stats"><div><span>停留</span><strong>{game.day}<small> 日</small></strong></div><div><span>境界</span><strong>{game.rank === 1 ? '一' : '二'}<small> 转</small></strong></div><div><span>所得情报</span><strong>{game.clues}</strong></div><div><span>剩余元石</span><strong>{game.resources.stones}</strong></div></div><div className="ending-progress">原创支线：已抵达 {unlocked} / {endings.length} 种结局</div><ChapterEnding game={game} /><div className="ending-buttons"><button className="button button-primary" onClick={onNew}>开启方源篇<Icon name="arrow" /></button><button className="button" onClick={onTitle}>返回山门</button><button className="text-button" onClick={onSave}><Icon name="download" size={16} />保存此行手札</button></div><details className="ending-journal"><summary>展开此行手记 <span>{game.journal.length} 条</span></summary><div>{[...game.journal].reverse().map(entry => <p key={entry.id}><span>第 {entry.day} 日</span>{entry.text}</p>)}</div></details></div></main>;
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
  const [persistedGame, setPersistedGame] = useState<GameState | null>(null);
  const [notice, setNotice] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
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
    writeSave(save).then(() => { if (currentRevision === revision.current) { setSaveStatus('saved'); setSavedAt(save.savedAt); setPersistedGame(game); } }).catch(() => { if (currentRevision === revision.current) setSaveStatus('error'); });
  }, [game]);

  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(null), 7000); return () => clearTimeout(timer); }, [feedback]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [atTitle, game?.runId, game?.ending?.id, game?.ending?.outcome]);

  const scrollToGame = () => {
    requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
      if (!window.matchMedia('(max-width: 760px)').matches) return;
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      mainRef.current?.scrollIntoView({ block: 'start', behavior });
    });
  };
  const showPane = (nextPane: Pane) => { setPane(nextPane); scrollToGame(); };

  const begin = () => {
    const randomSeed = crypto.getRandomValues(new Uint32Array(1))[0];
    setGame(createGame({ campaign: 'fang-yuan', seed: randomSeed })); setAtTitle(false); setPane('map'); setFocus('open'); setShowSteps(true); setFeedback(null); setPendingStart(false); setSaveOpen(false);
  };
  const requestStart = () => {
    if (loading) return;
    if (resume && !resume.game.ending) setPendingStart(true);
    else begin();
  };
  const continueGame = () => {
    if (!resume) return;
    metaRef.current = resume.meta; setMeta(resume.meta); setGame(resume.game); setFocus(savedFocus(resume.game)); setAtTitle(false); setPane('map');
  };
  const onAction = (action: GameAction) => {
    if (!game) return;
    const error = getActionError(game, action);
    if (error) { setNotice(error); return; }
    const next = gameReducer(game, action);
    if (next === game) return;
    setGame(next);
    if (!isFangYuan(next) && action.type === 'CHOOSE' && action.choiceId.startsWith('prepare-') && next.flags.includes('chapter-ready')) setFocus(savedFocus(next));
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
    const merged = mergeMeta(metaRef.current, pendingImport.meta); metaRef.current = merged; setMeta(merged); setGame(pendingImport.game); setAtTitle(false); setPane('map'); setFocus(savedFocus(pendingImport.game)); setFeedback(null); setPendingImport(null); setNotice('已载入手札，继续你的行程。');
  };

  const renderPane = () => {
    if (!game) return null;
    if (game.combat) return <CombatPanel game={game} onAction={onAction} />;
    if (pane === 'gu') return <GuPanel game={game} onAction={onAction} />;
    if (pane === 'forge') return <ForgePanel game={game} onAction={onAction} />;
    if (pane === 'market') return <ShopPanel game={game} onAction={onAction} />;
    if (pane === 'journal') return <JournalPanel game={game} />;
    return <>{isFangYuan(game) ? <FangChapter game={game} onAction={onAction} /> : <ChapterPanel game={game} onAction={onAction} />}<JourneyGuide key={game.runId} game={game} focus={focus} onFocus={setFocus} showSteps={showSteps} onHideSteps={() => setShowSteps(false)} onAction={onGuideAction} onPane={showPane} /><LocationPanel game={game} focus={focus} onAction={onAction} onShop={() => showPane('market')} /></>;
  };

  const fang = Boolean(game && isFangYuan(game));
  const shownSaveStatus = displayedSaveStatus(saveStatus, game, persistedGame);
  const finalLegacyDay = !fang && game?.day === 10;
  const displayedSaveGame = game ?? resume?.game ?? null;

  return <>
    {atTitle || !game ? <TitleScreen resume={resume} meta={meta} loading={loading} onContinue={continueGame} onStart={requestStart} onHelp={() => setHelpOpen(true)} onSave={() => setSaveOpen(true)} /> : game.ending ? <EndingScreen game={game} meta={meta} onNew={() => setAtTitle(true)} onTitle={() => setAtTitle(true)} onSave={exportCurrent} /> : <div className={`game-shell${fang ? ' fang-game' : ''}`} data-campaign={fang ? 'fang-yuan' : 'legacy'}>
      <header className="game-header"><button className="brand" onClick={() => setAtTitle(true)} aria-label="返回山门"><span className="brand-mark">青</span><span><strong>青茅山</strong><small>{fang ? '重生初炼' : '传承争夺'}</small></span></button><div className="chapter-label"><span>{fang ? '方源篇' : '卷一'}</span>{fang ? '重生初炼' : '石灯遗藏'}</div><div className="header-tools"><button className="text-button save-indicator" onClick={() => setSaveOpen(true)}><span className={`save-dot ${shownSaveStatus}`} />{shownSaveStatus === 'saved' ? '已存档' : shownSaveStatus === 'saving' ? '落笔中' : '保存失败，请备份'}</button><button className="icon-button" aria-label="查看游戏指南" onClick={() => setHelpOpen(true)}><Icon name="help" /></button><button className="icon-button" aria-label="管理存档" onClick={() => setSaveOpen(true)}><Icon name="book" /></button></div></header>
      <div className="day-strip"><div className="day-info"><Icon name={game.actions === 0 ? 'moon' : 'sun'} size={23} /><div><span>第 <strong>{String(game.day).padStart(2, '0')}</strong> {fang ? '行动日' : '日'} {!fang && <small>/ 十日</small>}</span><span className="time-name">{game.actions === 3 ? '晨雾未散' : game.actions === 2 ? '日过竹梢' : game.actions === 1 ? '山色将暮' : '灯火初上'}</span></div><div className="action-dots" aria-label={`今日剩余 ${game.actions} 次行动`}>{[0, 1, 2].map(i => <i className={i < game.actions ? 'available' : ''} key={i} />)}<span>{game.actions} 次行动</span></div></div><div className="resource-row"><span><Icon name="gem" /><b>{game.resources.stones}</b><small>元石</small></span><span><Icon name="leaf" /><b>{game.resources.herbs}</b><small>药草</small></span><span><Icon name="ore" /><b>{game.resources.ore}</b><small>矿料</small></span><span><Icon name="wine" /><b>{game.resources.wine}</b><small>清酒</small></span></div><button className={`button end-day-button${game.actions === 0 ? ' button-primary' : ''}`} onClick={() => setDayOpen(true)} disabled={!!game.combat || !!game.activeEvent}><Icon name="moon" />结束当日<Icon name="arrow" size={16} /></button></div>
      <ActionFeedback feedback={feedback} game={game} />
      <nav className="game-nav" aria-label="游戏功能">{NAV.map(item => <button key={item.id} className={pane === item.id ? 'active' : ''} onClick={() => showPane(item.id)} aria-current={pane === item.id ? 'page' : undefined} disabled={Boolean(game.activeEvent) || (Boolean(game.combat) && item.id !== 'map')}><Icon name={item.icon} /><span>{fang && item.id === 'market' ? '酒肆补给' : item.label}</span>{item.id === 'gu' && game.hungry.length > 0 && <i className="nav-alert" />}</button>)}</nav>
      <div className="game-layout"><PlayerPanel game={game} onAction={onAction} onBag={() => showPane('gu')} /><main className="game-main" aria-label="当前游戏区域" ref={mainRef} tabIndex={-1}>{renderPane()}</main><aside className="journey-sidebar"><QuestPanel game={game} />{!fang && <div className="field-note"><span className="eyebrow">行路小记</span><p>{game.actions === 0 ? '今日脚步已尽。结清供养，留力给明日。' : game.hungry.length ? '有蛊正在休眠。补喂后，才能再次借它们的力量。' : game.resources.stones < getUpkeep(game) ? '元石不够今夜的供养。市集搬货和公仓劳作，都能换些现钱。' : game.clues === 0 ? '先到学堂接下差事，再去竹林、山涧和市集辨认风声。' : '机缘有价，承诺也有价。多留一条退路，总是好的。'}</p><Icon name="leaf" size={20} /></div>}</aside></div><footer className="game-footer"><span>山中一日，诸事皆有代价。</span><span>{savedAt ? `最近存档 ${saveDate(savedAt)}` : '行程保存在本浏览器'}</span></footer>
    </div>}
    {game?.activeEvent && !atTitle && !pendingImport && <EventModal game={game} onAction={onAction} />}
    {helpOpen && <Guide game={!atTitle && game ? game : undefined} onClose={() => setHelpOpen(false)} />}
    {dayOpen && game && <Modal title={finalLegacyDay ? '最后一夜，准备离山' : '收起行囊，歇一夜'} label={`第 ${game.day} ${fang ? '行动日' : '日'} · 日暮结算`} onClose={() => setDayOpen(false)}><div className="day-summary"><div><span>今日供养</span><strong>{getUpkeep(game)}<small> 元石</small></strong></div><div><span>结算后元石</span><strong>{Math.max(0, game.resources.stones - (game.resources.stones >= getUpkeep(game) ? getUpkeep(game) : 0))}</strong></div><div><span>尚余行动</span><strong>{game.actions}</strong></div></div>{game.resources.stones < getUpkeep(game) && <p className="warning-note">元石不足，不会扣款；今日携带的蛊将进入休眠，需要之后补喂。</p>}{game.actions > 0 && <p className="muted">剩余 {game.actions} 次行动不会留到明日。</p>}<p className="modal-prose">{finalLegacyDay ? '十日期限已到。若现在结束当日，你将按「存活离山」结算，尚未完成的争夺也会就此放下。' : game.rank === 0 ? '生命恢复 4 点，疑心减少 3。空窍尚未开启，明日重新获得 3 次行动。' : '生命恢复 4 点，真元回满，疑心减少 3。明日重新获得 3 次行动。'}</p>{fang && <p className="fang-status-note">夜间休整后仍可继续方源篇主线；日数表示本次行程的行动日。</p>}<div className="modal-actions"><button className="button" onClick={() => setDayOpen(false)}>再想一想</button><button className="button button-primary" onClick={() => { onAction({ type: 'END_DAY' }); setDayOpen(false); }}>{finalLegacyDay ? '结束旅途' : '确认休整'}<Icon name="arrow" /></button></div></Modal>}
    {saveOpen && <Modal title="行旅手札" label="保留这次选择" onClose={() => setSaveOpen(false)}><p className="modal-prose">行程会自动保存在当前浏览器。导出一份备份，可以留住此刻的进度，也可以在其他设备继续。</p><div className="save-summary"><Icon name="book" size={28} /><div><strong>{displayedSaveGame?.name ?? '还没有开始的旅途'}</strong>{displayedSaveGame && <small>{getCampaignLabel(displayedSaveGame)}</small>}<small>{displayedSaveGame ? `第 ${displayedSaveGame.day} ${isFangYuan(displayedSaveGame) ? '行动日' : '日'} · ${getCampaignLocations(displayedSaveGame).find(item => item.id === displayedSaveGame.location)?.name}` : '从山门启程后，将自动记录。'}</small></div></div>{saveStatus === 'error' && <p className="warning-note">本地存档暂时不可用，请导出备份，避免关闭页面后丢失进度。</p>}<div className="save-actions"><button className="button button-primary" onClick={exportCurrent} disabled={!game && !resume}><Icon name="download" />导出存档</button><button className="button" onClick={() => importRef.current?.click()}><Icon name="upload" />导入存档</button></div><p className="modal-footnote">备份格式为 JSON，最大 1 MB。导入前会检查格式并请你确认。</p></Modal>}
    {pendingStart && <Modal title="开启新的山中行程？" onClose={() => setPendingStart(false)}><p className="modal-prose">将以古月方源开启「重生初炼」，替换当前自动存档。已有篇章的完成记录会保留；想留下尚未走完的行程，可以先导出备份。</p><div className="modal-actions"><button className="button" onClick={exportCurrent}><Icon name="download" />先导出备份</button><button className="button button-primary" onClick={begin}>确认启程<Icon name="arrow" /></button></div></Modal>}
    {pendingImport && <Modal title="从这页手札继续？" onClose={() => setPendingImport(null)}><p className="fang-import-campaign">{getCampaignLabel(pendingImport.game)}</p><p className="modal-prose">即将载入 {pendingImport.game.name} 在第 {pendingImport.game.day} {isFangYuan(pendingImport.game) ? '行动日' : '日'}的行程，并替换当前自动存档。所属篇章会按这份手札继续，完成记录会合并保留。</p><div className="modal-actions"><button className="button" onClick={() => setPendingImport(null)}>取消</button><button className="button button-primary" onClick={confirmImport}>确认载入<Icon name="arrow" /></button></div></Modal>}
    <input type="file" ref={importRef} accept=".json,application/json" className="hidden-file" aria-label="选择游戏存档" onChange={event => void readImport(event.target.files?.[0])} />
    {notice && <div className="toast" role="status"><Icon name="book" size={17} /><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}><Icon name="close" size={15} /></button></div>}
  </>;
}
