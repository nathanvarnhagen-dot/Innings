import { Link } from 'react-router-dom';
import type { Moment } from '../types/domain';
import { formatMomentDate } from '../utils/format';

export function MomentCard({ moment }: { moment: Moment }) {
  return (
    <Link to={`/moments/${moment.kind}/${moment.id}`} className={`moment-card ${moment.kind}`} style={moment.theme ? { background: moment.theme } : undefined}>
      {moment.photos[0] && <img src={moment.photos[0]} alt="" />}
      <div className="moment-card-body">
        <span className="badge">{moment.kind === 'future' ? 'Upcoming' : moment.vibe || 'Memory'}</span>
        <h2>{moment.title}</h2>
        <p>{formatMomentDate(moment.date)}{moment.location ? ` · ${moment.location}` : ''}</p>
        {moment.caption && <div className="caption">{moment.caption}</div>}
      </div>
    </Link>
  );
}
