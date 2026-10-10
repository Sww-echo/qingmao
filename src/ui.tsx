import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { GU, NPCS } from './game/content';
import type { Effects, GuRole, ResourceKey } from './game/types';

export type IconName = 'mountain' | 'compass' | 'bag' | 'flame' | 'store' | 'book' | 'sun' | 'moon' | 'leaf' | 'gem' | 'heart' | 'spark' | 'shield' | 'sword' | 'arrow' | 'close' | 'check' | 'download' | 'upload' | 'help' | 'flag' | 'eye' | 'people' | 'home' | 'wine' | 'ore';

const paths: Record<IconName, ReactNode> = {
  mountain: <><path d="m2 20 7-15 5 10 3-6 5 11Z" /><path d="m6 11 3 2 3-2" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2 6-6 2 2-6Z" /></>,
  bag: <><path d="m5 8-2 12h18L19 8Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  flame: <path d="M12 3c1 5-3 5-2 9 2 0 4-2 5-4 3 4 5 6 3 10-2 5-11 5-13 0-2-5 1-8 4-10-1 4 0 4 1 4-1-5 2-5 2-9Z" />,
  store: <><path d="M3 10h18l-2-6H5Z" /><path d="M4 10v10h16V10M9 20v-6h6v6" /></>,
  book: <><path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3ZM12 6v16" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
  leaf: <><path d="M20 3C7 2 2 8 5 15s14 7 15-12Z" /><path d="m3 21 12-12" /></>,
  gem: <><path d="m7 3 10 0 5 7-10 12L2 10Z" /><path d="M2 10h20M7 3l5 19 5-19" /></>,
  heart: <path d="M20 5c-3-3-6-1-8 2-2-3-5-5-8-2-5 6 3 12 8 16 5-4 13-10 8-16Z" />,
  spark: <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" />,
  shield: <path d="m12 2 8 4v6c0 5-5 8-8 10-3-2-8-5-8-10V6Z" />,
  sword: <><path d="m4 20 4-4m-3-4 7 7M8 14 19 3l2 2-11 11M16 4l4 4" /></>,
  arrow: <path d="M3 12h17m-6-6 6 6-6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m4 12 5 5L20 6" />,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3h.01" /></>,
  flag: <><path d="M5 22V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  people: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 4 5v2" /></>,
  home: <><path d="m2 11 10-8 10 8M5 9v12h14V9M9 21v-7h6v7" /></>,
  wine: <><path d="M9 2h6v5l3 5v9H6v-9l3-5ZM6 13h12M9 5h6" /></>,
  ore: <><path d="m8 3 9 2 5 10-9 7L2 15Z" /><path d="m8 3 4 10 10 2M12 13l1 9L2 15" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export const RESOURCE_NAMES: Record<ResourceKey, string> = { stones: '元石', herbs: '药草', ore: '矿料', wine: '清酒' };
export const ROLE_NAMES: Record<GuRole, string> = { attack: '攻伐', defense: '护身', support: '辅助', scouting: '侦察', economy: '经营', movement: '身法' };
export const ROLE_ICONS: Record<GuRole, IconName> = { attack: 'sword', defense: 'shield', support: 'spark', scouting: 'eye', economy: 'bag', movement: 'compass' };

export function effectLabels(effects: Effects): { text: string; negative: boolean }[] {
  const result: { text: string; negative: boolean }[] = [];
  for (const [key, value] of Object.entries(effects.resources ?? {})) {
    if (value) result.push({ text: `${RESOURCE_NAMES[key as ResourceKey]} ${value > 0 ? '+' : ''}${value}`, negative: value < 0 });
  }
  const names = { hp: '生命', qi: '真元', cultivation: '修为', clues: '情报', trust: '信任', suspicion: '疑心' };
  for (const [key, label] of Object.entries(names)) {
    const value = effects[key as keyof typeof names];
    if (value) result.push({ text: `${label} ${value > 0 ? '+' : ''}${value}`, negative: key === 'suspicion' ? value > 0 : value < 0 });
  }
  for (const [id, count] of Object.entries(effects.gu ?? {})) {
    result.push({ text: `${GU.find(gu => gu.id === id)?.name ?? id} ${count > 0 ? '+' : ''}${count}`, negative: count < 0 });
  }
  for (const [id, value] of Object.entries(effects.relations ?? {})) {
    if (value) result.push({ text: `${NPCS.find(npc => npc.id === id)?.name ?? '人物'}关系 ${value > 0 ? '+' : ''}${value}`, negative: value < 0 });
  }
  return result;
}

export function EffectList({ effects, compact = false }: { effects: Effects; compact?: boolean }) {
  return <div className={`effect-list${compact ? ' compact' : ''}`}>{effectLabels(effects).map(({ text, negative }) => <span className={negative ? 'effect cost' : 'effect gain'} key={text}>{text}</span>)}</div>;
}

export function Meter({ label, value, max, kind = 'jade', icon }: { label: string; value: number; max: number; kind?: string; icon?: IconName }) {
  return <div className={`meter meter-${kind}`}><div className="meter-label"><span>{icon && <Icon name={icon} size={14} />}{label}</span><b>{value}<small> / {max}</small></b></div><div className="meter-track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><i style={{ width: `${Math.min(100, Math.max(0, value / max * 100))}%` }} /></div></div>;
}

export function Modal({ title, children, onClose, wide = false, label }: { title: string; children: ReactNode; onClose?: () => void; wide?: boolean; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) closeRef.current();
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0]; const last = items.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop"><div ref={ref} className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={id}><div className="modal-heading"><div>{label && <span className="eyebrow">{label}</span>}<h2 id={id}>{title}</h2></div>{onClose && <button className="icon-button" aria-label="关闭窗口" onClick={onClose}><Icon name="close" /></button>}</div>{children}</div></div>;
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{children}</div>;
}
