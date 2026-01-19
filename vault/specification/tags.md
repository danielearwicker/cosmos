# Tag System

Tags provide flexible organization for files in the vault. Users can assign multiple tags to each file and filter by tags.

## ✅ Tag Properties

- **Lowercase**: All tags are automatically converted to lowercase
- **Trimmed**: Leading and trailing whitespace is removed
- **Unique per file**: Duplicate tags on the same file are prevented
- **No empty tags**: Empty or whitespace-only tags are rejected

## ✅ Tag Display

Tags appear as "chips" (pill-shaped badges) in the file's metadata row:

```
[documents] [important] [2024] [+]
```

Each tag chip shows:
- The tag text
- A small "×" button to remove the tag

## ✅ Adding Tags

### Interaction

1. **Click the [+] button** next to existing tags
2. **Dropdown appears** with:
   - Text input field at top
   - List of suggested tags (existing tags from other files)
3. **Type to filter**: Suggestions narrow as you type
4. **Select existing tag**: Click a suggestion to add it
5. **Create new tag**: If your input doesn't match any existing tag, a "Create" option appears:
   ```
   Create "my-new-tag"
   ```
6. **Keyboard support**:
   - Enter: Create/add the typed tag
   - Escape: Cancel and close dropdown

### Autocomplete Logic

The suggestion list shows:
1. All tags used anywhere in the vault
2. Filtered to exclude tags already on this file
3. Further filtered by the typed input (substring match)
4. Sorted alphabetically

```typescript
const suggestedTags = allTags.filter(
    (t) => !item.tags.includes(t) && (!term || t.includes(term))
);
```

### "Create" Option

The "Create" option appears when:
1. The input is not empty (after trimming and lowercasing)
2. The input doesn't exactly match any suggested tag
3. The input isn't already a tag on this file

```typescript
const showCreateOption =
    tagInput.trim() &&
    !suggestedTags.includes(tagInput.toLowerCase().trim()) &&
    !item.tags.includes(tagInput.toLowerCase().trim());
```

## ✅ Removing Tags

1. **Click the × button** on any tag chip
2. Tag is immediately removed
3. No confirmation dialog

## ✅ Default Tags

New uploads automatically receive the `"new"` tag. Users can remove this tag or add additional tags.

## ✅ Tag Normalization

When adding a tag (either from autocomplete or by typing):

```typescript
case "ITEM_TAG_ADD": {
    const tag = action.tag.toLowerCase().trim();
    if (!tag) return old;  // Reject empty
    return {
        ...old,
        items: old.items.map((item) =>
            item.id === action.id && !item.tags.includes(tag)
                ? { ...item, tags: [...item.tags, tag] }
                : item
        ),
    };
}
```

This ensures consistent tag formatting regardless of how the user types it.

## ✅ UI Styling

```css
.tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.15rem 0.4rem;
    background: #446;
    border-radius: 12px;
    font-size: 0.8rem;
}

.add-tag-btn {
    padding: 0.15rem 0.4rem;
    background: #333;
    border: 1px dashed #555;
    border-radius: 12px;
    color: #888;
}
```

The dropdown is absolutely positioned below the [+] button and includes proper z-index for layering.

## ✅ Filter by Tag

Clicking a tag chip filters the file list to show only files with that tag.

### Interaction

1. **Click any tag chip** (not the × button)
2. **File list filters** to show only files containing that tag
3. **Active filter indicator** appears in the toolbar showing the selected tag
4. **Click the indicator** to remove that filter, or click "Clear all" to remove all filters

### Multiple Tag Filtering

- Clicking additional tags adds them to the filter (AND logic)
- Only files with all selected tags are shown
- Each active tag appears in the toolbar filter area

### Implementation

The filter state is managed via React state:

```typescript
const [activeTagFilters, setActiveTagFilters] = useState<string[]>([]);

function toggleTagFilter(tag: string) {
    setActiveTagFilters((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
}
```

Filtering is performed using `useMemo` for performance:

```typescript
const filteredItems = useMemo(() => {
    let items = state.items;

    // Filter by active tag filters (AND logic)
    if (activeTagFilters.length > 0) {
        items = items.filter((item) =>
            activeTagFilters.every((tag) => item.tags.includes(tag))
        );
    }

    // Filter by search term
    const term = search.toLowerCase().trim();
    if (term) {
        items = items.filter((item) =>
            item.name.toLowerCase().includes(term)
        );
    }

    return items;
}, [state.items, search, activeTagFilters]);
```

### UI

When filters are active, a filter bar appears below the toolbar:

```
┌─────────────────────────────────────────────────────────┐
│ [Search files...                        ]  [Upload]     │
├─────────────────────────────────────────────────────────┤
│ Filtered by tags: [work ×] [urgent ×]  [Clear all]     │
├─────────────────────────────────────────────────────────┤
│ (filtered file list)                                    │
```

Tags that are currently active filters are highlighted in the file list with a distinct background color and border to show they are filtering the view.

### Styling

```css
.vault .active-filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #1a1a2a;
    border-radius: 4px;
    flex-wrap: wrap;
}

.vault .item .tag.active-filter {
    background: #558;
    box-shadow: 0 0 0 2px #77a;
}

.vault .item .tag .tag-text {
    cursor: pointer;
}
```

## ✅ Tag Management

A tag management panel allows bulk operations on tags.

### Access

Click "Manage Tags" in the toolbar.

### Features

- **View all tags** with usage counts
- **Rename a tag** globally (updates all files using it)
- **Delete a tag** globally (removes from all files)
- **Merge tags** (combine two tags into one)

### Confirmation

Destructive operations (delete, merge) show a confirmation dialog listing affected files.

## ✅ Tag Colors

Tags can be assigned colors for visual distinction.

### Predefined Colors

A palette of 10 colors is available:
- Red (#c55), Orange (#d83), Yellow (#cc6), Green (#6c6), Teal (#5aa), Blue (#68c), Purple (#a6c), Pink (#c6a), Gray (#888), Default (#446)

### Assignment

- Right-click a tag chip to open color picker
- Or assign colors in the Tag Management panel using the 🎨 button
- Colors are stored in a separate `tagColors` map in state

### Display

Tag chips use the assigned color as background, with automatic text color adjustment for contrast based on luminance calculation.

## ✅ Hierarchical Tags

Tags can be organized in a hierarchy using `/` as a separator.

### Examples

- `work/project-a`
- `work/project-b`
- `personal/finance`
- `personal/health`

### Behavior

- **Parent tag filtering**: When filtering by a parent tag (e.g., `work`), the system automatically includes files tagged with child tags (e.g., `work/project-a`, `work/project-b`). This works in both the tag filter bar and the `tag:` search syntax.
- **Autocomplete**: Shows all tags alphabetically, with hierarchical tags naturally grouped together
- **Tag management UI**: Displays tags in a hierarchical tree structure with collapsible/expandable parent nodes. Click the ▸/▾ button to expand/collapse child tags.
- **Virtual parent nodes**: If child tags exist (e.g., `work/project-a`) but the parent tag (e.g., `work`) is not actually used on any files, it appears as a "(virtual parent)" in the tag management panel.
