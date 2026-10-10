import { useId } from 'react';
import { EVENTS, LOCATIONS } from './game/content';
import { getChapterProgress } from './game/chapter';
import { isFangYuan } from './game/campaign';
import { getActionError, getAvailableEvents } from './game/engine';
import type { GameAction, GameState } from './game/types';
import { Icon } from './ui';

function ChapterEventAction({ game, eventId, onAction, compact = false }: {
  game: GameState;
  eventId: string;
  onAction: (action: GameAction) => void;
  compact?: boolean;
}) {
  const detailId = useId();
  const event = EVENTS.find(item => item.id === eventId);
  const place = LOCATIONS.find(item => item.id === event?.location);
  if (!event || !place) return <p className="chapter-action-note">暂时没有可追查的消息，先到各处调查。</p>;

  const atLocation = game.location === event.location;
  const destinationState = atLocation ? game : { ...game, location: event.location };
  const available = getAvailableEvents(destinationState).some(item => item.id === event.id);
  const action: GameAction = atLocation
    ? { type: 'EXPLORE', eventId: event.id }
    : { type: 'TRAVEL', location: event.location };
  const error = getActionError(game, action);

  if (!available) {
    const note = game.combat ? '先完成眼前的战斗，再继续这件事。'
      : game.activeEvent ? '先为当前事件作出选择，再继续这件事。'
        : event.dayMin !== undefined && game.day < event.dayMin ? `第 ${event.dayMin} 日起，可前往${place.name}留意这条消息。`
          : event.dayMax !== undefined && game.day > event.dayMax ? '这条消息的期限已经过去。'
            : game.seenEvents.includes(event.id) && !event.repeatable ? '这段事件已经写入手记。'
              : '这条消息尚未出现，先继续调查各地的线索。';
    return <p className="chapter-action-note"><Icon name="book" size={15} /><span>{note}</span></p>;
  }

  const eventCost = event.actionCost ?? 1;
  const cost = atLocation
    ? eventCost === 0 ? '剧情对话不消耗行动' : `调查消耗 ${eventCost} 次行动`
    : eventCost === 0 ? '移动免费 · 到达后对话也不消耗行动' : `移动免费 · 到达后调查消耗 ${eventCost} 次行动`;

  return <div className={`chapter-event-action${compact ? ' chapter-event-compact' : ''}`}>
    <span className="chapter-event-place"><Icon name="compass" size={14} />{place.name} · {event.title}</span>
    <button
      className={`button ${compact ? 'button-quiet' : 'button-primary'}`}
      type="button"
      disabled={Boolean(error)}
      aria-describedby={detailId}
      aria-label={atLocation ? `查看${event.title}` : `前往${place.name}，追查${event.title}`}
      onClick={() => {
        if (!getActionError(game, action)) onAction(action);
      }}
    >{atLocation ? '查看这段消息' : `前往${place.name}`}<Icon name="arrow" size={16} /></button>
    <small id={detailId} className={error ? 'chapter-action-error' : ''}>{error ?? cost}</small>
  </div>;
}

export default function ChapterPanel({ game, onAction }: {
  game: GameState;
  onAction: (action: GameAction) => void;
}) {
  const headingId = useId();
  if (isFangYuan(game)) return null;
  const progress = getChapterProgress(game);
  if (!progress || game.ending) return null;

  const preparations = progress.milestones.filter(item => item.done).length;
  const pendingThreads = progress.looseEnds.filter(item => item.status === 'pending').length;
  const threadStatus = { pending: '待交代', settled: '已有交代', avoided: '仍有争议' } as const;

  return <section className="chapter-panel" aria-labelledby={headingId}>
    <div className="chapter-kicker"><span><Icon name="book" size={16} />第一章 · 青茅山</span><small>第 {progress.stage} 段 / 共 3 段</small></div>
    <ol className="chapter-beats" aria-label="本章主线进度">
      {progress.beats.map((beat, index) => <li
        key={beat.id}
        className={`chapter-beat${beat.done ? ' chapter-beat-done' : ''}${beat.current ? ' chapter-beat-current' : ''}`}
        aria-current={beat.current ? 'step' : undefined}
      >
        <span className="chapter-beat-marker" aria-hidden="true">{beat.done ? <Icon name="check" size={15} /> : String(index + 1).padStart(2, '0')}</span>
        <span className="chapter-beat-label">{beat.title}<small>{beat.done ? '已走过' : beat.current ? '正在经历' : '尚未开启'}</small></span>
      </li>)}
    </ol>
    <div className="chapter-current">
      <div className="chapter-current-copy"><h2 id={headingId}>{progress.stageTitle}</h2><p>{progress.stageDescription}</p></div>
      {progress.nextEventId
        ? <ChapterEventAction game={game} eventId={progress.nextEventId} onAction={onAction} />
        : <p className="chapter-action-note"><Icon name="compass" size={16} /><span>留意各地调查与行路建议，准备妥当后再决定最后去路。</span></p>}
    </div>
    <div className="chapter-details-group">
      <details className="chapter-details">
        <summary><span><Icon name="bag" size={16} />可选行前准备</span><span className="chapter-summary-meta">{preparations} / {progress.milestones.length}<Icon name="arrow" size={15} /></span></summary>
        <div className="chapter-details-body">
          <p className="chapter-details-note">按你的去路选择准备；这些成长经历不是和平路线的通关条件。</p>
          <ul className="chapter-milestones">
            {progress.milestones.map(item => <li key={item.id} className={item.done ? 'chapter-milestone-done' : ''}>
              <Icon name={item.done ? 'check' : 'leaf'} size={17} />
              <div><strong>{item.label}<span>{item.done ? '已经历' : '可准备'}</span></strong><p>{item.detail}</p></div>
            </li>)}
          </ul>
        </div>
      </details>
      {progress.looseEnds.length > 0 && <details className="chapter-details">
        <summary><span><Icon name="flag" size={16} />承诺与旧账</span><span className="chapter-summary-meta">{pendingThreads > 0 ? `${pendingThreads} 件待交代` : '查看过往'}<Icon name="arrow" size={15} /></span></summary>
        <div className="chapter-details-body">
          <ul className="chapter-loose-ends">
            {progress.looseEnds.map(thread => <li key={thread.id} className={`chapter-loose-end chapter-thread-${thread.status}`}>
              <div className="chapter-thread-heading"><h3>{thread.title}</h3><span>{threadStatus[thread.status]}</span></div>
              <p>{thread.description}</p>
              {thread.status === 'pending' && thread.eventId && <ChapterEventAction game={game} eventId={thread.eventId} onAction={onAction} compact />}
            </li>)}
          </ul>
        </div>
      </details>}
    </div>
  </section>;
}
