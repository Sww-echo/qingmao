import type { Effects, GameAction, GameState, ResourceKey } from './game/types';
import { EffectList, effectLabels } from './ui';

export interface ActionFeedbackData {
  id: number;
  label: string;
  effects: Effects;
}

const LABELS: Partial<Record<GameAction['type'], string>> = {
  EXPLORE: '开始探查', CHOOSE: '选择已记下', ACTIVITY: '劳作所得', TRAIN: '修炼所得',
  REST: '调息恢复', END_DAY: '日暮结算', BREAKTHROUGH: '境界突破', CRAFT: '合炼结果',
  FEED: '供养结算', BUY: '交易完成', EQUIP: '已调整随身蛊', UNEQUIP: '已调整随身蛊',
};

export function feedbackFor(before: GameState, after: GameState, action: GameAction, id: number): ActionFeedbackData | null {
  if (action.type === 'TRAVEL' || action.type === 'COMBAT' || after.combat || after.ending) return null;
  const effects: Effects = {};
  const keys: ResourceKey[] = ['stones', 'herbs', 'ore', 'wine'];
  effects.resources = Object.fromEntries(keys.filter(key => before.resources[key] !== after.resources[key]).map(key => [key, after.resources[key] - before.resources[key]]));
  for (const key of ['hp', 'qi', 'cultivation', 'clues', 'trust', 'suspicion'] as const) {
    if (before[key] !== after[key]) effects[key] = after[key] - before[key];
  }
  const guIds = new Set([...Object.keys(before.inventory), ...Object.keys(after.inventory)]);
  effects.gu = Object.fromEntries([...guIds].filter(key => (after.inventory[key] ?? 0) !== (before.inventory[key] ?? 0)).map(key => [key, (after.inventory[key] ?? 0) - (before.inventory[key] ?? 0)]));
  const npcIds = new Set([...Object.keys(before.relations), ...Object.keys(after.relations)]);
  effects.relations = Object.fromEntries([...npcIds].filter(key => (after.relations[key] ?? 0) !== (before.relations[key] ?? 0)).map(key => [key, (after.relations[key] ?? 0) - (before.relations[key] ?? 0)]));
  return { id, label: LABELS[action.type] ?? '已记入手札', effects };
}

export default function ActionFeedback({ feedback }: { feedback: ActionFeedbackData | null }) {
  return <div className="action-receipt" role="status" aria-live="polite" aria-atomic="true">
    {feedback ? <div className="receipt-content" key={feedback.id}><span>{feedback.label}</span>{effectLabels(feedback.effects).length ? <EffectList effects={feedback.effects} compact /> : <span className="muted">进度已记入行旅手记</span>}</div> : <span>行程随操作自动保存 · 每一步的得失会显示在这里</span>}
  </div>;
}
