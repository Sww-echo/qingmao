import { useState } from 'react';
import { GU, NPCS, RECIPES, SHOP } from './game/content';
import { getActionError, getUpkeep } from './game/engine';
import type { GameAction, GameState, GuRole, ResourceKey } from './game/types';
import GuArtwork from './GuArtwork';
import { EffectList, Icon, Meter, RESOURCE_NAMES, ROLE_ICONS, ROLE_NAMES, SectionHeading } from './ui';
import type { IconName } from './ui';

type PanelProps = { game: GameState; onAction: (action: GameAction) => void };
type ReadPanelProps = Pick<PanelProps, 'game'> & Partial<Pick<PanelProps, 'onAction'>>;

const RESOURCE_KEYS: ResourceKey[] = ['stones', 'herbs', 'ore', 'wine'];
const RESOURCE_ICONS: Record<ResourceKey, IconName> = {
  stones: 'gem', herbs: 'leaf', ore: 'ore', wine: 'wine',
};
const GU_ROLES = Object.keys(ROLE_NAMES) as GuRole[];

function IngredientCount({ name, current, needed }: { name: string; current: number; needed: number }) {
  const shortage = Math.max(0, needed - current);
  return <span className="ingredient-count"><span className="sr-only">{name}，现有 {current}，需要 {needed}。</span><strong aria-hidden="true">{current}<small> / {needed}</small></strong>{shortage > 0 ? <small className="ingredient-shortage">缺 {shortage}</small> : <span className="ingredient-ready"><Icon name="check" size={14} /><span className="sr-only">材料齐备</span></span>}</span>;
}

export function GuPanel({ game, onAction }: PanelProps) {
  const [filter, setFilter] = useState<'owned' | 'all'>('owned');
  const [role, setRole] = useState<GuRole | 'all'>('all');
  const ownedKinds = GU.filter((gu) => (game.inventory[gu.id] ?? 0) > 0).length;
  const collection = GU.filter(gu => (filter === 'all' || (game.inventory[gu.id] ?? 0) > 0) && (role === 'all' || gu.role === role));
  const sleeping = GU.filter((gu) => game.hungry.includes(gu.id) && (game.inventory[gu.id] ?? 0) > 0);
  const feedCost = sleeping.reduce((total, gu) => total + gu.upkeep, 0);
  const feedAction: GameAction = { type: 'FEED' };
  const feedError = getActionError(game, feedAction);

  return <section className="panel gu-panel" aria-label="蛊囊与装备">
    <SectionHeading eyebrow="炼 · 养 · 用" title="你的蛊囊">
      <span className="muted">已拥有 {ownedKinds} / {GU.length} 种</span>
    </SectionHeading>
    <div className="panel-head gu-toolbar">
      <div className="filter-group" role="group" aria-label="蛊虫筛选">
        <button type="button" className={`button button-small ${filter === 'owned' ? 'button-primary' : 'button-quiet'}`} aria-pressed={filter === 'owned'} onClick={() => setFilter('owned')}>已拥有</button>
        <button type="button" className={`button button-small ${filter === 'all' ? 'button-primary' : 'button-quiet'}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>全部蛊谱</button>
      </div>
      <label className="catalog-select"><span>职能</span><select value={role} onChange={event => setRole(event.target.value as GuRole | 'all')} aria-label="按蛊虫职能筛选"><option value="all">全部职能</option>{GU_ROLES.map(item => <option value={item} key={item}>{ROLE_NAMES[item]}</option>)}</select></label>
    </div>
    <div className="gu-summary"><span><Icon name="bag" size={16} />携带 {game.equipped.length} / 4</span><span><Icon name="gem" size={16} />今日供养 {getUpkeep(game)} 元石</span><span className="catalog-result" role="status">显示 {collection.length} 种</span></div>
    <p className="muted panel-note">同时最多携带四种蛊。本日携带过的蛊都计入供养，卸下不会退回当天的费用；未携带的收藏不额外计费。</p>
    {sleeping.length > 0 && <div className="gu-feeding">
      <div><strong>{sleeping.length} 种蛊正在休眠</strong><p className="muted">补喂需要 {feedCost} 元石，醒来后才能发挥能力。</p></div>
      <button type="button" className="button button-primary button-small" disabled={Boolean(feedError)} title={feedError ?? undefined} aria-describedby={feedError ? 'gu-feed-error' : undefined} onClick={() => onAction(feedAction)}><Icon name="leaf" size={15} />补喂全部</button>
      {feedError && <p id="gu-feed-error" className="action-reason">{feedError}</p>}
    </div>}
    {collection.length === 0 ? <div className="empty-state"><Icon name="bag" size={28} /><p>{role === 'all' ? '蛊囊暂时是空的。市集可以购入蛊虫，探索也能换来新的机缘。' : `当前筛选中没有${ROLE_NAMES[role]}蛊。可以换个职能，或在全部蛊谱中寻找。`}</p><button type="button" className="button button-quiet button-small" onClick={() => { setFilter('all'); setRole('all'); }}>查看全部蛊谱</button></div> : <div className="gu-grid">
      {collection.map((gu) => {
        const count = game.inventory[gu.id] ?? 0;
        const equipped = game.equipped.includes(gu.id);
        const hungry = game.hungry.includes(gu.id);
        const action: GameAction = equipped ? { type: 'UNEQUIP', guId: gu.id } : { type: 'EQUIP', guId: gu.id };
        const error = getActionError(game, action);
        const reasonId = `gu-reason-${gu.id}`;
        return <article key={gu.id} className={`gu-card${count > 0 ? ' is-owned' : ' is-unowned'}${equipped ? ' is-equipped' : ''}${hungry ? ' is-hungry' : ''}`} data-role={gu.role}>
          <div className="gu-card-heading">
            <span className="gu-glyph"><GuArtwork guId={gu.id} /></span>
            <div><h3>{gu.name}</h3><div className="gu-tags"><span>{gu.rank} 转</span><span><Icon name={ROLE_ICONS[gu.role]} size={13} />{ROLE_NAMES[gu.role]}</span><span>{gu.passive ? '携带生效' : '主动催动'}</span></div></div>
          </div>
          <p className="gu-description">{gu.description}</p>
          <details className="gu-lore"><summary>蛊谱记载</summary><p className="muted">{gu.lore}</p></details>
          <div className="gu-status"><span><Icon name="gem" size={15} />供养 {gu.upkeep} 元石 / 日</span><span>库存 {count} 只</span>{hungry && <span className="status-tag status-hungry">休眠</span>}{equipped && <span className="status-tag status-equipped">已携带</span>}</div>
          <div className="gu-card-footer">
            <button type="button" className={`button button-small ${equipped ? 'button-quiet' : 'button-primary'}`} disabled={Boolean(error)} title={error ?? undefined} aria-describedby={error ? reasonId : undefined} onClick={() => onAction(action)}>{equipped ? '卸下' : '装备'}{!equipped && <Icon name="arrow" size={14} />}</button>
            {error && <p id={reasonId} className="action-reason">{error}</p>}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}

export function ForgePanel({ game, onAction }: PanelProps) {
  const [safe, setSafe] = useState(false);

  return <section className="panel forge-panel" aria-label="合炼配方">
    <SectionHeading eyebrow="取舍材料 · 重组能力" title="合炼炉">
      <span className="muted">三道配方，三种去向</span>
    </SectionHeading>
    <div className="panel-head forge-toolbar">
      <div className="filter-group" role="group" aria-label="合炼方式">
        <button type="button" className={`button button-small ${!safe ? 'button-primary' : 'button-quiet'}`} aria-pressed={!safe} onClick={() => setSafe(false)}>普通合炼</button>
        <button type="button" className={`button button-small ${safe ? 'button-primary' : 'button-quiet'}`} aria-pressed={safe} onClick={() => setSafe(true)}>追加材料 · 稳炼</button>
      </div>
      <span className="muted">每次消耗 1 行动</span>
    </div>
    <p className="muted panel-note">普通合炼失败时，输入的蛊虫全部保留，但辅材与本次行动会消耗。稳炼支付额外辅材，确保成功；成功后，输入蛊合为一只新的蛊。材料数字为「现有 / 所需」。</p>
    <div className="recipe-list">
      {RECIPES.map((recipe) => {
        const result = GU.find((gu) => gu.id === recipe.result)!;
        const action: GameAction = { type: 'CRAFT', recipeId: recipe.id, safe };
        const error = getActionError(game, action);
        const reasonId = `recipe-reason-${recipe.id}`;
        const costs = RESOURCE_KEYS.map((key) => ({ key, amount: (recipe.resources[key] ?? 0) + (safe ? recipe.safeExtra[key] ?? 0 : 0) })).filter(({ amount }) => amount > 0);
        return <article className="recipe-card" key={recipe.id}>
          <div className="recipe-heading"><span className="gu-glyph"><GuArtwork guId={result.id} /></span><div><span className="eyebrow">{result.rank} 转 · {ROLE_NAMES[result.role]}</span><h3>{recipe.name}</h3><p className="muted">炼成 {result.name} × 1</p></div><span className={`recipe-chance${safe ? ' is-safe' : ''}`}>{safe ? 100 : Math.round(recipe.successRate * 100)}%<small>{safe ? '稳炼保证成功' : '普通合炼成功率'}</small></span></div>
          <p>{recipe.description}</p>
          <div className="recipe-materials">
            <div><div className="recipe-material-title"><h4>投入蛊虫</h4><span>现有 / 所需</span></div><ul className="recipe-ingredients">
              {Object.entries(recipe.gu).map(([id, needed]) => {
                const gu = GU.find((item) => item.id === id)!;
                const current = game.inventory[id] ?? 0;
                return <li key={id} className={current >= needed ? 'is-ready' : 'is-missing'}><span><Icon name={ROLE_ICONS[gu.role]} size={15} />{gu.name}</span><IngredientCount name={gu.name} current={current} needed={needed} /></li>;
              })}
            </ul></div>
            <div><div className="recipe-material-title"><h4>{safe ? '辅材 · 含稳炼追加' : '辅材'}</h4><span>现有 / 所需</span></div><ul className="recipe-ingredients">
              {costs.map(({ key, amount }) => <li key={key} className={game.resources[key] >= amount ? 'is-ready' : 'is-missing'}><span><Icon name={RESOURCE_ICONS[key]} size={15} />{RESOURCE_NAMES[key]}</span><IngredientCount name={RESOURCE_NAMES[key]} current={game.resources[key]} needed={amount} /></li>)}
            </ul></div>
          </div>
          {result.rank > game.rank && <p className="recipe-rank-note"><Icon name="flag" size={15} />可以先炼成收藏；突破二转后，才能装备这只蛊。</p>}
          <div className="recipe-footer"><button type="button" className="button button-primary" disabled={Boolean(error)} title={error ?? undefined} aria-describedby={error ? reasonId : undefined} onClick={() => onAction(action)}><Icon name="flame" size={16} />{safe ? '稳炼' : '合炼'}{result.name}</button>{error && <p id={reasonId} className="action-reason">{error}</p>}</div>
        </article>;
      })}
    </div>
  </section>;
}

export function ShopPanel({ game, onAction }: PanelProps) {
  const [filter, setFilter] = useState<'all' | 'affordable'>('all');
  const [role, setRole] = useState<GuRole | 'all' | 'materials'>('all');
  const inMarket = game.location === 'market';
  const travelAction: GameAction = { type: 'TRAVEL', location: 'market' };
  const travelError = getActionError(game, travelAction);
  const items = SHOP.filter(item => {
    const gu = GU.find(entry => entry.id === item.guId);
    const matchesRole = role === 'all' || (role === 'materials' ? !item.guId : gu?.role === role);
    const affordable = item.price <= game.resources.stones && item.stock > (game.purchases[item.id] ?? 0);
    return matchesRole && (filter === 'all' || affordable);
  });

  return <section className="panel shop-panel" aria-label="山寨市集商店">
    <SectionHeading eyebrow="货有定价 · 量有余缺" title="商队货架">
      <span className="shop-purse"><Icon name="gem" size={17} />{game.resources.stones} <small>元石</small></span>
    </SectionHeading>
    {!inMarket && <div className="shop-location-notice"><div><strong>你还没有到市集</strong><p className="muted">可以先看货。到山寨市集后才能购买，移动不消耗行动。</p></div><button type="button" className="button button-primary button-small" disabled={Boolean(travelError)} title={travelError ?? undefined} onClick={() => onAction(travelAction)}><Icon name="store" size={15} />前往市集</button>{travelError && <p className="action-reason">{travelError}</p>}</div>}
    <div className="panel-head shop-toolbar">
      <div className="filter-group" role="group" aria-label="货架筛选"><button type="button" className={`button button-small ${filter === 'all' ? 'button-primary' : 'button-quiet'}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>全部货物</button><button type="button" className={`button button-small ${filter === 'affordable' ? 'button-primary' : 'button-quiet'}`} aria-pressed={filter === 'affordable'} onClick={() => setFilter('affordable')}>买得起</button></div>
      <label className="catalog-select"><span>种类</span><select value={role} onChange={event => setRole(event.target.value as GuRole | 'all' | 'materials')} aria-label="按货物种类筛选"><option value="all">全部种类</option>{GU_ROLES.map(item => <option value={item} key={item}>{ROLE_NAMES[item]}蛊</option>)}<option value="materials">合炼辅材</option></select></label>
    </div>
    <p className="catalog-result shop-result" role="status">显示 {items.length} 件货物{filter === 'affordable' ? ' · 有余货且元石足够' : ''}</p>
    <p className="muted panel-note">货物数量按本次行程计算，不会隔日补货。购入的蛊会收入蛊囊，装备后才发挥能力。</p>
    {items.length === 0 ? <div className="empty-state"><Icon name="store" size={28} /><p>这个筛选下暂无货物。可以看看其他职能，或放宽预算筛选。</p><button type="button" className="button button-quiet button-small" onClick={() => { setFilter('all'); setRole('all'); }}>查看全部货物</button></div> : <div className="shop-grid">
      {items.map((item) => {
        const gu = item.guId ? GU.find((entry) => entry.id === item.guId) : undefined;
        const remaining = Math.max(0, item.stock - (game.purchases[item.id] ?? 0));
        const resourceKey = RESOURCE_KEYS.find((key) => (item.effects.resources?.[key] ?? 0) > 0);
        const action: GameAction = { type: 'BUY', itemId: item.id };
        const error = getActionError(game, action);
        const reasonId = `shop-reason-${item.id}`;
        const visibleError = error && (inMarket || remaining === 0) ? error : null;
        return <article className={`shop-card${remaining === 0 ? ' is-sold-out' : ''}`} key={item.id} data-role={gu?.role}>
          <div className="shop-card-heading"><span className="shop-glyph" aria-hidden="true">{gu ? <GuArtwork guId={gu.id} /> : <Icon name={resourceKey ? RESOURCE_ICONS[resourceKey] : 'bag'} size={30} />}</span><div><h3>{item.name}</h3><span className="muted">{remaining > 0 ? `余货 ${remaining}` : '已售罄'}{gu && ` · 已有 ${game.inventory[gu.id] ?? 0}`}</span></div><span className="shop-price"><Icon name="gem" size={15} />{item.price}<span className="sr-only">元石</span></span></div>
          <p>{item.description}</p>
          <EffectList effects={item.effects} compact />
          <div className="shop-card-footer"><button type="button" className="button button-quiet button-small" disabled={Boolean(error)} title={error ?? undefined} aria-describedby={visibleError ? reasonId : undefined} onClick={() => onAction(action)}>{remaining === 0 ? '已经售罄' : '购入'}{remaining > 0 && <Icon name="arrow" size={14} />}</button>{visibleError && <p id={reasonId} className="action-reason">{visibleError}</p>}</div>
        </article>;
      })}
    </div>}
  </section>;
}

function promiseNote(game: GameState, npcId: string): string {
  const promised = (flag: string) => game.flags.includes(flag);
  const seen = (event: string) => game.seenEvents.includes(event);
  if (npcId === 'mentor-qiu' && promised('mentor-promise')) return seen('academy-private-lesson') ? '你们已处理过灯下指点的约定。' : '他曾答应额外指点，可回学堂探查。';
  if (npcId === 'merchant-yan' && promised('merchant-pact')) return seen('market-commission') ? '先前合作的佣金机会已经结算。' : '他愿兑现先前合作的回报，可去市集找他。';
  if (npcId === 'healer-su' && promised('healer-pact')) return seen('stream-healer-return') ? '她曾为你带来一次治疗或消息的机会。' : '她记得你的援助，约你在听雨涧见面。';
  if (npcId === 'scout-lan' && promised('scout-pact')) return promised('report-filed') ? '你曾帮助她接通绳桥，她记得这份援助。' : '你帮她接通过绳桥，她愿为巡山报告作证。';
  if (npcId === 'steward-zheng' && promised('returned-pouch')) return seen('clan-bargain') ? '送还公物的记录，让你们有过一次更宽松的交涉。' : '他留着你归还公物的记录，交涉时可以用作担保。';
  if (npcId === 'fang-yuan' && promised('fang-boundary')) return seen('cave-boundary') ? '双方已在遗藏处确认过互不封堵退路的约定。' : '双方约定不封堵退路，可在遗藏处确认。';
  if (npcId === 'fang-yuan' && promised('fang-trade')) return '双方交换过一份经过核实的地图，各自保留其余消息。';
  return '尚未建立具体的互惠约定。';
}

const COMMISSIONS = [
  {
    id: 'rain-route', name: '雨路验路单', icon: 'compass' as IconName,
    accepted: 'rain-route-bonded', verified: 'rain-route-verified', settled: 'rain-route-settled', failed: 'rain-route-failed',
    taskEvent: 'stream-rain-survey', settlementEvent: 'market-rain-settlement',
    taskName: '验路', taskLocation: '听雨涧', taskStart: 2, taskEnd: 8,
    settlementLocation: '山寨市集', settlementStart: 4, settlementEnd: 9,
  },
  {
    id: 'medicine', name: '遗藏取药匣', icon: 'leaf' as IconName,
    accepted: 'medicine-pledged', verified: 'medicine-box-recovered', settled: 'medicine-settled', failed: undefined,
    taskEvent: 'cave-remedy-cache', settlementEvent: 'clan-remedy-settlement',
    taskName: '取匣', taskLocation: '石灯遗藏', taskStart: 3, taskEnd: 8,
    settlementLocation: '议事楼药棚', settlementStart: 4, settlementEnd: 10,
  },
];

function CommissionJournal({ game }: { game: GameState }) {
  const accepted = COMMISSIONS.filter(item => game.flags.includes(item.accepted));
  if (!accepted.length) return null;

  return <section className="commission-journal" aria-label="已承接委托进度">
    <h3 className="journal-subheading"><Icon name="flag" size={18} />承接的委托<span>{accepted.length} 项</span></h3>
    <div className="commission-list">{accepted.map(item => {
      const verified = game.flags.includes(item.verified);
      const settled = game.flags.includes(item.settled);
      const fighting = game.combat?.victoryEffects.addFlags?.includes(item.verified);
      const taskAbandoned = game.seenEvents.includes(item.taskEvent) && !verified && !fighting;
      const settlementAbandoned = game.seenEvents.includes(item.settlementEvent) && !settled;
      const failed = !!item.failed && game.flags.includes(item.failed);
      const expired = verified ? game.day > item.settlementEnd : game.day > item.taskEnd;
      const opens = verified ? item.settlementStart : item.taskStart;
      const waiting = game.day < opens;
      const lost = failed || taskAbandoned || settlementAbandoned || expired;
      const state = settled ? 'complete' : lost ? 'failed' : waiting ? 'waiting' : verified ? 'ready' : 'pending';
      const status = settled ? '已完成' : failed ? '已失约' : taskAbandoned || settlementAbandoned ? '已放弃' : expired ? '已失约' : waiting ? '待开放' : verified ? '可结款' : '待进行';
      const destination = verified ? item.settlementLocation : item.taskLocation;
      const next = settled ? '这份约定已兑现，报酬与选择都记在行记里。'
        : failed ? '验路未能完成，这次结款机会已经失去。'
          : taskAbandoned ? `已放弃这次${item.taskName}，此前投入不再退回。`
            : settlementAbandoned ? '已谢绝这次结算，不能回来重复领取报酬。'
              : expired ? `已经错过${verified ? '结款' : item.taskName}期限，这份委托无法继续。`
                : fighting ? '先完成眼前的战斗，获胜后才能拿到验路凭据。'
                  : waiting ? `第 ${opens} 日起，前往${destination}探查后续。`
                    : verified ? `凭据已经齐备，前往${destination}探查并选择报酬。`
                      : `前往${destination}探查，完成${item.taskName}后去${item.settlementLocation}结款。`;
      return <article className={`commission-card commission-${state}`} key={item.id}>
        <div className="commission-heading"><h4><Icon name={item.icon} size={17} />{item.name}</h4><span className="commission-status">{status}</span></div>
        <ol className="commission-steps" aria-label={`${item.name}进度`}>{['承接', item.taskName, '结款'].map((label, index) => {
          const done = index === 0 || (index === 1 ? verified : settled);
          return <li key={label} className={done ? 'is-done' : ''}><span aria-hidden="true">{done ? <Icon name="check" size={13} /> : index + 1}</span>{label}<span className="sr-only">{done ? '已完成' : '尚未完成'}</span></li>;
        })}</ol>
        <p>{next}</p><div className="commission-deadline"><Icon name="compass" size={14} /><div><p>{item.taskName}：{item.taskLocation} · 第 {item.taskStart}–{item.taskEnd} 日</p><p>结款：{item.settlementLocation} · 第 {item.settlementStart}–{item.settlementEnd} 日</p></div></div>
      </article>;
    })}</div>
  </section>;
}

export function JournalPanel({ game }: ReadPanelProps) {
  const logs = [...game.journal].reverse();
  const logIcons: Record<GameState['journal'][number]['kind'], IconName> = { story: 'book', good: 'check', bad: 'flag', info: 'compass' };

  return <section className="panel journal-panel" aria-label="行记与人物关系">
    <SectionHeading eyebrow="每次取舍 · 都有回声" title="山中行记"><span className="muted">本局 {logs.length} 条记录</span></SectionHeading>
    <CommissionJournal game={game} />
    <div className="journal-people">
      <h3 className="journal-subheading"><Icon name="people" size={18} />同行与对手</h3>
      <p className="muted panel-note">关系记下往来的温度。真正兑现的回报来自你们已经达成的约定，完成援助与交易后会出现在后续事件里。</p>
      <div className="npc-grid">{NPCS.map((npc) => {
        const relation = game.relations[npc.id] ?? 0;
        const relationLabel = relation >= 15 ? '相熟' : relation > 0 ? '有往来' : relation < 0 ? '存有芥蒂' : '尚未熟识';
        return <article className="npc-card" key={npc.id}>
          <div className="npc-heading"><div><h4>{npc.name}</h4><span className="muted">{npc.role}</span></div><span className={`npc-relation${relation > 0 ? ' is-positive' : relation < 0 ? ' is-negative' : ''}`}><strong>{relation > 0 ? '+' : ''}{relation}</strong><small>{relationLabel}</small></span></div>
          <p className="npc-motive">{npc.motive}</p><p className="npc-promise"><Icon name="flag" size={13} />{promiseNote(game, npc.id)}</p>
        </article>;
      })}</div>
    </div>
    <h3 className="journal-subheading"><Icon name="book" size={18} />此行经过<span className="muted">最近的事在前</span></h3>
    {logs.length === 0 ? <div className="empty-state"><p>山路尚未留下足迹。作出第一项选择后，行记会记住这段经历。</p></div> : <ol className="journal-list">{logs.map((entry) => <li className={`journal-entry journal-${entry.kind}`} key={entry.id}><span className="journal-marker"><Icon name={logIcons[entry.kind]} size={14} /></span><div><span className="eyebrow">第 {entry.day} 日</span><p>{entry.text}</p></div></li>)}</ol>}
  </section>;
}

function QuestCheck({ complete, label, progress }: { complete: boolean; label: string; progress: string }) {
  return <li className={`quest-check${complete ? ' is-complete' : ''}`}><span className="quest-check-icon"><Icon name={complete ? 'check' : 'compass'} size={12} /></span><span>{label}</span><strong>{progress}</strong></li>;
}

function nextStepHint(game: GameState): string {
  if (game.ending) return '这段十日行程已经落定。行记会保留你走过的路径与付出的代价。';
  if (game.combat) return '先看对手下一招，再决定攻守。普通攻击能回 1 真元，防御能回 2 真元。';
  if (game.activeEvent) return '先处理眼前的事。每个选项都列出门槛与代价，也总有保留余地的退路。';
  if (game.actions === 0) return '今日行动已尽。核对今晚的供养费用，再结束当日，继续明天的行程。';
  if (game.hungry.length > 0) return '有蛊正在休眠。先到蛊囊检查补喂费用，再决定要不要进入危险地带。';
  if (game.resources.stones < getUpkeep(game)) return '当前元石还不足以付今晚供养。市集搬货或公仓劳作能补充路费。';
  if (game.clues === 0) return '先选一个地点探查。竹林、山涧与市集都有人留下消息，也可以先在学堂接一份差事。';
  if (game.clues < 3) return '你已经有了线索。换个地点核实，也留意帮助别人后得到的回报；所有门路不必全走。';
  if (game.rank === 1) return '你已掌握进入遗藏所需的情报。可以先筹措材料、突破二转，再选择自己的去路。';
  return '入门线索已经齐备。核对生命、真元与携带的蛊，决定把机缘握在手中，还是换一条更稳的路。';
}

export function QuestPanel({ game }: ReadPanelProps) {
  const inherited = game.flags.includes('inheritance-secured');
  const clanReady = game.clues >= 2 && game.trust >= 35;
  const departureReady = game.day >= 6 && game.clues >= 1 && game.resources.stones >= 35;

  return <aside className="panel quest-panel" aria-label="三条去路进度">
    <SectionHeading eyebrow="山中十日" title="你的去路"><span className="quest-day">{game.day}<small> / 10 日</small></span></SectionHeading>
    <div className="quest-hint"><Icon name="compass" size={17} /><p>{nextStepHint(game)}</p></div>
    <Meter label="已核实情报" value={Math.min(game.clues, 3)} max={3} icon="eye" kind="jade" />
    <div className="quest-list">
      <article className={`quest-card quest-inheritance${inherited ? ' is-complete' : ''}`}>
        <div className="quest-heading"><Icon name="flame" size={17} /><h3>独掌传承</h3><span className="muted">石灯遗藏</span></div>
        <ul><QuestCheck complete={game.clues >= 3} label="核实情报" progress={`${game.clues} / 3`} /><QuestCheck complete={inherited} label="战胜守关木傀" progress={inherited ? '已完成' : '待试关'} /></ul>
        <p className="muted">{inherited ? '遗藏的钥匙已在你手中。' : game.clues >= 3 ? '到遗藏探查；准备妥当后再决定试关。' : '拼出入口顺序，还要凭实力通过守关。'}</p>
      </article>
      <article className={`quest-card quest-clan${clanReady ? ' is-ready' : ''}`}>
        <div className="quest-heading"><Icon name="home" size={17} /><h3>宗族立足</h3><span className="muted">议事楼</span></div>
        <ul><QuestCheck complete={game.clues >= 2} label="掌握情报" progress={`${game.clues} / 2`} /><QuestCheck complete={game.trust >= 35} label="宗族信任" progress={`${game.trust} / 35`} /></ul>
        <p className="muted">{clanReady ? '条件齐备，可到议事楼探查并谈定归属。' : '以可信的消息与办事记录，换稳定的位置。'}</p>
      </article>
      <article className={`quest-card quest-departure${departureReady ? ' is-ready' : ''}`}>
        <div className="quest-heading"><Icon name="compass" size={17} /><h3>随队离山</h3><span className="muted">山寨市集</span></div>
        <ul><QuestCheck complete={game.day >= 6} label="商队开始离寨" progress={game.day >= 6 ? '已开放' : `第 ${game.day} / 6 日`} /><QuestCheck complete={game.clues >= 1} label="沿途情报" progress={`${game.clues} / 1`} /><QuestCheck complete={game.resources.stones >= 35} label="支付路费" progress={`${game.resources.stones} / 35`} /></ul>
        <p className="muted">{departureReady ? '去市集探查，可支付路费主动结束此行。' : '第六日起，备齐路费和消息即可另寻天地。'}</p>
      </article>
    </div>
  </aside>;
}
