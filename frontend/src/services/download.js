import { getToken } from './api';

const API_BASE = '/api';

/**
 * Download a file export endpoint as an authenticated browser download.
 * Handles Bearer auth, error JSON parsing, and blob download cleanup.
 */
export async function downloadExport(endpoint, params = {}, opts = {}) {
  const { filename = 'xevera-export.csv' } = opts;
  const qs = new URLSearchParams(params).toString();
  const url = API_BASE + '/' + endpoint + (qs ? '?' + qs : '');
  const token = getToken();
  const res = await fetch(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} });

  if (!res.ok) {
    let msg = 'Unable to export. Please try again.';
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 403) msg = 'You do not have permission to export these reports.';
    else if (res.status === 404) msg = 'No reports found for the selected filters.';
    else if (res.status === 401) msg = 'Your session has expired. Please sign in again.';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const blob = await res.blob();

  // Guard: if the backend returned an HTML page (PHP warning/error),
  // never save it as a document download.
  if ((blob.type || '').includes('text/html')) {
    throw new Error('The server returned an error page instead of the export file.');
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  return blob;
}

export function exportFilename(ext) {
  const d = new Date().toLocaleDateString('en-CA');
  return 'xevera-reports-' + d + '.' + ext;
}