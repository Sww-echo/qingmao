import { ENEMIES, GU } from './game/content';
import { getActionError, getCombatForecast, getEffectiveStats } from './game/engine';
import type { GameAction, GameState } from './game/types';
import ActionButton from './GameActionButton';
import GuArtwork from './GuArtwork';
import { Icon, Meter, SectionHeading } from './ui';

function EnemyPortrait({ enemyId }: { enemyId: string }) {
  const beast = enemyId.includes('wolf') || enemyId.includes('boar');
  return <svg className={`enemy-portrait ${beast ? 'portrait-beast' : 'portrait-warrior'}`} viewBox="0 0 240 200" aria-hidden="true">
    <ellipse cx="120" cy="178" rx="84" ry="11" fill="#071713" opacity=".55" />
    <circle cx="120" cy="91" r="76" fill="none" stroke="#cabb82" strokeOpacity=".15" />
    <circle cx="120" cy="91" r="67" fill="none" stroke="#cabb82" strokeOpacity=".08" strokeDasharray="2 8" />
    {beast ? <g stroke="#8eaa87" strokeWidth="2" strokeLinejoin="round">
      <path d="m49 121 24-38 52-12 30 26 35 9 12 19-37 13-10 37h-17l2-37-41 5-12 32H72l2-42-27 16-12-8 23-19" fill="#4a5b44" />
      <path d={enemyId.includes('wolf') ? 'm149 99 10-30 9 27 16-15 3 27' : 'm149 99 9-17 13 21 15-8 2 13'} fill="#344738" />
      <path d="m72 102 29 18 40-12-25 28-43-2" fill="#344738" stroke="none" />
      <path d="m195 121-8 7-16-4" fill="none" />
      <path d={enemyId.includes('boar') ? 'm189 130 14-12-1 16-15 4' : 'm189 130 5-5-1 10'} fill="#d4c596" stroke="#d4c596" />
      <path d="m170 112 9 2" stroke="#ecd6a0" strokeWidth="3" />
    </g> : <g stroke="#a49a67" strokeWidth="2" strokeLinejoin="round">
      <path d="m83 93-26 16-15 41 12 9 27-37 14-8m65-21 25 16 15 41-12 9-27-37-14-8" fill="#596047" />
      <path d="m91 134-10 43h26l12-38 11 38h27l-11-43" fill="#354d3e" />
      <path d="m89 87 31-10 31 10 7 51-38 17-37-17Z" fill="#5a6347" />
      <path d="m99 90 21 48 22-48m-53 36h64" fill="none" strokeOpacity=".45" />
      <path d="m99 43 21-8 22 8 4 25-12 18h-27L95 68Z" fill="#7e7a53" />
      <path d="m103 60 11 2m13 0 11-2" stroke="#ead094" strokeWidth="4" />
      <path d="M120 43v12m-9 18h18" fill="none" />
      <circle cx="120" cy="111" r="11" fill="#d7bb79" stroke="#ebd297" />
      <circle cx="120" cy="111" r="4" fill="#304a3a" stroke="none" />
      <circle cx="75" cy="112" r="7" fill="#364b3b" /><circle cx="168" cy="112" r="7" fill="#364b3b" />
      {enemyId !== 'guardian' && <path d="m47 124 2-62 8-13 6 13-6 62" fill="#b8bca0" stroke="#d0cba1" />}
    </g>}
  </svg>;
}

export default function CombatPanel({ game, onAction }: { game: GameState; onAction: (action: GameAction) => void }) {
  const combat = game.combat!;
  const enemy = ENEMIES.find(item => item.id === combat.enemyId)!;
  const forecast = getCombatForecast(game)!;
  const move = forecast.intent;
  const stats = getEffectiveStats(game);
  const carried = game.equipped.map(id => GU.find(item => item.id === id)!);
  const active = carried.filter(gu => !gu.passive);
  const passive = carried.filter(gu => gu.passive);

  return <section className="combat-panel panel">
    <SectionHeading eyebrow="狭路相逢" title={enemy.name}><span className="combat-round">第 {combat.turn + 1} 回合</span></SectionHeading>
    <div className="combat-scene"><div className="combat-haze" /><div className="combat-enemy"><EnemyPortrait enemyId={enemy.id} /><p>{enemy.subtitle}</p></div><div className={`enemy-intent intent-${move.type}`}><Icon name={move.type === 'attack' ? 'sword' : move.type === 'guard' ? 'shield' : 'spark'} size={22} /><span>敌方下一招<strong>{move.label} · {move.type === 'attack' ? `${move.power} 伤害` : move.type === 'guard' ? `${move.power} 护势` : `扰动 ${move.power} 真元`}</strong></span></div></div>

    <div className={`combat-forecast${forecast.danger ? ' is-danger' : ''}`} aria-label="下一招预判">
      <Icon name={forecast.danger ? 'heart' : 'eye'} size={18} />
      <div>{move.type === 'attack' ? <><strong>{forecast.danger ? '这一击可能致命' : '先看清这一击的代价'}</strong><p>按当前护势会损失 <b>{forecast.incomingDamage}</b> 生命；本次防御后预计损失 <b>{forecast.defendingDamage}</b>。</p><small>若先击倒对手，它不会再出招；护身和治疗蛊也会改变结果。</small></> : move.type === 'guard' ? <><strong>对手正在准备护势</strong><p>这回合不会攻击，是补给和恢复真元的时机。下一次受击最多减伤 {move.power}，但至少仍会受到 1 点伤害。</p></> : <><strong>这次会扰动真元</strong><p>按当前真元会流失 {forecast.qiLoss} 点。实际流失以你本次出手后的剩余真元计算，不损失生命。</p></>}</div>
    </div>

    <div className="battle-meters"><Meter label="对手生命" value={combat.enemyHp} max={enemy.hp} kind="life" /><div className="guard-counts"><span>敌方护势 <b>{combat.enemyGuard}</b></span><span>你的临时防护 <b>{combat.playerGuard}</b></span><span>常驻减伤 <b>{forecast.passiveGuard}</b></span></div><div className="battle-player-meters"><Meter label="你的生命" value={game.hp} max={game.maxHp} kind="life" /><Meter label="你的真元" value={game.qi} max={game.maxQi} /></div></div>

    <div className="battle-hand"><span className="eyebrow">催动一蛊，对手随后行动</span><div className="battle-gu-grid">{active.map(gu => {
      const action: GameAction = { type: 'COMBAT', move: 'gu', guId: gu.id };
      const error = getActionError(game, action);
      return <button key={gu.id} className="battle-gu" onClick={() => onAction(action)} disabled={Boolean(error)} title={error ?? gu.description}><GuArtwork guId={gu.id} className="battle-gu-art" /><strong>{gu.name}</strong><span>{game.hungry.includes(gu.id) ? '休眠中' : `${gu.qiCost} 真元`}</span><small>{error ?? gu.description}</small></button>;
    })}</div>{!active.length && <p className="muted">没有携带可主动催动的蛊，仍可以普通攻击、防御和使用补给。</p>}</div>
    {passive.length > 0 && <div className="passive-support" aria-label="常驻蛊虫效果">{passive.map(gu => <span key={gu.id} className={game.hungry.includes(gu.id) ? 'is-asleep' : ''}><Icon name={game.hungry.includes(gu.id) ? 'moon' : 'check'} size={13} /><strong>{gu.name}</strong><small>{game.hungry.includes(gu.id) ? '休眠中，效果暂停' : gu.description}</small></span>)}</div>}

    <div className="basic-moves"><ActionButton game={game} action={{ type: 'COMBAT', move: 'attack' }} onAction={onAction} icon="sword" detail={`${stats.attack} 基础伤害 · 回复 1 真元`}>普通攻击</ActionButton><ActionButton game={game} action={{ type: 'COMBAT', move: 'defend' }} onAction={onAction} icon="shield" detail="获得 4 临时防护 · 回复 2 真元">防御回气</ActionButton><ActionButton game={game} action={{ type: 'COMBAT', move: 'retreat' }} onAction={onAction} icon="compass" detail={`${forecast.retreatChance}% 成功 · 失败承受下一招`}>尝试撤退</ActionButton></div>
    <div className="combat-supplies"><div><span><Icon name="bag" size={15} />随身补给</span><small>占一次出手，对手随后行动</small></div><div className="supply-actions"><ActionButton game={game} action={{ type: 'COMBAT', move: 'herbs' }} onAction={onAction} icon="leaf" detail={`2 药草 → 最多恢复 8 生命 · 持有 ${game.resources.herbs}`}>药草止血</ActionButton><ActionButton game={game} action={{ type: 'COMBAT', move: 'wine' }} onAction={onAction} icon="wine" detail={`1 清酒 → 最多恢复 5 真元 · 持有 ${game.resources.wine}`}>饮酒回气</ActionButton></div></div>
    <div className="battle-log" role="log" aria-live="polite">{combat.log.slice(-5).map((text, index) => <p key={`${index}-${text}`}>{text}</p>)}</div>
  </section>;
}
