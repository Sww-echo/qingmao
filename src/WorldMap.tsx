import { useId } from 'react';
import { getCampaignLocations, getLocationError, isFangYuan } from './game/campaign';
import type { GameState, LocationId } from './game/types';
import { Icon } from './ui';

const MAP_CONNECTIONS: [LocationId, LocationId][] = [
  ['academy', 'clan'],
  ['clan', 'market'],
  ['market', 'stream'],
  ['stream', 'bamboo'],
  ['bamboo', 'cave'],
  ['academy', 'cave'],
];

export function Landscape({ title = false }: { title?: boolean }) {
  return <svg className={`landscape${title ? ' landscape-title' : ''}`} viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id={title ? 'sky-title' : 'sky-map'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#102524" /><stop offset="1" stopColor="#244039" /></linearGradient>
      <linearGradient id={title ? 'mist-title' : 'mist-map'} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#709388" stopOpacity="0" /><stop offset=".5" stopColor="#83a497" stopOpacity=".11" /><stop offset="1" stopColor="#709388" stopOpacity="0" /></linearGradient>
      <radialGradient id={title ? 'glow-title' : 'glow-map'}><stop stopColor="#dacb9d" stopOpacity=".2" /><stop offset="1" stopColor="#dacb9d" stopOpacity="0" /></radialGradient>
    </defs>
    <rect width="1000" height="620" fill={`url(#${title ? 'sky-title' : 'sky-map'})`} />
    <circle cx="780" cy="115" r="150" fill={`url(#${title ? 'glow-title' : 'glow-map'})`} /><circle cx="780" cy="115" r="28" fill="#ded1a9" opacity=".75" />
    <path d="M-50 410 60 226l80 93 132-222 62 151 72-64 106 130L631 143l48 141 120-87 148 183 100-103v400H-50Z" fill="#43655b" opacity=".34" />
    <path d="M-80 520 66 340 149 381 263 184 320 340 417 243 505 430 595 300 672 337 790 200 865 371 953 303l99 140v200H-80Z" fill="#345249" />
    <path d="m190 520 77-281 43 123 45 27 58-93 48 91 45 43-103 87Z" fill="#688575" opacity=".15" />
    <path d="M-40 560 85 398 196 514 335 386 438 521 520 449 619 524 731 352 819 458 922 389l132 164v140H-40Z" fill="#1c3730" />
    <path d="M620 348c-160 48 55 87-22 116-176 67-169 92-360 162" fill="none" stroke="#9fb7a0" opacity=".22" strokeWidth="15" />
    <path d="M620 348c-160 48 55 87-22 116-176 67-169 92-360 162" fill="none" stroke="#b1c6ad" opacity=".35" strokeWidth="2" />
    <rect y="290" width="1000" height="240" fill={`url(#${title ? 'mist-title' : 'mist-map'})`} />
    <path d="M0 540c190-34 291 58 456 20s321-55 544-13v100H0Z" fill="#0d241f" opacity=".8" />
    <g stroke="#789481" strokeWidth="2" opacity=".16"><path d="M61 620V420m-4 40-21-18m27 3 21-30m-23 85-26-22m27-1 31-22M927 620V456m0 35-26-20m27 4 18-20m-17 81 33-24m-32 13-30-18" /></g>
    <g stroke="#d2cbaa" strokeWidth="1.5" opacity=".45" fill="none"><path d="m429 149 6 3 7-4m14 8 5 2 6-4m-39 12 5 2 7-3" /></g>
  </svg>;
}

type WorldMapProps = {
  game: GameState;
  location: LocationId;
  onTravel: (id: LocationId) => void;
  locked: boolean;
  eventCounts?: Partial<Record<LocationId, number>>;
  recommended?: LocationId;
};

export default function WorldMap({ game, location, onTravel, locked, eventCounts, recommended }: WorldMapProps) {
  const mapId = useId();
  const places = getCampaignLocations(game);
  const mapRoutes = MAP_CONNECTIONS.flatMap(([fromId, toId]) => {
    const from = places.find(place => place.id === fromId);
    const to = places.find(place => place.id === toId);
    return from && to ? [{ fromId, toId, path: `M${from.x} ${from.y} Q${(from.x + to.x) / 2} ${from.y} ${to.x} ${to.y}` }] : [];
  });
  return <div className="world-map" role="group" aria-label="青茅山六处地点">
    <Landscape />
    <div className="map-caption"><span>南疆 · 青茅山</span><small>{isFangYuan(game) ? '旧事重临，暗流仍在' : '山雨将至，机缘不候'}</small></div>
    <div className="map-compass"><span>北</span><Icon name="compass" size={26} /></div>
    <div className="map-canvas">
      <svg className="map-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{mapRoutes.map(route => <path key={`${route.fromId}-${route.toId}`} d={route.path} className={route.fromId === location || route.toId === location ? 'is-current-path' : undefined} />)}</svg>
      {places.map(place => {
        const selected = location === place.id;
        const suggested = recommended === place.id;
        const count = Math.max(0, Math.floor(eventCounts?.[place.id] ?? 0));
        const descriptionId = `${mapId}-${place.id}`;
        const locationError = getLocationError(game, place.id);
        return <button key={place.id} type="button" className={`map-location${selected ? ' selected' : ''}${suggested && !locationError ? ' recommended' : ''}${locationError ? ' is-locked' : ''} ${place.danger}`} style={{ left: `${place.x}%`, top: `${place.y}%` }} onClick={() => onTravel(place.id)} disabled={locked || Boolean(locationError)} title={locationError ?? undefined} aria-pressed={selected} aria-label={`前往${place.name}`} aria-describedby={descriptionId}>
          {(selected || (suggested && !locationError)) && <span className="map-marker-tag" aria-hidden="true">{suggested && !locationError ? '推荐' : '当前'}</span>}
          <span className="map-pin-cluster"><span className="map-pin"><Icon name={place.id === 'cave' ? 'mountain' : place.id === 'market' ? 'store' : place.id === 'clan' ? 'flag' : place.id === 'bamboo' ? 'leaf' : place.id === 'stream' ? 'spark' : 'home'} size={18} /></span>{count > 0 && <span className="map-event-count" aria-hidden="true">{count}</span>}</span>
          <span className="map-label">{place.name}</span>
          {locationError && <span className="fang-map-locked" aria-hidden="true">未开放</span>}
          <span id={descriptionId} className="sr-only">{selected ? '当前所在地。' : ''}{suggested && !locationError ? '推荐探查地点。' : ''}{eventCounts ? `${count} 个可探查事件。` : ''}{locked ? '请先完成当前事件或战斗。' : locationError ?? '移动不消耗行动。'}</span>
        </button>;
      })}
    </div>
    <div className="map-footnote"><span>点选地点 · 移动不消耗行动</span>{eventCounts && <span className="map-legend"><i />数字为可探事件</span>}</div>
  </div>;
}
