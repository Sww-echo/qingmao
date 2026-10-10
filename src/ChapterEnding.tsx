import { useId } from 'react';
import { getChapterEpilogue } from './game/chapter';
import { isFangYuan } from './game/campaign';
import type { GameState } from './game/types';
import { Icon } from './ui';

export default function ChapterEnding({ game }: { game: GameState }) {
  const headingId = useId();
  if (isFangYuan(game)) return null;
  const epilogue = getChapterEpilogue(game);
  if (!epilogue || !game.ending) return null;

  const { carryover } = epilogue;
  return <section className="chapter-ending" aria-labelledby={headingId}>
    <div className="chapter-ending-intro"><span className="chapter-ending-kicker">此行留下的痕迹</span><h2 id={headingId} className="chapter-ending-heading">{epilogue.heading}</h2><p>{epilogue.introduction}</p></div>
    <details className="chapter-details chapter-review-details">
      <summary><span><Icon name="flag" size={16} />承诺与旧账</span><span className="chapter-summary-meta">{epilogue.threads.length} 件<Icon name="arrow" size={15} /></span></summary>
      <div className="chapter-details-body">
        {epilogue.threads.length ? <ul className="chapter-review-threads">{epilogue.threads.map(thread => <li key={thread.id} className={`chapter-review-thread chapter-tone-${thread.tone}`}>
          <Icon name={thread.tone === 'good' ? 'check' : thread.tone === 'warn' ? 'flag' : 'book'} size={17} />
          <div><h3>{thread.title}</h3><p>{thread.text}</p></div>
        </li>)}</ul> : <p className="chapter-details-note">这段旅途没有留下额外的承诺与旧账。</p>}
      </div>
    </details>
    <details className="chapter-details chapter-review-details">
      <summary><span><Icon name="people" size={16} />见过的人</span><span className="chapter-summary-meta">{epilogue.people.length} 位<Icon name="arrow" size={15} /></span></summary>
      <div className="chapter-details-body">
        {epilogue.people.length ? <ul className="chapter-people">{epilogue.people.map(person => <li key={person.id}>
          <div className="chapter-person-heading"><h3>{person.name}</h3><span>关系 {person.relation > 0 ? '+' : ''}{person.relation}</span></div>
          <p>{person.text}</p>
        </li>)}</ul> : <p className="chapter-details-note">尚未与山中人物结下足以记述的往来。</p>}
      </div>
    </details>
    <details className="chapter-details chapter-review-details">
      <summary><span><Icon name="bag" size={16} />留在手札中的成果</span><span className="chapter-summary-meta">展开查看<Icon name="arrow" size={15} /></span></summary>
      <div className="chapter-details-body">
        <dl className="chapter-carryover-stats"><div><dt>境界</dt><dd>{carryover.rank === 1 ? '一' : '二'}转</dd></div><div><dt>修为</dt><dd>{carryover.cultivation}</dd></div><div><dt>元石</dt><dd>{carryover.stones}</dd></div></dl>
        <div className="chapter-carryover-block"><h3>同行的蛊</h3>{carryover.gu.length > 0 ? <ul className="chapter-gu-list">{carryover.gu.map(gu => <li key={gu.id}>{gu.name}<span>× {gu.count}</span></li>)}</ul> : <p>行囊中已没有蛊虫。</p>}</div>
        <div className="chapter-carryover-block"><h3>记住的选择</h3>{carryover.choices.length > 0 ? <ul className="chapter-choice-list">{carryover.choices.map((choice, index) => <li key={`${index}-${choice}`}><Icon name="book" size={14} /><span>{choice}</span></li>)}</ul> : <p>本章尚未留下额外的关键抉择。</p>}</div>
      </div>
    </details>
    <div className="chapter-future"><Icon name="mountain" size={21} /><div><strong>第二章尚未开放</strong><p>{epilogue.future}</p><small>通过“保存此行手札”导出完整存档，可保留本章选择与成果。</small></div></div>
  </section>;
}
