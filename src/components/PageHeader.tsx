import type { ReactNode } from 'react';

export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1></div>{action}</header>;
}
