import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const lineup = {
  Friday: [['Lands End', 'The Strokes', '8:25 PM'], ['Sutro', 'Japanese Breakfast', '6:10 PM'], ['Twin Peaks', 'Kaytranada', '9:05 PM']],
  Saturday: [['Lands End', 'Tyler, the Creator', '8:30 PM'], ['Sutro', 'The Marías', '6:25 PM'], ['SOMA', 'Barry Can’t Swim', '7:45 PM']],
  Sunday: [['Lands End', 'Hozier', '8:20 PM'], ['Twin Peaks', 'Jamie xx', '7:30 PM'], ['Panhandle', 'Men I Trust', '5:10 PM']],
};

export function FestivalPage() {
  const navigate = useNavigate(); const [day, setDay] = useState<keyof typeof lineup>('Friday'); const [saved, setSaved] = useState<string[]>([]);
  return <main className="festival-page"><header><button onClick={() => navigate(-1)}>← Innings</button><div><span>Outside Lands</span><h1>2026</h1><p>Golden Gate Park · Aug 7–9</p></div></header>
    <nav>{Object.keys(lineup).map((item) => <button key={item} className={day === item ? 'active' : ''} onClick={() => setDay(item as keyof typeof lineup)}>{item}</button>)}</nav>
    <section><p className="festival-eyebrow">{day} lineup</p>{lineup[day].map(([stage, artist, time]) => { const key = `${day}-${artist}`; return <button className="act-card" key={key} onClick={() => setSaved((current) => current.includes(key) ? current.filter((x) => x !== key) : [...current, key])}><span>{saved.includes(key) ? '✓' : '+'}</span><div><small>{stage}</small><strong>{artist}</strong><time>{time}</time></div></button>; })}</section>
  </main>;
}
