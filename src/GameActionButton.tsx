import type { ReactNode } from 'react';
import { getActionError } from './game/engine';
import type { GameAction, GameState } from './game/types';
import { Icon } from './ui';
import type { IconName } from './ui';

export default function ActionButton({ game, action, onAction, children, primary = false, icon, detail }: {
  game: GameState;
  action: GameAction;
  onAction: (action: GameAction) => void;
  children: ReactNode;
  primary?: boolean;
  icon?: IconName;
  detail?: string;
}) {
  const error = getActionError(game, action);
  return <div className="action-wrap"><button className={`button${primary ? ' button-primary' : ''}`} onClick={() => onAction(action)} disabled={Boolean(error)} title={error ?? detail}>{icon && <Icon name={icon} />}<span>{children}</span></button><small className={error ? 'action-reason' : 'action-detail'}>{error ?? detail}</small></div>;
}
