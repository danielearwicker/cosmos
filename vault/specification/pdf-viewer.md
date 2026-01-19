# PDF Viewer

The vault includes a progressive PDF viewer that loads encrypted PDF files on-demand, displaying pages without requiring the entire file to be downloaded first.

## ✅ Key Features

-   **Progressive loading**: Only downloads chunks needed for the current view
-   **Chunk caching**: Previously loaded chunks are cached in memory
-   **Page persistence**: Remembers the last viewed page per document
-   **Zoom controls**: Scale from 50% to 300%
-   **Keyboard navigation**: Full keyboard support for navigation

## ✅ Technology

-   **PDF.js**: Mozilla's PDF rendering library (v3.x legacy build)
-   **PDFDataRangeTransport**: Custom data transport for on-demand byte range loading
-   **EncryptedPDFSource**: Adapter that maps PDF.js byte requests to encrypted chunks

## ✅ Opening PDFs

PDF files (MIME type `application/pdf`) show a "Read" button in addition to Download and Rename. Clicking Read opens the PDF viewer, replacing the file list view.

## ✅ Progressive Loading Architecture

### EncryptedPDFSource

The `EncryptedPDFSource` class provides byte-range access over encrypted chunked storage:

```typescript
class EncryptedPDFSource {
    // Initialize: get total size, calculate chunk count
    async initialize(): Promise<number>;

    // Read arbitrary byte range (handles chunk boundaries)
    async read(offset: number, length: number): Promise<Uint8Array>;

    // Clear cache to free memory
    clearCache(): void;
}
```

### Chunk Mapping

When PDF.js requests bytes, EncryptedPDFSource:

1. Calculates which encrypted chunks contain those bytes
2. Downloads and decrypts any chunks not already cached
3. Extracts the requested byte range from the decrypted chunks
4. Returns the data to PDF.js

```typescript
async read(offset: number, length: number): Promise<Uint8Array> {
    const result = new Uint8Array(length);
    let remaining = length;
    let currentOffset = offset;

    while (remaining > 0) {
        const chunkIndex = Math.floor(currentOffset / CHUNK_SIZE);
        const chunk = await this.getChunk(chunkIndex);  // Cached or fetched
        // ... extract bytes from chunk
    }

    return result;
}
```

### PDFDataRangeTransport

PDF.js uses `PDFDataRangeTransport` for progressive loading:

```typescript
const transport = new pdfjsLib.PDFDataRangeTransport(length, null);

transport.requestDataRange = (begin: number, end: number) => {
    source.read(begin, end - begin).then((data) => {
        transport.onDataRange(begin, data);
    });
};

const pdf = await pdfjsLib.getDocument({
    range: transport,
    length,
}).promise;
```

PDF.js calls `requestDataRange()` whenever it needs bytes it doesn't have. The transport asynchronously provides the data via `onDataRange()`.

## ✅ Page Navigation

### Controls

-   **Previous/Next buttons**: ◀ and ▶ in the toolbar
-   **Page indicator**: Shows "X / Y" (current page / total pages)
-   **Direct page input**: Click on page number to type a specific page

### Page Input

1. Click on the page indicator (e.g., "5 / 42")
2. A text input appears with the current page number
3. Type a new page number
4. Press Enter to navigate, or Escape to cancel
5. Click away (blur) also confirms the navigation

Invalid page numbers (non-numeric, out of range) are ignored.

### Keyboard Shortcuts

| Key                  | Action        |
| -------------------- | ------------- |
| ← / PageUp           | Previous page |
| → / PageDown / Space | Next page     |
| Escape               | Close viewer  |
| + / =                | Zoom in       |
| -                    | Zoom out      |

## ✅ Zoom

### Controls

-   **Zoom out button**: − (decreases by 25%)
-   **Zoom indicator**: Shows percentage (e.g., "150%")
-   **Zoom in button**: + (increases by 25%)

### Range

-   Minimum: 50%
-   Maximum: 300%
-   Default: 150%
-   Step: 25%

### Scrolling

When zoomed in beyond the viewport size:

-   The canvas container becomes scrollable
-   Both horizontal and vertical scrolling are supported
-   The page is centered when smaller than the viewport

## ✅ Page Persistence

The current page is saved to the file's metadata:

```typescript
useEffect(() => {
    if (currentPage !== item.currentPage) {
        dispatch({
            type: "ITEM_SET_CURRENT_PAGE",
            id: item.id,
            page: currentPage,
        });
    }
}, [currentPage, item.id, item.currentPage, dispatch]);
```

When reopening a PDF, it automatically opens to the last viewed page:

```typescript
const [currentPage, setCurrentPage] = useState(item.currentPage ?? 1);
```

## ✅ Loading States

### Initial Load

While fetching the PDF structure:

```
Loading PDF structure...
```

### Page Load

When navigating to a page that requires new chunks:

```
Loading page...
```

This appears in the toolbar while the page is being fetched and rendered.

### Chunk Progress

During loading, the toolbar shows chunk progress:

```
Chunks: 3/12
```

This indicates how many encrypted chunks have been loaded out of the total.

## ✅ Error Handling

If the PDF fails to load, an error message is displayed:

```
Error loading PDF: [error message]
```

The Close button remains available to return to the file list.

## ✅ UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [Close]  Document.pdf   ◀ [5/42] ▶   [−] 150% [+]  Loading...  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                    ┌───────────────────┐                        │
│                    │                   │                        │
│                    │    PDF Page       │                        │
│                    │    Canvas         │                        │
│                    │                   │                        │
│                    └───────────────────┘                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Tags: [books] [physics] [+]                                     │
└─────────────────────────────────────────────────────────────────┘
```

The canvas is centered in the viewport with a drop shadow, scrollable when larger than the container.

## ✅ Styling

Key CSS classes:

```css
.pdf-viewer {
    /* Full-height flex container */
}
.pdf-toolbar {
    /* Fixed header with controls */
}
.pdf-canvas-container {
    /* Scrollable area */
}
.pdf-page-wrapper {
    /* Centers the canvas */
}
.pdf-loading {
    /* Loading state display */
}
.pdf-error {
    /* Error state display */
}
```

## ✅ PDF.js Worker

PDF.js uses a Web Worker for CPU-intensive operations. The worker is loaded from CDN:

```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
```

**Important**: Use the legacy build (`pdfjs-dist/legacy/build/pdf`) and matching CDN worker version. The modern ESM build uses `import.meta` which may not be supported by all bundlers.

## ✅ Memory Management

When the PDF viewer is closed:

1. The PDF document is destroyed: `pdfDocument.destroy()`
2. The chunk cache is cleared: `source.clearCache()`
3. React state is cleaned up via effect cleanup functions

This ensures memory is released when navigating away from the viewer.

## ✅ Tag Bar

At the bottom of the PDF viewer there is a bar showing tags and allowing them to be added/removed, exactly like the tag manipulation shown on each file in the file list.

### Layout

The tag bar appears at the bottom of the PDF viewer, below the canvas container:

```
┌─────────────────────────────────────────────────────────────────┐
│ [Close]  Document.pdf   ◀ [5/42] ▶   [−] 150% [+]              │
├─────────────────────────────────────────────────────────────────┤
│                    PDF Canvas Area                              │
├─────────────────────────────────────────────────────────────────┤
│ Tags: [books] [physics] [+]                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Features

- **Display tags**: Shows all tags assigned to the PDF as chips
- **Remove tags**: Click the × button on any tag to remove it
- **Add tags**: Click the + button to open the tag dropdown
- **Autocomplete**: Suggests existing tags from the vault
- **Create new tags**: Type a new tag name and create it

### Implementation

The tag bar uses the same React components and state management as the file list:
- `ITEM_TAG_ADD` action to add tags
- `ITEM_TAG_REMOVE` action to remove tags
- Shared autocomplete logic with suggested tags
- Same styling and interaction patterns

### Styling

The tag bar has a dark background matching the PDF viewer toolbar, with a border separating it from the canvas area. The dropdown opens upward (bottom to top) since the tag bar is at the bottom of the screen.
