import { useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Download,
  FileText,
  LoaderCircle,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { colorFor, download, formatDay, type ArchiveDaySummary } from '../data';
import type { Uploaded } from './useBackend';


export default function Library({
  archiveDays,
  onOpenDay,
  uploads,
  busy,
  service,
  onUpload,
  onChoose,
  onChooseFolder,
  onOpenUpload,
  onRemoveUpload,
}: {
  archiveDays: ArchiveDaySummary[];
  onOpenDay: (date: string) => void;
  uploads: Uploaded[];
  busy: boolean;
  service: boolean;
  onUpload: (file: File) => void;
  onChoose: () => void;
  onChooseFolder: () => void;
  onOpenUpload: (u: Uploaded) => void;
  onRemoveUpload: (u: Uploaded) => void;
}) {
  const [query, setQuery] = useState('');
  const [dragging, setDragging] = useState(false);
  const q = query.trim().toLowerCase();
  const files = uploads.filter((u) => u.name.toLowerCase().includes(q));

  return (
    <>
      <section className="archive-section" aria-labelledby="archive-title">
        <div className="library-heading">
          <h2 id="archive-title">
            Radar archive <span>{archiveDays.length}</span>
          </h2>
          <span className="archive-hint">Full days loaded from a .zip file or a folder</span>
        </div>
        {archiveDays.length ? (
          <div className="archive-days">
            {archiveDays.map((d) => {
              const missing = d.gaps.reduce((n, g) => n + g.missing_volumes, 0);
              return (
                <article key={d.date} className="archive-day">
                  <header>
                    <CalendarDays size={17} />
                    <div>
                      <strong>{formatDay(d.date)}</strong>
                      <span>
                        {d.site.name} · {d.volume_count}/{d.expected_volumes} volumes
                      </span>
                    </div>
                    <span className="data-badge observed">Observed</span>
                  </header>
                  <dl>
                    <div>
                      <dt>Peak</dt>
                      <dd>
                        <i
                          style={{
                            background:
                              d.summary.peak_dbz === null ? '#dce2dc' : colorFor(d.summary.peak_dbz),
                          }}
                        />
                        {d.summary.peak_dbz ?? '—'} dBZ
                      </dd>
                    </div>
                    <div>
                      <dt>Largest area ≥ 35 dBZ</dt>
                      <dd>{Math.round(d.summary.max_area_35_km2).toLocaleString()} km²</dd>
                    </div>
                    <div>
                      <dt>Gaps</dt>
                      <dd>{missing ? `${missing} missing volume${missing === 1 ? '' : 's'}` : 'Complete'}</dd>
                    </div>
                    <div>
                      <dt>Profile</dt>
                      <dd>
                        {d.profile_deviations.length
                          ? `${d.profile_deviations.length} deviation(s)`
                          : 'Matches MBL scan'}
                      </dd>
                    </div>
                  </dl>
                  <button className="btn btn-outline" onClick={() => onOpenDay(d.date)}>
                    Open day <ArrowUpRight size={14} />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="insight-empty">
            {service
              ? 'No days loaded yet. Upload a .zip file or a folder of .nc files below.'
              : 'The data service is not running. Start it with npm run backend.'}
          </p>
        )}
      </section>
      <div
        className={`library-import ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files[0]) onUpload(e.dataTransfer.files[0]);
        }}
      >
        <div className="upload-symbol">
          {busy ? <LoaderCircle className="spin" size={24} /> : <Upload size={24} strokeWidth={1.4} />}
        </div>
        <div>
          <h2>Upload radar data</h2>
          <p>
            Choose a single .nc file, a .zip file of a day, or a folder of .nc files. A .zip file or folder is
            loaded as full days.
          </p>
          <span>{service ? 'Data service connected' : 'Data service not running: start it with npm run backend'}</span>
        </div>
        <div className="library-import-actions">
          <button className="btn btn-outline" disabled={busy} onClick={onChoose}>
            {busy ? 'Please wait…' : 'Choose file'}
          </button>
          <button className="btn btn-outline" disabled={busy} onClick={onChooseFolder}>
            Choose folder
          </button>
        </div>
      </div>
      <div className="library-heading">
        <h2>
          Single files <span>{uploads.length}</span>
        </h2>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search radar files"
            placeholder="Search files…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="file-table-wrap">
        <table className="file-table">
          <thead>
            <tr>
              <th>File name</th>
              <th>Scan time</th>
              <th>Type</th>
              <th>Status</th>
              <th>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {files.map((u) => (
              <tr key={u.id}>
                <td>
                  <FileText size={17} />
                  <div>
                    <strong>{u.name}</strong>
                    <span>
                      {(u.size / 1048576).toFixed(2)} MiB · {u.fields.length} reflectivity field
                      {u.fields.length === 1 ? '' : 's'} · {u.sweeps} sweep{u.sweeps === 1 ? '' : 's'}
                    </span>
                  </div>
                </td>
                <td>From file</td>
                <td>NetCDF</td>
                <td>
                  <span className="ready-state">
                    <Check size={12} />
                    Loaded
                  </span>
                </td>
                <td>
                  <button className="text-button" disabled={!u.fields.length} onClick={() => onOpenUpload(u)}>
                    Open <ArrowUpRight size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${u.name}`}
                    onClick={() => onRemoveUpload(u)}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Export metadata for ${u.name}`}
                    onClick={() => download(`${u.name}.metadata.json`, JSON.stringify(u, null, 2))}
                  >
                    <Download size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!files.length && (
          <div className="empty-search">
            <Search size={24} />
            {q ? (
              <>
                <h3>No matching files</h3>
                <p>Try a different filename or clear your search.</p>
                <button className="btn btn-outline" onClick={() => setQuery('')}>
                  Clear search
                </button>
              </>
            ) : (
              <>
                <h3>No single files uploaded</h3>
                <p>Files chosen one at a time with Choose file appear here.</p>
              </>
            )}
          </div>
        )}
      </div>
      <p className="workspace-footnote">
        Single .nc files are removed when the data service stops. Days loaded from a .zip file or folder are
        kept.
      </p>
    </>
  );
}
