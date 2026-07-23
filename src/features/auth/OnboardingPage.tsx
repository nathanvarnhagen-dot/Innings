import { useEffect, useRef, useState } from 'react';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase/client';
import { createProfile } from '../../firebase/profiles';
import { useAuth } from '../../app/AuthProvider';
import { Icon } from '../../components/ui/Icon';

type Step = 'phone' | 'code' | 'profile';

const tickerRows = [
  ['⚾', '🏟️', '🎪', '🎸', '🐕', '🚗', '🎵', '🍺', '✈️', '🏆', '❤️', '🌅', '🎉', '⭐'],
  ['🎉', '🏀', '🎶', '🍕', '🌊', '🎭', '🏔️', '🎨', '🚀', '🌙', '🎤', '🦋', '🎯', '🌺'],
  ['📸', '⚽', '🎸', '🍺', '🏄', '🎪', '🌍', '🎵', '🏆', '🐕', '❤️', '✈️', '🎯', '⚾'],
  ['🌅', '🎭', '🚗', '⭐', '🎤', '🏟️', '🍕', '🌊', '🏔️', '🎨', '🚀', '🌙', '🦋', '🎉'],
  ['🎸', '🏀', '❤️', '🎪', '🌺', '⚾', '🐕', '🎵', '🏆', '✈️', '🍺', '🎉', '🌅', '🚗'],
];

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isIosBrowser() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone;
}

function EmojiTickerField() {
  return <div className="emoji-ticker-field" aria-hidden="true">
    {tickerRows.map((row, index) => <div key={index} className={`emoji-ticker ${index % 2 ? 'emoji-ticker--right' : 'emoji-ticker--left'} ${index === 3 ? 'emoji-ticker--slow' : ''} ${index === 4 ? 'emoji-ticker--quick' : ''}`}>
      {[...row, ...row].map((emoji, emojiIndex) => <span key={`${emoji}-${emojiIndex}`}>{emoji}</span>)}
    </div>)}
  </div>;
}

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(user ? 'profile' : 'phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = step === 'code' ? codeInput.current : step === 'profile' ? nameInput.current : null;
    input?.focus();
  }, [step]);

  useEffect(() => () => verifier.current?.clear(), []);

  function resetVerifier() {
    verifier.current?.clear();
    verifier.current = new RecaptchaVerifier(auth, 'recaptcha', { size: 'invisible' });
    return verifier.current;
  }

  async function sendCode() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError('Enter a valid 10-digit US phone number.'); return; }
    setBusy(true); setError('');
    try {
      const result = await signInWithPhoneNumber(auth, `+1${digits}`, resetVerifier());
      setConfirmation(result); setStep('code');
    } catch {
      setError('We could not send the code. Please try again.');
      verifier.current?.clear(); verifier.current = null;
    } finally { setBusy(false); }
  }

  async function verify() {
    if (!confirmation || code.length !== 6) { setError('Enter the six-digit code.'); return; }
    setBusy(true); setError('');
    try {
      await confirmation.confirm(code);
      verifier.current?.clear(); verifier.current = null;
      setStep('profile');
    } catch { setError('That code was not accepted.'); }
    finally { setBusy(false); }
  }

  async function finish() {
    if (!auth.currentUser || !name.trim()) { setError('Enter your name.'); return; }
    setBusy(true); setError('');
    try {
      await createProfile(auth.currentUser.uid, name.trim(), auth.currentUser.phoneNumber ?? undefined);
      await refreshProfile();
      navigate(isIosBrowser() ? '/add-to-home' : '/', { replace: true });
    } catch { setError('Your profile could not be saved.'); setBusy(false); }
  }

  return <main className="onboarding">
    <section className="onboarding-brand">
      <EmojiTickerField />
      <div className="onboarding-brand-content">
        <div className="brand-mark">Inn<span>ings</span></div>
        <p className="onboarding-tagline">Every moment deserves a home</p>
        <p className="onboarding-mission">For the people and the moments<br /><strong>we share.</strong></p>
      </div>
    </section>
    <section className={`onboarding-form onboarding-form--${step}`}>
      {step === 'phone' && <>
        <label>Mobile number
          <span className="onboarding-phone-wrap"><span className="onboarding-country">🇺🇸 +1</span><input ref={phoneInput} inputMode="tel" autoComplete="tel-national" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} placeholder="(555) 000-0000" /></span>
        </label>
        <div className="onboarding-foot"><button className="onboarding-primary" type="button" onClick={sendCode} disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
          <p className="onboarding-notice"><Icon name="lock" size={12} strokeWidth={2} /> Your number is never shared. Your people only.</p>
          <p className="onboarding-build">build</p></div>
      </>}
      {step === 'code' && <>
        <label>Verification code<input ref={codeInput} className="verification-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="6-digit code" /></label>
        <div className="onboarding-foot"><button className="onboarding-primary" type="button" onClick={verify} disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</button>
          <button className="onboarding-back" type="button" onClick={() => { setError(''); setStep('phone'); }}>← Back</button></div>
      </>}
      {step === 'profile' && <>
        <h1 className="onboarding-step-title">Tell us about you</h1>
        <label>Your name<input ref={nameInput} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="What your people call you" /></label>
        <div className="onboarding-foot"><button className="onboarding-primary" type="button" onClick={finish} disabled={busy}>{busy ? 'Saving…' : 'Start your innings'}</button>
          <p className="onboarding-notice"><Icon name="lock" size={12} strokeWidth={2} /> Private by default. Your people only.</p></div>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div id="recaptcha" />
    </section>
  </main>;
}
