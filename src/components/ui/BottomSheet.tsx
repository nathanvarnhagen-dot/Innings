import { useEffect, type PropsWithChildren } from 'react';
import { Icon } from './Icon';

interface BottomSheetProps extends PropsWithChildren { open: boolean; onClose: () => void; label: string; }

export function BottomSheet({ open, onClose, label, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.body.classList.add('has-sheet');
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.classList.remove('has-sheet'); window.removeEventListener('keydown', onKeyDown); };
  }, [onClose, open]);

  if (!open) return null;
  return <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={label} onMouseDown={(event) => event.stopPropagation()}>
      <div className="sheet-handle" />
      <button className="sheet-close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
      {children}
    </section>
  </div>;
}
