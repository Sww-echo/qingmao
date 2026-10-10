import { getActionError } from './game/engine';
import { getJourneyAdvice } from './game/guidance';
import type { JourneyFocus } from './game/guidance';
import type { GameAction, GameState } from './game/types';
import { Icon } from './ui';

const FOCUS_OPTIONS: { id: JourneyFocus; label: string }[] = [
  { id: 'open', label: '自由探索' },
  { id: 'inheritance', label: '争取传承' },
  { id: 'clan', label: '宗族立足' },
  { id: 'departure', label: '随队离山' },
];

export default function JourneyGuide({ game, focus, onFocus, showSteps, onHideSteps, onAction, onPane }: {
  game: GameState;
  focus: JourneyFocus;
  onFocus: (focus: JourneyFocus) => void;
  showSteps: boolean;
  onHideSteps: () => void;
  onAction: (action: GameAction) => void;
  onPane: (pane: 'gu' | 'forge' | 'market') => void;
}) {
  const advice = getJourneyAdvice(game, focus);
  if (!advice) return null;
  const { destination } = advice;
  const error = destination.kind === 'action' ? getActionError(game, destination.action) : null;
  const cost = destination.kind === 'pane' ? '整理不消耗行动'
    : destination.action.type === 'TRAVEL' ? '移动不消耗行动'
      : destination.action.type === 'FEED' ? '补喂不消耗行动'
        : destination.action.type === 'END_DAY' ? '先预览，再确认'
          : '消耗 1 次行动';
  const steps = [
    { label: '探查一处地点', done: game.seenEvents.length > 0 },
    { label: '核实第一份情报', done: game.clues > 0 },
    { label: '结清供养，迎接明日', done: game.day > 1 },
  ];

  return <section className={`journey-guide guide-${advice.kind}`} aria-label="行路建议">
    <div className="guide-topline"><span><Icon name="compass" size={17} />行路建议</span><small>只作参考，去路由你</small></div>
    <div className="route-focus" role="group" aria-label="关注的路线">{FOCUS_OPTIONS.map(option => <button key={option.id} type="button" aria-pressed={focus === option.id} onClick={() => onFocus(option.id)}>{option.label}</button>)}</div>
    <div className="guide-advice"><div><h2>{advice.title}</h2><p>{advice.description}</p></div><div className="guide-cta"><button className="button button-primary" type="button" disabled={Boolean(error)} title={error ?? undefined} onClick={() => destination.kind === 'action' ? onAction(destination.action) : onPane(destination.pane)}>{destination.label}<Icon name="arrow" size={15} /></button><small>{error ?? cost}</small></div></div>
    {game.day <= 2 && showSteps && <div className="first-steps"><div><span>初行三步</span><button type="button" className="text-button" onClick={onHideSteps} aria-label="收起初行提示">收起<Icon name="close" size={12} /></button></div><ol>{steps.map(step => <li key={step.label} className={step.done ? 'is-done' : ''}><Icon name={step.done ? 'check' : 'compass'} size={13} />{step.label}</li>)}</ol></div>}
  </section>;
}
