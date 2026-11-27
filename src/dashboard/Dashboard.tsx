import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Download,
  FileText,
  FolderOpen,
  Layers,
  Link2,
  Mail,
  Moon,
  Plus,
  Radar,
  Sun,
  X,
} from 'lucide-react';
import { Brand } from '../Brand';
import { useTheme } from '../theme';
import { getProfileInitials, readUserProfile } from '../userProfile';
import {
  DEMO_ELEVATIONS,
  demoScan,
  DEMO_RANGE_KM,
  formatDay,
  istClock,
  rainRate,
  TIMES,
  utcClock,
  type ArchiveCatalog,
  type Scan,
} from '../data';
import ControlPanel from './ControlPanel';
import CalendarDropdown from './CalendarDropdown';
import Insights from './Insights';
import Library from './Library';
import Methods from './Methods';
import PlotPanel, { accumScale, DIFF_SCALE } from './PlotPanel';
import { exportCsv, exportJson, exportPng } from './exporters';
import {
  dayOf,
  DEFAULTS,
  isDay,
  pageHash,
  parseRoute,
  readState,
  writeState,
  type Page,
  type ViewState,
} from './state';
import { useBackend, type Uploaded } from './useBackend';

const PAGES: { id: Page; label: string; icon: typeof Radar }[] = [
  { id: 'workspace', label: 'Dashboard', icon: Radar },
  { id: 'library', label: 'Data library', icon: FolderOpen },
];
const PAGE_TITLES: Record<Page, string> = {
  workspace: 'Dashboard',
  library: 'Data library',
  methods: 'Data & methodology',
};
const PAGE_INTROS: Record<Page, string> = {
  workspace: 'View radar data by elevation, cross-section and time.',
  library: 'Upload radar files and open processed days.',
  methods: 'Data sources, methods and limitations.',
};

/** Opening a day or file starts at the radar's full range (MBL-RADAR: 1133 gates × 150 m = 169.8 km);
 * the value is clamped to the last gate once the first sweep loads. */
const FULL_RANGE = 2000;

export default function Dashboard({ page }: { page: Page }) {
  const [theme, setTheme] = useTheme();
  const profile = useMemo(() => readUserProfile(), []);
  const profileInitials = useMemo(() => getProfileInitials(profile.name), [profile.name]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePinned, setProfilePinned] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileLeaveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
        setProfilePinned(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setProfilePinned(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  useEffect(() => () => window.clearTimeout(profileLeaveTimer.current), []);
  const [state, setState] = useState<ViewState>(() => readState(parseRoute(window.location.hash).params));
  const set = useCallback((patch: Partial<ViewState>) => setState((s) => ({ ...s, ...patch })), []);
  const [playing, setPlaying] = useState(false);
  const { service, setService, uploads, setUploads, archiveDays, refreshUploads } = useBackend();
  const [catalog, setCatalog] = useState<ArchiveCatalog | null>(null);
  const [realScan, setRealScan] = useState<Scan | null>(null);
  const [sourceField, setSourceField] = useState('');
  const [sweep, setSweep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [override, setOverride] = useState<Scan | null>(null);
  const [viewBusy, setViewBusy] = useState(false);
  const [sweeps, setSweeps] = useState<Scan[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null),
    exportMenu = useRef<HTMLDetailsElement>(null),
    request = useRef(0);

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  const demo = state.source === 'demo';
  const day = isDay(state.source) ? dayOf(state.source) : null;
  const dayCatalog = day && catalog?.date === day ? catalog : null;
  const currentUpload = uploads.find((u) => u.id === state.source);
  const scan = demo
    ? demoScan(
        Math.min(state.time, TIMES.length - 1),
        DEMO_ELEVATIONS.includes(state.elevation) ? state.elevation : 0.5,
      )
    : realScan;
  const activeRange = demo ? DEMO_RANGE_KM : scan?.ranges.at(-1) || state.range;
  const sweepIndex = dayCatalog ? Math.max(0, dayCatalog.fixed_angles.indexOf(state.elevation)) : sweep;
  const dayField = sourceField || 'DBZ';

  const transform = useMemo(
    () => (state.field === 'rainfall' ? (v: number) => rainRate(v, state.a, state.b) : (v: number) => v),
    [state.field, state.a, state.b],
  );
  const units = state.field === 'rainfall' ? 'mm/hr' : 'dBZ';

  // Keep the URL in sync so any view can be shared or bookmarked.
  useEffect(() => {
    const hash = pageHash(page, writeState(state));
    if (window.location.hash !== hash) history.replaceState(null, '', hash);
  }, [state, page]);

  // Playback through the demonstration sequence or an archive day (waits for each frame to load).
  const frames = demo ? TIMES.length : (dayCatalog?.volumes.length ?? 0);
  useEffect(() => {
    if (!playing || !frames || busy || viewBusy) return;
    const timer = setTimeout(
      () => setState((s) => ({ ...s, time: (s.time + 1) % frames })),
      demo ? 1100 : 600,
    );
    return () => clearTimeout(timer);
  }, [playing, frames, demo, busy, viewBusy, state.time]);

  // Keep indices valid for the current source.
  useEffect(() => {
    if (demo && !DEMO_ELEVATIONS.includes(state.elevation)) set({ elevation: 0.5 });
    if (demo && state.time >= TIMES.length) set({ time: DEFAULTS.time });
    if (dayCatalog) {
      const n = dayCatalog.volumes.length;
      if (state.time >= n) set({ time: n - 1 });
      if (!dayCatalog.fixed_angles.includes(state.elevation)) set({ elevation: dayCatalog.fixed_angles[0] });
    }
  }, [demo, dayCatalog, state.time, state.elevation, set]);

  // Load the catalog of an archive day.
  useEffect(() => {
    if (!day || catalog?.date === day) return;
    const controller = new AbortController();
    fetch(`/api/archive/${day}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail || 'This archive day is unavailable.');
        return r.json();
      })
      .then(setCatalog)
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setNotice(`${e.message} Choose data from the Data library.`);
        set({ source: 'demo', time: DEFAULTS.time, elevation: 0.5, range: DEMO_RANGE_KM });
      });
    return () => controller.abort();
  }, [day, catalog?.date, set]);

  // Recover an uploaded source named in the URL once the file list arrives.
  useEffect(() => {
    if (!demo && currentUpload && !sourceField) setSourceField(currentUpload.fields[0]?.name || '');
  }, [demo, currentUpload, sourceField]);

  // Fall back to the demonstration if a linked upload no longer exists on the backend.
  useEffect(() => {
    if (demo || day || !service) return;
    const t = setTimeout(() => {
      if (!uploads.some((u) => u.id === state.source)) {
        set({ source: 'demo', range: DEMO_RANGE_KM });
        setNotice(
          'That uploaded file is no longer available. Choose data from the Data library.',
        );
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [demo, day, service, uploads, state.source, set]);

  // With nothing selected, open the most recent loaded day automatically.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (page !== 'workspace' || !demo || autoOpened.current || !archiveDays.length) return;
    autoOpened.current = true;
    void openDay(archiveDays[archiveDays.length - 1].date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, demo, archiveDays]);

  // Read the selected sweep from an uploaded file or an archive volume.
  const scanUrl = demo
    ? null
    : day
      ? dayCatalog && state.time < dayCatalog.volumes.length
        ? `/api/archive/${day}/volumes/${state.time}/sweep?field=${dayField}&sweep=${sweepIndex}`
        : null
      : sourceField
        ? `/api/files/${state.source}/scan?field=${encodeURIComponent(sourceField)}&sweep=${sweep}`
        : null;
  useEffect(() => {
    if (!scanUrl) return;
    const controller = new AbortController();
    const n = ++request.current;
    setBusy(true);
    // Keep the previous frame on screen during archive playback; clear it for a new file.
    if (!day) setRealScan(null);
    fetch(scanUrl, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).detail || 'Unable to read this scan.');
        return r.json();
      })
      .then((data: Scan) => {
        if (n !== request.current) return;
        setRealScan(data);
        const full = data.ranges[data.ranges.length - 1] || 80;
        setState((s) => ({ ...s, range: s.range > full || s.range === DEMO_RANGE_KM ? full : s.range }));
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setNotice(e.message);
      })
      .finally(() => {
        if (n === request.current) setBusy(false);
      });
    return () => controller.abort();
  }, [scanUrl, day]);

  const goTo = useCallback(
    (p: Page) => {
      setNotice('');
      setPlaying(false);
      window.location.hash = pageHash(p, writeState(state));
    },
    [state],
  );

  function selectDemo(time = DEFAULTS.time) {
    setRealScan(null);
    setSourceField('');
    set({ source: 'demo', time, elevation: 0.5, range: DEMO_RANGE_KM });
  }

  /** Opens an archive day on its busiest volume so the first view shows weather. */
  async function openDay(date: string) {
    try {
      const r = await fetch(`/api/archive/${date}`);
      if (!r.ok) throw new Error();
      const c: ArchiveCatalog = await r.json();
      const busiest = c.volumes.reduce(
        (best, v, i) => (v.stats.area_35_km2 > c.volumes[best].stats.area_35_km2 ? i : best),
        0,
      );
      setRealScan(null);
      setSourceField('DBZ');
      setPlaying(false);
      setCatalog(c);
      const next: ViewState = {
        ...state,
        source: `day:${date}`,
        time: busiest,
        compareTime: Math.max(0, busiest - 3),
        elevation: c.fixed_angles[0],
        view: 'ppi',
        pin: null,
        range: FULL_RANGE,
      };
      setState(next);
      window.location.hash = pageHash('workspace', writeState(next));
    } catch {
      setNotice('This archive day could not be loaded.');
    }
  }

  function resetSettings() {
    setPlaying(false);
    set({ ...DEFAULTS, source: state.source, range: activeRange });
  }

  /** Uploads a zip, or the .nc files of a folder, and processes them into full days. */
  async function importFiles(files: File[]) {
    const radar = files.filter((f) => /\.(nc|zip)$/i.test(f.name));
    if (!radar.length) return setNotice('No .nc or .zip files were found in that selection.');
    const BATCH = 100;
    setBusy(true);
    setNotice('');
    const fail = async (r: Response, fallback: string) => {
      let detail = fallback;
      try {
        const d = await r.json();
        if (typeof d.detail === 'string') detail = d.detail;
      } catch {
        /* not JSON */
      }
      throw new Error(detail);
    };
    try {
      const created = await fetch('/api/imports', { method: 'POST' }).catch(() => null);
      if (!created || !created.ok)
        throw new Error('The data service is not running. Start it with npm run backend, then try again.');
      const { id } = await created.json();
      for (let i = 0; i < radar.length; i += BATCH) {
        setNotice(`Uploading files… ${Math.min(i + BATCH, radar.length)} of ${radar.length}`);
        const form = new FormData();
        radar.slice(i, i + BATCH).forEach((f) => form.append('files', f));
        const r = await fetch(`/api/imports/${id}/files`, { method: 'POST', body: form });
        if (!r.ok) await fail(r, 'The upload failed.');
      }
      setNotice('Processing radar volumes. A full day can take a few minutes…');
      const r = await fetch(`/api/imports/${id}/process`, { method: 'POST' });
      if (!r.ok) await fail(r, 'The files could not be processed.');
      const { days } = (await r.json()) as { days: { date: string; volume_count: number }[] };
      setService(true);
      await refreshUploads();
      const summary = days.map((d) => `${formatDay(d.date)} (${d.volume_count} volumes)`).join(', ');
      if (days.length === 1) {
        setNotice(`Loaded ${summary}.`);
        await openDay(days[0].date);
      } else {
        setNotice(`Loaded ${days.length} days: ${summary}. Choose a day under Radar archive.`);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'The files could not be loaded.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
      if (folderInput.current) folderInput.current.value = '';
    }
  }

  async function upload(file: File) {
    if (file.name.toLowerCase().endsWith('.zip')) return importFiles([file]);
    if (!file.name.toLowerCase().endsWith('.nc'))
      return setNotice('Choose a NetCDF (.nc) file or a .zip file.');
    if (file.size > 64 * 1024 * 1024) return setNotice('This local prototype accepts files up to 64 MiB.');
    setBusy(true);
    setNotice('');
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch('/api/files', { method: 'POST', body: form });
      let data;
      try {
        data = await r.json();
      } catch {
        throw new Error('The data service is not running. Start it with npm run backend, then try again.');
      }
      if (!r.ok)
        throw new Error(typeof data.detail === 'string' ? data.detail : 'The file could not be inspected.');
      setUploads((prev) => [...prev, data]);
      setService(true);
      setNotice(`${file.name} loaded. Select Open to view it.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'The data service is not running.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function openUpload(item: Uploaded) {
    setSourceField(item.fields[0]?.name || '');
    setSweep(0);
    setPlaying(false);
    const next = { ...state, source: item.id, view: 'ppi' as const, pin: null, range: FULL_RANGE };
    setState(next);
    window.location.hash = pageHash('workspace', writeState(next));
  }

  async function removeUpload(item: Uploaded) {
    try {
      const r = await fetch(`/api/files/${item.id}`, { method: 'DELETE' });
      if (!r.ok && r.status !== 404) throw new Error('Could not remove this file.');
      setUploads((v) => v.filter((x) => x.id !== item.id));
      if (state.source === item.id) selectDemo();
      setNotice('File removed from this local session.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Link copied. It reopens this exact view: scan, settings and pinned gate.');
    } catch {
      setNotice(`Copy this link: ${window.location.href}`);
    }
  }

  const displayed = override ?? scan;

  function exportData(format: 'png' | 'json' | 'csv') {
    if (!scan || !displayed) return;
    exportMenu.current?.removeAttribute('open');
    const isDiff = displayed.field === 'difference',
      isAccum = displayed.field === 'accumulation';
    const ctx = {
      state,
      scan,
      displayed,
      sweeps,
      transform,
      units: isDiff ? 'ΔdBZ' : isAccum ? 'mm' : units,
      scale: isDiff ? DIFF_SCALE : isAccum ? accumScale(displayed) : { min: state.min, max: state.max },
      canvas: canvas.current,
    };
    if (format === 'png') exportPng(ctx);
    else if (format === 'json') exportJson(ctx);
    else exportCsv(ctx);
  }

  return (
    <div className="dashboard" data-theme={theme}>
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a href="#/" className="sidebar-brand" aria-label="Back to home page">
          <Brand />
        </a>
        <div className="sidebar-section-label">RESEARCH WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => goTo(id)}
            >
              <Icon size={18} strokeWidth={1.5} />
              {label}
              {id === 'library' && (
                <span className="nav-count">{uploads.length + archiveDays.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={page === 'methods' ? 'active' : ''} onClick={() => goTo('methods')}>
            <BookOpen size={17} />
            Data & methodology
          </button>
          <a href="#/">
            <ArrowLeft size={17} />
            Back to home
          </a>
          <div className="prototype-note">
            <span className="status-dot" /> Prototype
            <span>Files stay on this computer.</span>
          </div>
        </div>
      </aside>
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <div>
            <span className="breadcrumb">Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <span>{PAGE_TITLES[page]}</span>
          </div>
          <div className="topbar-right">
            {page === 'workspace' && (
              <button
                className="icon-button"
                aria-label="Copy link to this view"
                title="Copy link to this view"
                onClick={() => void copyLink()}
              >
                <Link2 size={18} />
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Read data and methodology"
              onClick={() => goTo('methods')}
            >
              <CircleHelp size={19} />
            </button>
            <button
              className="icon-button theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div
              className="user-menu"
              ref={profileMenuRef}
              onMouseEnter={() => {
                window.clearTimeout(profileLeaveTimer.current);
                setProfileOpen(true);
              }}
              onMouseLeave={() => {
                if (profilePinned) return;
                profileLeaveTimer.current = window.setTimeout(() => setProfileOpen(false), 120);
              }}
            >
              <button
                type="button"
                className="user-avatar"
                aria-label="User profile"
                aria-expanded={profileOpen}
                aria-haspopup="dialog"
                title={profile.name}
                onClick={() => {
                  window.clearTimeout(profileLeaveTimer.current);
                  setProfilePinned((p) => {
                    const next = !p;
                    setProfileOpen(next);
                    return next;
                  });
                }}
              >
                {profile.photo ? (
                  <img src={profile.photo} alt={profile.name} className="user-avatar-img" />
                ) : (
                  profileInitials
                )}
              </button>
              {profileOpen && (
                <div className="user-profile-card" role="dialog" aria-label="User profile details">
                  <div className="user-profile-head">
                    <span className="user-profile-avatar" aria-hidden="true">
                      {profile.photo ? (
                        <img src={profile.photo} alt="" className="user-avatar-img" />
                      ) : (
                        profileInitials
                      )}
                    </span>
                    <div className="user-profile-meta">
                      <strong>{profile.name}</strong>
                      <span>{profile.role}</span>
                    </div>
                  </div>
                  <div className="user-profile-email">
                    <Mail size={13} aria-hidden="true" />
                    <span>{profile.email || 'Guest session'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="workspace-content" className="dashboard-main">
          {page !== 'workspace' && (
            <div className="page-heading">
              <div>
                <h1>{PAGE_TITLES[page]}</h1>
                <p>{PAGE_INTROS[page]}</p>
              </div>
            </div>
          )}
          <input
            type="file"
            accept=".nc,.zip"
            ref={fileInput}
            className="visually-hidden"
            aria-label="Choose a radar file (.nc or .zip)"
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
            }}
          />
          <input
            type="file"
            multiple
            ref={folderInput}
            className="visually-hidden"
            aria-label="Choose a folder of radar files"
            onChange={(e) => {
              if (e.target.files?.length) void importFiles(Array.from(e.target.files));
            }}
          />
          {notice && (
            <div className="notice" role="status">
              <FileText size={17} />
              <span>{notice}</span>
              <button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {page === 'workspace' && demo && (
            <div className="workspace-empty">
              <Layers size={30} strokeWidth={1.4} />
              <h2>No radar data loaded</h2>
              <p>Upload a .zip file of a day, a folder of .nc files, or a single .nc file.</p>
              <button className="btn btn-primary" onClick={() => goTo('library')}>
                <Plus size={16} />
                Upload data
              </button>
            </div>
          )}
          {page === 'workspace' && !demo && (
            <>
              <div className="dataset-strip">
                <div className="dataset-icon">
                  <Layers size={19} />
                </div>
                <div>
                  <strong>
                    {demo
                      ? 'Western Ghats · demonstration volume'
                      : dayCatalog
                        ? `${dayCatalog.site.name} · Mahabaleshwar · ${formatDay(dayCatalog.date)}`
                        : day
                          ? 'Loading archive day…'
                          : (currentUpload?.name ?? 'Uploaded file')}
                  </strong>
                  <span>
                    {demo
                      ? '15 July 2026 · 6 scans × 4 elevations · synthetic reflectivity'
                      : dayCatalog
                        ? `${dayCatalog.volume_count} volumes × ${dayCatalog.fixed_angles.length} sweeps · X-band ${dayCatalog.site.frequency_ghz.toFixed(2)} GHz dual-pol · ${Math.round(dayCatalog.site.altitude_m)} m${dayCatalog.gaps.length ? ` · ${dayCatalog.gaps.reduce((n, g) => n + g.missing_volumes, 0)} missing` : ''}`
                        : 'Uploaded NetCDF · local session · original file preserved'}
                  </span>
                </div>
                {dayCatalog && scan && (
                  <span className="dataset-time">
                    {utcClock(dayCatalog.volumes[Math.min(state.time, dayCatalog.volumes.length - 1)].start)}{' '}
                    UTC
                    <small>
                      {istClock(
                        dayCatalog.volumes[Math.min(state.time, dayCatalog.volumes.length - 1)].start,
                      )}{' '}
                      IST
                    </small>
                  </span>
                )}
                <span className={`data-badge ${demo ? '' : day ? 'observed' : 'uploaded'}`}>
                  {demo ? 'Synthetic data' : day ? 'Observed data' : 'Uploaded file'}
                </span>
                <div className="dataset-actions">
                  <CalendarDropdown
                    availableDates={archiveDays.map((d) => d.date)}
                    selectedDate={day}
                    onSelectDate={(date) => void openDay(date)}
                    onOpen={() => void refreshUploads()}
                  />
                  <button className="text-button" onClick={() => goTo('library')}>
                    Change dataset <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <div className="workspace-grid">
                <ControlPanel
                  state={state}
                  set={set}
                  scan={scan}
                  upload={currentUpload}
                  catalog={dayCatalog}
                  sourceField={day ? dayField : sourceField}
                  setSourceField={setSourceField}
                  sweep={sweep}
                  setSweep={setSweep}
                  activeRange={activeRange}
                  onReset={resetSettings}
                />
                <PlotPanel
                  state={state}
                  set={set}
                  scan={scan}
                  upload={currentUpload}
                  catalog={dayCatalog}
                  sourceField={day ? dayField : sourceField}
                  busy={busy}
                  service={service}
                  transform={transform}
                  units={units}
                  playing={playing}
                  setPlaying={setPlaying}
                  onUseDemo={() => goTo('library')}
                  onMethods={() => goTo('methods')}
                  canvasRef={canvas}
                  onDisplayed={setOverride}
                  onBusy={setViewBusy}
                  onSweeps={setSweeps}
                  toolbarAction={
                    <details className="export-menu" ref={exportMenu}>
                      <summary className="btn btn-outline">
                        <Download size={15} />
                        Export <ChevronDown size={14} />
                      </summary>
                      <div>
                        <button disabled={!scan || busy} onClick={() => exportData('png')}>
                          Current view image (.png)
                        </button>
                        <button disabled={!scan || busy} onClick={() => exportData('json')}>
                          Data & provenance (.json)
                        </button>
                        <button disabled={!scan || busy} onClick={() => exportData('csv')}>
                          Displayed gates (.csv)
                        </button>
                      </div>
                    </details>
                  }
                />
              </div>
              <Insights
                state={state}
                set={set}
                scan={scan}
                transform={transform}
                units={units}
                catalog={dayCatalog}
              />
              <p className="workspace-footnote">
                {state.view === 'map'
                  ? 'Regional context is schematic; place markers are approximate. Uploaded scans use source site metadata. '
                  : state.view === 'section'
                    ? 'Cross-sections join separate sweeps; gaps between beams are not interpolated. '
                    : 'PPI shows the selected elevation aloft; it is not a surface rainfall measurement. '}
                <button className="text-button" onClick={() => goTo('methods')}>
                  Read methodology <ArrowRight size={12} />
                </button>
              </p>
            </>
          )}
          {page === 'library' && (
            <Library
              archiveDays={archiveDays}
              onOpenDay={(d) => void openDay(d)}
              uploads={uploads}
              busy={busy}
              service={service}
              onUpload={(f) => void upload(f)}
              onChoose={() => fileInput.current?.click()}
              onChooseFolder={() => folderInput.current?.click()}
              onOpenUpload={openUpload}
              onRemoveUpload={(u) => void removeUpload(u)}
            />
          )}
          {page === 'methods' && <Methods service={service} />}
        </main>
        <footer className="workspace-footer">
          <span>Radar Meteorology · Mahabaleshwar</span>
          <span>
            <span className={`status-dot ${service ? 'connected' : ''}`} />
            {service ? 'Data service connected' : 'Data service not running'}
            <span className="footer-version">v0.2</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
