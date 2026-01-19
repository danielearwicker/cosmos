# File Management

The Vault application provides secure file storage with upload, download, rename, and organization capabilities.

## ✅ File Metadata

Each file is represented by a `VaultItem`:

```typescript
type VaultItem = {
    id: string; // Blob storage path (e.g., "files/uuid")
    name: string; // Display name (original filename)
    type: string; // MIME type
    added: string; // ISO 8601 UTC datetime when uploaded
    created?: string; // ISO 8601 UTC datetime when content was created (from EXIF/metadata)
    tags: string[]; // User-assigned tags
    uploadState: UploadState;
    uploadProgress?: UploadProgress;
    currentPage?: number; // For PDFs: last viewed page
    properties?: Record<string, any>; // File metadata (e.g., EXIF data for images)
};

type UploadState = "queued" | "uploading" | "complete";

type UploadProgress = {
    uploaded: number;
    total: number;
};
```

## ✅ File Upload

### Process

1. **User selects files** via a file input (multiple selection supported)

2. **Immediate queuing**: All selected files are added to the item list immediately with:
    - `uploadState: "queued"`
    - `uploadProgress: { uploaded: 0, total: file.size }`
    - `tags: ["new"]` (default tag for new uploads)

3. **Sequential upload**: Files are uploaded one at a time:
    - State changes to `"uploading"`
    - Chunked upload with progress callbacks updates `uploadProgress`
    - State changes to `"complete"` when done

4. **Reset input**: The file input is reset after processing to allow re-selecting the same files:
    ```typescript
    ev.target.value = "";
    ```

### Blob Naming

Files are stored with path-like blob names:

```
{user}-files/{uuid}
```

The `files/` prefix acts as a folder, keeping uploaded files organized separately from application metadata.

### Progress Indication

During upload:

- A progress bar appears at the top of the item card
- The upload state shows "Queued" or "Uploading X%"
- The item card is visually dimmed (reduced opacity)
- Progress bar uses green gradient (`#4a8` to `#6c6`)

## ✅ File Download

### Process

1. **Click Download button**
2. **Progress indication**: If chunked download is available:
    - Download button shows percentage
    - Blue progress bar appears (`#48a` to `#66c`)
    - Button is disabled during download
3. **Trigger browser download**:
    ```typescript
    const blob = new Blob([payload.data], { type: item.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.name; // Uses display name, not blob ID
    a.click();
    URL.revokeObjectURL(url);
    ```

## ✅ File Delete

### Interaction

1. **Click Delete button** on the file item
2. **Confirmation dialog** appears asking "Delete {filename}?"
3. **Confirm**: Click "Delete" to permanently remove the file
4. **Cancel**: Click "Cancel" or press Escape to abort

### Process

1. Delete the blob from storage using the storage backend
2. Remove the item from the local state
3. Update persisted metadata

### Notes

- Deletion is permanent; there is no undo or trash/recycle bin
- The blob is deleted from cloud storage, freeing space
- If deletion fails (e.g., network error), the item remains in the list and an error is shown

## ✅ File Rename

### Interaction

1. **Click filename** or **click Rename button** to enter edit mode
2. **Inline text input** replaces the filename display
3. **Confirm**: Press Enter or click away (blur)
4. **Cancel**: Press Escape

### Validation

- Name is trimmed of whitespace
- Empty names are rejected (reverts to original)
- Names unchanged from original don't trigger an update

### Note

Renaming only changes the display name in metadata. The blob storage path (`id`) remains unchanged.

## ✅ File Type Icons

Files display an icon based on MIME type:

| MIME Type                                                                                                                            | Icon |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| `image/*`                                                                                                                            | 🖼️   |
| `video/*`                                                                                                                            | 🎬   |
| `audio/*`                                                                                                                            | 🎵   |
| `text/*`                                                                                                                             | 📝   |
| `font/*`                                                                                                                             | 🔤   |
| `application/pdf`                                                                                                                    | 📕   |
| `application/zip`, `application/x-zip-compressed`, `application/x-rar-compressed`, `application/x-7z-compressed`, `application/gzip` | 📦   |
| `application/json`, `application/xml`                                                                                                | 📋   |
| `application/javascript`, `application/typescript`                                                                                   | 📜   |
| `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`                                      | 📘   |
| `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`                                      | 📗   |
| `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`                         | 📙   |
| Unknown/other                                                                                                                        | 📄   |

The icon appears before the MIME type text in the file's metadata row.

## ✅ UI Layout

Each file item displays:

```
┌─────────────────────────────────────────────────────────┐
│ [progress bar - only during upload/download]            │
├─────────────────────────────────────────────────────────┤
│ filename.pdf                          │ [Read]          │
│                                       │ [Download]      │
│ 📕 application/pdf  1/17/2026  [tag] [+]  │ [Rename]       │
│                                       │ [Delete]        │
└─────────────────────────────────────────────────────────┘
```

- **Name row**: Filename (clickable to rename)
- **Actions**: Buttons on the right (Read for PDFs, Download, Rename, Delete)
- **Meta row**: Icon + MIME type, date added, tags with add button

## ✅ State Management

The vault uses a reducer pattern with `useStorageBackedState`:

```typescript
type VaultAction =
    | { type: "LOAD"; state: VaultState }
    | { type: "ITEM_ADD"; item: VaultItem }
    | { type: "ITEM_DELETE"; id: string }
    | { type: "ITEM_RENAME"; id: string; name: string }
    | { type: "ITEM_TAG_ADD"; id: string; tag: string }
    | { type: "ITEM_TAG_REMOVE"; id: string; tag: string }
    | { type: "ITEM_SET_UPLOAD_STATE"; id: string; uploadState: UploadState }
    | {
          type: "ITEM_SET_UPLOAD_PROGRESS";
          id: string;
          uploaded: number;
          total: number;
      }
    | { type: "ITEM_SET_CURRENT_PAGE"; id: string; page: number };
```

All actions are queued and persisted, ensuring no user changes are lost.

## ✅ Filter by file types

The main Files view by default shows all types of files. But there is a Types button that pops up a list of distinct file types, taken from the items, allowing the user to set a filter so only a specific type of file is shown.

### Interaction

1. **Click the Types button** in the toolbar
2. **Dropdown appears** showing:
   - "All types" option at the top
   - List of all distinct MIME types found in the current items
   - Each type is displayed with its icon and MIME type string
3. **Select a type** to filter the file list to only show files of that type
4. **The button label updates** to show the active filter (e.g., "Types (application/pdf)")
5. **Click "All types"** to remove the filter and show all files again

### UI

The Types button is positioned in the toolbar between "Manage Tags" and the upload button. The dropdown is positioned absolutely below the button and includes:

- A max height with scrolling for long lists
- Hover states for better usability
- Visual indication of the currently active filter

### Implementation

- The list of distinct file types is computed using `useMemo` from the current items
- The active filter is stored in component state (`activeTypeFilter`)
- The filtering is integrated into the main `filteredItems` memo, working alongside tag and search filters
- Clicking outside the dropdown closes it automatically
