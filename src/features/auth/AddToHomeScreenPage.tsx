import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon } from '../../components/ui/Icon';

function InstallStep({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return <div className="install-step"><span className="install-step-number">{number}</span><div><h2>{title}</h2>{children}</div></div>;
}

export function AddToHomeScreenPage() {
  const navigate = useNavigate();
  return <main className="install-page">
    <section className="install-content">
      <div className="install-logo" aria-label="Innings"><span>I</span><span>N</span></div>
      <h1>Add Innings to your<br />Home Screen</h1>
      <p className="install-intro">So it opens like an app — fullscreen, no browser bar, always one tap away.</p>
      <div className="install-steps">
        <InstallStep number={1} title="Tap the Share button"><p>At the bottom of Safari — the box with an arrow pointing up</p><span className="install-hint"><Icon name="share" size={16} /> Share</span></InstallStep>
        <div className="install-rule" />
        <InstallStep number={2} title={'Tap “Add to Home Screen”'}><p>Scroll down in the share sheet until you see it</p><span className="install-hint"><Icon name="grid-plus" size={16} /> Add to Home Screen</span></InstallStep>
        <div className="install-rule" />
        <InstallStep number={3} title={'Tap “Add” in the top right'}><p>Innings will appear on your home screen with the IN icon</p><span className="install-mini-logo"><b>I</b><b>N</b></span></InstallStep>
      </div>
    </section>
    <footer className="install-actions">
      <button type="button" className="install-primary" onClick={() => navigate('/', { replace: true })}>I’ve added it — let’s go</button>
      <button type="button" className="install-skip" onClick={() => navigate('/', { replace: true })}>Skip for now</button>
    </footer>
  </main>;
}
