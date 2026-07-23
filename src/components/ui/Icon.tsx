import type { SVGProps } from 'react';

export type IconName = 'feed' | 'calendar' | 'plus' | 'heart' | 'user' | 'bell' | 'lock' | 'arrow-left' | 'share' | 'grid-plus' | 'close';

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, strokeWidth = 1.7, ...props }: IconProps) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
    {name === 'feed' && <><rect {...common} x="3" y="5" width="6" height="4" rx="1" /><rect {...common} x="3" y="11" width="6" height="4" rx="1" /><rect {...common} x="3" y="17" width="6" height="4" rx="1" /><path {...common} d="M13 7h8M13 13h8M13 19h8" /></>}
    {name === 'calendar' && <><rect {...common} x="4" y="5" width="16" height="16" rx="2" /><path {...common} d="M8 3v4M16 3v4M4 11h16" /></>}
    {name === 'plus' && <path {...common} d="M12 5v14M5 12h14" />}
    {name === 'heart' && <path {...common} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />}
    {name === 'user' && <><path {...common} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle {...common} cx="12" cy="7" r="4" /></>}
    {name === 'bell' && <><path {...common} d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path {...common} d="M13.73 21a2 2 0 0 1-3.46 0" /></>}
    {name === 'lock' && <><rect {...common} x="5" y="11" width="14" height="10" rx="2" /><path {...common} d="M8 11V7a4 4 0 0 1 8 0v4" /></>}
    {name === 'arrow-left' && <path {...common} d="m15 18-6-6 6-6" />}
    {name === 'share' && <><path {...common} d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path {...common} d="m16 6-4-4-4 4M12 2v13" /></>}
    {name === 'grid-plus' && <><rect {...common} x="3" y="3" width="7" height="7" rx="1" /><rect {...common} x="14" y="3" width="7" height="7" rx="1" /><rect {...common} x="3" y="14" width="7" height="7" rx="1" /><path {...common} d="M14 17h7m-3.5-3.5v7" /></>}
    {name === 'close' && <path {...common} d="m6 6 12 12M18 6 6 18" />}
  </svg>;
}
