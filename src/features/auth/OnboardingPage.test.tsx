import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnboardingPage } from './OnboardingPage';

vi.mock('../../app/AuthProvider', () => ({
  useAuth: () => ({ user: null, refreshProfile: vi.fn() }),
}));

vi.mock('../../firebase/client', () => ({ auth: {} }));
vi.mock('../../firebase/profiles', () => ({ createProfile: vi.fn() }));

function renderPage() {
  return render(<BrowserRouter><OnboardingPage /></BrowserRouter>);
}

afterEach(cleanup);

describe('OnboardingPage', () => {
  it('renders the old-style brand and privacy treatment', () => {
    renderPage();
    expect(screen.getByText('Every moment deserves a home')).toBeInTheDocument();
    expect(screen.getByText('For the people and the moments')).toBeInTheDocument();
    expect(screen.getByText('Your number is never shared. Your people only.')).toBeInTheDocument();
  });

  it('keeps the user on the phone step for an invalid number', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('(555) 000-0000'), { target: { value: '415' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid 10-digit US phone number.');
    expect(screen.getByPlaceholderText('(555) 000-0000')).toBeInTheDocument();
  });
});
