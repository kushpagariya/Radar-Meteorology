import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseIsoDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

function toIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarDropdown({
  availableDates,
  selectedDate,
  onSelectDate,
  onOpen,
}: {
  availableDates: string[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const defaultTarget = useMemo(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return parseIsoDate(selectedDate);
    }
    if (availableDates.length > 0) {
      const sorted = [...availableDates].sort();
      return parseIsoDate(sorted[sorted.length - 1]);
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }, [selectedDate, availableDates]);

  const [viewYear, setViewYear] = useState(defaultTarget.year);
  const [viewMonth, setViewMonth] = useState(defaultTarget.month);

  useEffect(() => {
    if (!open) {
      setViewYear(defaultTarget.year);
      setViewMonth(defaultTarget.month);
    }
  }, [open, defaultTarget.year, defaultTarget.month]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const ys = new Set<number>([viewYear, currentYear]);
    for (let y = currentYear - 5; y <= currentYear + 1; y++) ys.add(y);
    availableDates.forEach((d) => {
      const y = Number(d.slice(0, 4));
      if (Number.isFinite(y)) ys.add(y);
    });
    return Array.from(ys).sort((a, b) => a - b);
  }, [availableDates, viewYear]);

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (next) onOpen?.();
      return next;
    });
  }

  return (
    <div className="calendar-dropdown" ref={rootRef}>
      <button
        type="button"
        className={`icon-button calendar-trigger${open ? ' active' : ''}`}
        aria-label="Select radar dataset date"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Select dataset date"
        onClick={toggle}
      >
        <CalendarDays size={16} />
      </button>

      {open && (
        <div className="calendar-popover" role="dialog" aria-label="Available radar dataset dates">
          <div className="calendar-head">
            <button type="button" className="icon-button" aria-label="Previous month" onClick={prevMonth}>
              <ChevronLeft size={15} />
            </button>
            <div className="calendar-selects">
              <select
                aria-label="Month"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
              >
                {MONTHS.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="icon-button" aria-label="Next month" onClick={nextMonth}>
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {Array.from({ length: firstWeekday }, (_, i) => (
              <span key={`pad-${i}`} className="cal-pad" aria-hidden="true" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const dayNum = i + 1;
              const iso = toIsoDate(viewYear, viewMonth, dayNum);
              const isAvailable = availableSet.has(iso);
              const isSelected = selectedDate === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!isAvailable}
                  aria-label={isAvailable ? `Load radar dataset for ${iso}` : `${iso} (no dataset)`}
                  aria-pressed={isSelected}
                  className={`cal-day${isAvailable ? ' is-available' : ' is-unavailable'}${
                    isSelected ? ' is-selected' : ''
                  }`}
                  onClick={() => {
                    onSelectDate(iso);
                    setOpen(false);
                  }}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="calendar-foot">
            {availableDates.length > 0 ? (
              <span>
                <i className="cal-dot" aria-hidden="true" />
                {availableDates.length} dataset date{availableDates.length === 1 ? '' : 's'} available
              </span>
            ) : (
              <span>No archive datasets available yet</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
