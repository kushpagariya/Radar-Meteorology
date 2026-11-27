import { Radar } from 'lucide-react';

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`brand ${dark ? 'brand-dark' : ''}`}>
      <span className="brand-mark">
        <Radar size={25} strokeWidth={1.3} />
      </span>
      <span>
        Radar Meteorology<span className="brand-place">Mahabaleshwar</span>
      </span>
    </span>
  );
}
