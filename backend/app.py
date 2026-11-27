import re
import shutil
import zipfile
from contextlib import asynccontextmanager
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import RLock
from uuid import uuid4
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from .archive import Archive
from .pipeline import DEFAULT_OUT, ingest
from .science import VERSION, inspect_netcdf, integrate, rainfall, read_scan

MAX_FILE = 64 * 1024 * 1024
MAX_SESSION = 384 * 1024 * 1024
records: dict = {}
archive = Archive()
netcdf_lock = RLock()


@asynccontextmanager
async def lifespan(app):
    with TemporaryDirectory(prefix='radar-metrology-') as directory:
        app.state.upload_directory = Path(directory)
        yield
        records.clear()


app = FastAPI(title='Radar Metrology local prototype', version='0.2.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173'], allow_methods=['GET', 'POST', 'DELETE'], allow_headers=['Content-Type'])
app.add_middleware(GZipMiddleware, minimum_size=2048)


class FormulaRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    dbz: list[float | None] = Field(min_length=1, max_length=100000)
    a: float = Field(default=200, ge=1, le=2000)
    b: float = Field(default=1.6, ge=0.5, le=3)


class RateSample(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    timestamp: str = Field(max_length=80)
    rates: list[Annotated[float, Field(ge=0, le=1e8)] | None] = Field(min_length=1, max_length=100000)


class AccumulationRequest(BaseModel):
    samples: list[RateSample] = Field(min_length=2, max_length=1000)
    max_gap_minutes: float = Field(default=15, gt=0, le=1440, allow_inf_nan=False)


@app.get('/api/health')
def health():
    return {'status': 'ok', 'mode': 'local session prototype', 'database': False, 'version': VERSION,
            'archive_days': len(archive.days())}


@app.post('/api/rainfall')
def calculate_rainfall(body: FormulaRequest):
    try:
        rates = rainfall(body.dbz, body.a, body.b)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return {'rates': rates, 'units': 'mm/hr', 'a': body.a, 'b': body.b, 'method': 'Z = 10^(dBZ/10); R = (Z/a)^(1/b)', 'version': VERSION, 'gauge_validated': False}


@app.post('/api/accumulation')
def calculate_accumulation(body: AccumulationRequest):
    try:
        return integrate([sample.model_dump() for sample in body.samples], body.max_gap_minutes)
    except (ValueError, OverflowError) as exc:
        raise HTTPException(422, str(exc))


@app.post('/api/files')
def upload_file(file: UploadFile = File(...)):
    name = (file.filename or '').replace('\\', '/').split('/')[-1]
    if not name.lower().endswith('.nc'):
        raise HTTPException(415, 'Choose a NetCDF file with the .nc extension.')
    file_id = uuid4().hex
    path = app.state.upload_directory / f'{file_id}.nc'
    size = 0; digest = sha256()
    try:
        with path.open('wb') as output:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE:
                    raise HTTPException(413, 'File exceeds the 64 MiB prototype limit.')
                if size + sum(r['size'] for r in records.values()) > MAX_SESSION:
                    raise HTTPException(413, 'Session storage is full. Remove an imported file and try again.')
                digest.update(chunk); output.write(chunk)
        with path.open('rb') as source:
            magic = source.read(8)
        if not (magic.startswith(b'CDF') or magic == b'\x89HDF\r\n\x1a\n'):
            raise HTTPException(415, 'The file does not have a supported NetCDF/HDF5 signature.')
        with netcdf_lock:
            inspection = inspect_netcdf(path)
            record = {'id': file_id, 'name': name, 'size': size, 'checksum_sha256': digest.hexdigest(), **inspection}
            records[file_id] = {**record, '_path': path}
        return record
    except HTTPException:
        path.unlink(missing_ok=True); raise
    except Exception:
        path.unlink(missing_ok=True)
        raise HTTPException(422, 'This file could not be decoded as a supported NetCDF dataset. Check the format and file integrity.')
    finally:
        file.file.close()


@app.get('/api/files')
def list_files():
    """Files held in this backend session, so a browser refresh can recover them."""
    with netcdf_lock:
        return [{k: v for k, v in record.items() if k != '_path'} for record in records.values()]


@app.get('/api/files/{file_id}/scan')
def get_scan(file_id: str, field: str, sweep: int = 0):
    with netcdf_lock:
        record = records.get(file_id)
        if not record:
            raise HTTPException(404, 'File not found in this local session. Import it again.')
        if field not in [f['name'] for f in record['fields']]:
            raise HTTPException(422, 'Choose a dBZ reflectivity field reported by inspection.')
        try:
            result = read_scan(record['_path'], field, sweep)
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        except Exception:
            raise HTTPException(422, 'This scan layout needs another radar-format adapter. Metadata inspection remains available.')
    return {**result, 'id': file_id, 'name': record['name'], 'checksum_sha256': record['checksum_sha256']}


@app.delete('/api/files/{file_id}')
def delete_file(file_id: str):
    with netcdf_lock:
        record = records.pop(file_id, None)
        if not record:
            raise HTTPException(404, 'File not found in this local session.')
        record['_path'].unlink(missing_ok=True)
    return {'removed': file_id}


# --- Import a zip archive or a folder of volumes into the processed archive ----------------------------------
#
# Flow: POST /api/imports → id; POST /api/imports/{id}/files (repeat, ≤ 500 files each); POST /api/imports/{id}/process.
# Files are kept under data/imports/{id}: the archive reads full-resolution sweeps from the original source on demand.

IMPORT_ROOT = DEFAULT_OUT.parent / 'imports'
MAX_IMPORT = 16 * 1024 ** 3      # 16 GiB per import (roughly a month of volumes)
MAX_FILES_PER_REQUEST = 500
_import_id = re.compile(r'^[0-9a-f]{32}$')


def _import_dir(import_id: str) -> Path:
    if not _import_id.match(import_id):
        raise HTTPException(404, 'Unknown import.')
    path = IMPORT_ROOT / import_id
    if not path.is_dir():
        raise HTTPException(404, 'Unknown import. Start the upload again.')
    return path


def _dir_size(path: Path) -> int:
    return sum(f.stat().st_size for f in path.iterdir() if f.is_file())


@app.post('/api/imports')
def create_import():
    import_id = uuid4().hex
    (IMPORT_ROOT / import_id).mkdir(parents=True, exist_ok=True)
    return {'id': import_id}


@app.post('/api/imports/{import_id}/files')
def add_import_files(import_id: str, files: list[UploadFile] = File(...)):
    folder = _import_dir(import_id)
    if len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(413, f'Send at most {MAX_FILES_PER_REQUEST} files per request.')
    total = _dir_size(folder)
    saved = 0
    for upload in files:
        try:
            name = (upload.filename or '').replace('\\', '/').split('/')[-1].strip()
            if not name or name.startswith('.') or not name.lower().endswith(('.nc', '.zip')):
                continue  # silently skip non-radar files picked up from a folder
            target = folder / name
            n = 1
            while target.exists():  # same file name in two sub-folders
                target = folder / f'{Path(name).stem}__{n}{Path(name).suffix}'; n += 1
            with target.open('wb') as out:
                while chunk := upload.file.read(1024 * 1024):
                    total += len(chunk)
                    if total > MAX_IMPORT:
                        out.close(); target.unlink(missing_ok=True)
                        raise HTTPException(413, 'This upload is larger than the 16 GiB limit.')
                    out.write(chunk)
            if target.suffix.lower() == '.zip' and not zipfile.is_zipfile(target):
                target.unlink(missing_ok=True)
                raise HTTPException(415, f'{name} is not a valid zip file.')
            saved += 1
        finally:
            upload.file.close()
    return {'saved': saved}


@app.post('/api/imports/{import_id}/process')
def process_import(import_id: str):
    folder = _import_dir(import_id)
    sources = [str(p) for p in folder.glob('*.zip')]
    if any(folder.glob('*.nc')):
        sources.append(str(folder))
    try:
        if not sources:
            raise ValueError('No .nc or .zip files were received.')
        with netcdf_lock:
            catalogs = ingest(sources, DEFAULT_OUT, log=lambda *_: None)
    except ValueError as exc:
        shutil.rmtree(folder, ignore_errors=True)
        msg = str(exc)
        if 'No CfRadial volumes' in msg:
            msg = 'No radar volumes were found. Files must be CfRadial .nc files named like cfrad.YYYYMMDD_HHMMSS…'
        raise HTTPException(422, msg)
    except zipfile.BadZipFile:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(415, 'The zip file could not be read.')
    return {'days': [{'date': c['date'], 'volume_count': c['volume_count'], 'failures': len(c['failures'])}
                     for c in catalogs]}


# --- Processed radar archive (see backend/pipeline.py) -------------------------------------------------------

def _archive_call(fn, *args):
    try:
        return fn(*args)
    except KeyError:
        raise HTTPException(404, 'This day is not in the processed archive. Run the pipeline ingest first.')
    except IndexError:
        raise HTTPException(404, 'Volume index is outside this day.')
    except FileNotFoundError as exc:
        raise HTTPException(410, str(exc))
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@app.get('/api/archive')
def archive_days():
    return archive.days()


@app.get('/api/archive/{date}')
def archive_day(date: str):
    return _archive_call(archive.catalog, date)


@app.get('/api/archive/{date}/volumes/{index}/sweep')
def archive_sweep(date: str, index: int, field: str = 'DBZ', sweep: int = Query(0, ge=0, le=31)):
    with netcdf_lock:
        return _archive_call(archive.sweep, date, index, field, sweep)


@app.get('/api/archive/{date}/volumes/{index}/product')
def archive_product(date: str, index: int):
    return _archive_call(archive.product, date, index)


@app.get('/api/archive/{date}/accumulation')
def archive_accumulation(date: str, a: float = Query(200, ge=1, le=2000), b: float = Query(1.6, ge=0.5, le=3),
                         start: int = Query(0, ge=0), end: int | None = Query(None, ge=1),
                         max_gap_minutes: float = Query(15, gt=0, le=1440)):
    return _archive_call(archive.accumulation, date, a, b, start, end, max_gap_minutes)


@app.get('/api/archive/{date}/gate')
def archive_gate(date: str, az: float = Query(..., ge=0, le=360), range_km: float = Query(..., ge=0, le=500)):
    return _archive_call(archive.gate_series, date, az, range_km)
