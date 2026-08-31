// Import/export for the PayGuard layout. Extracted so the tracker shell and
// the settings sheet share one implementation instead of two near-copies.

import type { TrackerData } from '../../domain/types';

export function exportTrackerJson(data: TrackerData, year: number): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payguard-${year}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importTrackerFile(file: File, replaceAll: (data: TrackerData) => void): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.streams)) {
        alert('That file does not look like a PayGuard export.');
        return;
      }
      if (confirm('Import this file? It replaces every job and month currently on this device.')) {
        replaceAll(parsed);
      }
    } catch {
      alert('Could not read that file as JSON.');
    }
  };
  reader.readAsText(file);
}
