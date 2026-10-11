/**
 * Browser-only helpers for triggering a client-side file download from
 * in-memory data (e.g. a CSV returned by the server). Kept separate from the
 * API layer so the export call stays a plain data fetch.
 */

export function downloadTextFile(filename: string, content: string, mimeType = "text/csv") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Allow the browser to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
