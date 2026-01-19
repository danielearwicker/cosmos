# Search

The vault provides search capabilities for finding files by various criteria.

## ✅ Filename Search

Search files by their display name.

### Behavior

- **Scope**: Searches file display names only
- **Case-insensitive**: Search terms are matched regardless of case
- **Substring matching**: Files are shown if their name contains the search term anywhere
- **Real-time filtering**: Results update as you type
- **No debounce**: Filtering is instant (computed via `useMemo`)

### Implementation

```typescript
const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return state.items;
    return state.items.filter((item) =>
        item.name.toLowerCase().includes(term)
    );
}, [state.items, search]);
```

### UI

The search box appears in the toolbar at the top of the vault:

```
┌─────────────────────────────────────────────────────────┐
│ [Search files...                        ]  [Upload]     │
├─────────────────────────────────────────────────────────┤
│ (filtered file list)                                    │
```

- Placeholder text: "Search files..."
- Full width with upload button to the right
- Standard text input styling

### Styling

```css
.vault .toolbar .search {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 1rem;
    background-color: #444;
    color: #ddd;
}
```

### Performance

Search operates on the in-memory item list, which is already loaded as part of the vault's state. For typical use cases (hundreds to low thousands of files), this provides instant results without server round-trips.

### Clearing Search

- Simply clear the search input to show all files
- No separate "clear" button is provided

## ✅ Search by Tag

Filter files using tag-based search syntax.

### Syntax

```
tag:important
tag:work tag:urgent
```

### Behavior

- `tag:name` filters to files containing that tag
- Multiple `tag:` terms use AND logic
- Can combine with filename search: `report tag:work`

### Implementation

The search term is parsed to extract `tag:` patterns:

```typescript
const searchTerm = search.toLowerCase().trim();
const tagMatches = searchTerm.match(/tag:(\S+)/g);
const searchTags = tagMatches ? tagMatches.map(t => t.substring(4)) : [];
const filenameSearch = searchTerm.replace(/tag:\S+/g, '').trim();
```

Tag filtering uses AND logic (all specified tags must be present):

```typescript
if (searchTags.length > 0) {
    items = items.filter((item) =>
        searchTags.every((tag) => item.tags.includes(tag))
    );
}
```

The filename search is applied after removing all `tag:` patterns from the search term.

## ✅ Search by Date Range

Filter files by their upload date.

### Syntax

```
after:2024-01-01
before:2024-12-31
after:2024-01-01 before:2024-06-30
```

### Behavior

- `after:YYYY-MM-DD` shows files added on or after that date
- `before:YYYY-MM-DD` shows files added on or before that date
- Both can be combined for a date range
- Can combine with other search terms

### Implementation

The search term is parsed to extract `after:` and `before:` patterns:

```typescript
const afterMatch = searchTerm.match(/after:(\S+)/);
const beforeMatch = searchTerm.match(/before:(\S+)/);
const afterDate = afterMatch ? new Date(afterMatch[1]) : null;
const beforeDate = beforeMatch ? new Date(beforeMatch[1]) : null;
```

Date filtering compares the file's `added` timestamp:

```typescript
if (afterDate && !isNaN(afterDate.getTime())) {
    items = items.filter((item) => {
        const itemDate = new Date(item.added);
        return itemDate >= afterDate;
    });
}
if (beforeDate && !isNaN(beforeDate.getTime())) {
    items = items.filter((item) => {
        const itemDate = new Date(item.added);
        return itemDate <= beforeDate;
    });
}
```

The date patterns are removed from the search term along with `tag:` patterns before applying filename search.

## ✅ Search by File Type

Filter files by MIME type category.

### Syntax

```
type:pdf
type:image
type:video
```

### Recognized Types

| Keyword | Matches |
|---------|---------|
| `pdf` | `application/pdf` |
| `image` | `image/*` |
| `video` | `video/*` |
| `audio` | `audio/*` |
| `text` | `text/*` |
| `document` | Word, Excel, PowerPoint files |
| `archive` | zip, rar, 7z, gzip |

### Behavior

- `type:keyword` filters to files matching that MIME type category
- Multiple `type:` terms use OR logic (any match includes the file)
- Can combine with other search terms: `report type:pdf tag:work`

### Implementation

The search term is parsed to extract `type:` patterns:

```typescript
const typeMatches = searchTerm.match(/type:(\S+)/g);
const searchTypes = typeMatches ? typeMatches.map(t => t.substring(5)) : [];
```

Type filtering uses OR logic (any specified type can match):

```typescript
if (searchTypes.length > 0) {
    items = items.filter((item) =>
        searchTypes.some((type) => matchesFileType(item.type, type))
    );
}
```

The `matchesFileType` function maps keywords to MIME type patterns:

```typescript
function matchesFileType(mimeType: string, typeKeyword: string): boolean {
    const mime = mimeType.toLowerCase();
    const keyword = typeKeyword.toLowerCase();

    switch (keyword) {
        case "pdf": return mime === "application/pdf";
        case "image": return mime.startsWith("image/");
        case "video": return mime.startsWith("video/");
        case "audio": return mime.startsWith("audio/");
        case "text": return mime.startsWith("text/");
        case "document": return /* Word/Excel/PowerPoint MIME types */;
        case "archive": return /* zip/rar/7z/gzip MIME types */;
        default: return false;
    }
}
```

The type patterns are removed from the search term along with other syntax patterns before applying filename search.

## ✅ Search Result Highlighting

Matching terms are highlighted in the file list.

### Behavior

- Matched portions of filenames are highlighted with a background color
- Uses `<mark>` elements with the `search-highlight` class
- Highlights update in real-time as search term changes
- Case-insensitive matching (same as the search filtering)
- Only highlights the filename search term (ignores `tag:`, `type:`, `before:`, `after:` syntax)

### Implementation

The highlighting is implemented in the `VaultItemRow` component using a helper function:

```typescript
function renderHighlightedName() {
    if (!searchHighlight) {
        return item.name;
    }

    const lowerName = item.name.toLowerCase();
    const lowerSearch = searchHighlight.toLowerCase();
    const index = lowerName.indexOf(lowerSearch);

    if (index === -1) {
        return item.name;
    }

    const before = item.name.substring(0, index);
    const match = item.name.substring(index, index + searchHighlight.length);
    const after = item.name.substring(index + searchHighlight.length);

    return (
        <>
            {before}
            <mark className="search-highlight">{match}</mark>
            {after}
        </>
    );
}
```

The filename search term is extracted from the full search input by removing all search syntax patterns:

```typescript
const filenameSearchTerm = searchTerm
    .replace(/tag:\S+/g, '')
    .replace(/after:\S+/g, '')
    .replace(/before:\S+/g, '')
    .replace(/type:\S+/g, '')
    .trim();
```

### Styling

```css
.vault .item .name .search-highlight {
    background: rgba(255, 200, 0, 0.3);
    border-radius: 2px;
    color: inherit;
}
```
