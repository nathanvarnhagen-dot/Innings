import { useState } from 'react';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../../firebase/client';
import { createProfile } from '../../firebase/profiles';
import { useAuth } from '../../app/AuthProvider';

type Step = 'phone' | 'code' | 'profile';

export function OnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>(user ? 'profile' : 'phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function sendCode() {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) return setError('Enter a valid 10-digit US phone number.');
    setBusy(true); setError('');
    try {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha', { size: 'invisible' });
      const result = await signInWithPhoneNumber(auth, `+1${digits}`, verifier);
      setConfirmation(result); setStep('code');
    } catch { setError('We could not send the code. Please try again.'); }
    finally { setBusy(false); }
  }

  async function verify() {
    if (!confirmation || code.length !== 6) return setError('Enter the six-digit code.');
    setBusy(true); setError('');
    try { await confirmation.confirm(code); setStep('profile'); }
    catch { setError('That code was not accepted.'); }
    finally { setBusy(false); }
  }

  async function finish() {
    if (!auth.currentUser || !name.trim()) return setError('Enter your name.');
    setBusy(true);
    try {
      await createProfile(auth.currentUser.uid, name.trim(), auth.currentUser.phoneNumber ?? undefined);
      await refreshProfile();
    } catch { setError('Your profile could not be saved.'); setBusy(false); }
  }

  return <main className="onboarding">
    <section className="onboarding-brand"><div className="brand-mark">Inn<span>ings</span></div><p>Every moment deserves a home.</p></section>
    <section className="onboarding-form">
      {step === 'phone' && <><label>Mobile number<input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(415) 555-0123" /></label><button onClick={sendCode} disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button></>}
      {step === 'code' && <><label>Verification code<input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" /></label><button onClick={verify} disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</button><button className="text-button" onClick={() => setStep('phone')}>Use a different number</button></>}
      {step === 'profile' && <><label>Your name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="How friends know you" /></label><button onClick={finish} disabled={busy}>{busy ? 'Saving…' : 'Start your innings'}</button></>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div id="recaptcha" />
    </section>
  </main>;
}
