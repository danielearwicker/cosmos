# Timeline View

## ✅ Timeline Organization

An alternative view mode for browsing images chronologically based on their `created` date (extracted from EXIF metadata). The timeline is organized hierarchically by year, month, and day.

### Requirements

-   **Date-based Organization**: Images are grouped by:
    -   Year (e.g., "2024")
    -   Month within year (e.g., "June 2024")
    -   Day within month (e.g., "June 14, 2024")
-   **Sparse Display**: Only show date groups that contain images (skip empty years/months/days)
-   **Items Without Dates**: Images without a `created` date are excluded from the timeline view entirely
    -   Users can still access these via the file list view
    -   This keeps the timeline focused on dated content

### Hierarchy Display

The timeline uses a **collapsible hierarchy**:
-   **Years** are collapsible sections (click to expand/collapse)
-   **Months** within each year are collapsible sections
-   **Days** within each month display the actual thumbnail grid
-   Collapsed state is persisted so it's maintained across sessions

### Visual Design

-   **Thumbnails**: Display image thumbnails (200px height, varying width based on aspect ratio)
-   **Grid Layout**: Auto-fit based on screen width - thumbnails wrap to fill available space
-   **Image Info**: Filename and other details are only visible in the image viewer (keep timeline clean and visual)
-   **Date Headers**: Clear visual separation between years, months, and days
-   **Tag Indicators**: Tags are not shown on thumbnails (access via image viewer)
-   **Sort Order**: Within each day, images are sorted by creation time (most recent first)

## ✅ Virtualization

The timeline must efficiently handle thousands of images through virtualization.

### Requirements

-   **Performance**: Smooth scrolling even with 10,000+ images
-   **Virtualization Strategy**: Virtualize at the day level
    -   Each day group (with its grid of thumbnails) is a virtualized item
    -   Only render day groups that are currently visible in the viewport
    -   This balances performance with implementation complexity
-   **Scroll Position**: Maintain scroll position when switching views or returning to timeline
-   **Lazy Loading**: Thumbnail blobs are loaded progressively as day groups become visible
-   **Library**: Use a React virtualization library (e.g., `react-window` or `react-virtual`)

## ✅ Date Jump Navigation

Users need a way to quickly jump to a specific date without scrolling through the entire timeline.

### UI Interaction

A date input field (using HTML `<input type="date">`) allows users to:
-   Type a date directly (e.g., "2024-06-14")
-   Use the browser's native date picker
-   Navigate to that date in the timeline

### Behavior

-   Jumping to a date scrolls the timeline to that date group
-   If the selected date has no images, jump to the nearest date that does have images (prefer later dates)
-   The date input shows the currently visible date range as the user scrolls
-   Clear button to remove the date filter and return to the full timeline view

## ✅ View Switching

Users switch between file list view and timeline view using **tab navigation**:
-   Two tabs at the top of the vault: "Files" and "Timeline"
-   Clicking a tab switches the entire view
-   Current tab is visually highlighted
-   Tab state is persisted (user returns to their last selected view)

## ✅ Interaction with Existing Features

### Tag Filtering

Tag filtering **works in timeline view**:
-   When tags are selected in the tag filter UI, the timeline shows only images matching those tags
-   Empty date groups (after filtering) are hidden
-   Tag filtering UI is visible and consistent across both Files and Timeline views
-   Clearing tag filters restores the full timeline

### Search

Search filtering **works in timeline view**:
-   When a search query is entered, the timeline shows only images with matching filenames
-   Same behavior as tag filtering - empty date groups are hidden
-   Search UI is visible and consistent across both views

### Item Actions

-   **Click thumbnail**: Opens the image viewer (same as clicking "Read" button in file list)
-   **All other actions** (Download, Rename, Delete, tag management): Accessed via the image viewer
    -   This keeps the timeline view clean and focused on browsing
    -   The image viewer provides the full toolbar with all actions

### Sort Order

Within each day group:
-   Images are sorted by `created` time, **most recent first**
-   No secondary sort by filename (creation time is assumed to be unique enough)

## ✅ Implementation Notes

### State Management

-   Timeline view state (collapsed/expanded sections, scroll position, selected tab) should be persisted in vault state
-   Switching between Files and Timeline tabs should be instantaneous (no re-fetching or reloading)
-   The current date filter/jump value should be stored in component state (doesn't need persistence)

### Data Structure

-   Build an index of images by date for efficient lookup:
    ```typescript
    type TimelineIndex = {
        years: Map<number, YearGroup>;
    };

    type YearGroup = {
        year: number;
        months: Map<number, MonthGroup>;
        collapsed: boolean;
    };

    type MonthGroup = {
        year: number;
        month: number; // 1-12
        days: Map<number, DayGroup>;
        collapsed: boolean;
    };

    type DayGroup = {
        year: number;
        month: number;
        day: number;
        items: VaultItem[]; // Sorted by created time, most recent first
    };
    ```
-   Index structure updates automatically when images are added/removed/modified
-   Only include items that have a `created` property and `type` starting with "image/"

### Libraries

-   Use a virtual scrolling library: `react-window` or `react-virtual`
-   Date formatting: Use `Intl.DateTimeFormat` for localized date displays
-   Date parsing: Parse ISO 8601 `created` strings into Date objects

### Performance Considerations

-   Build the timeline index once on mount, then incrementally update it
-   Thumbnail loading should be lazy (only fetch when day group becomes visible)
-   Consider caching thumbnail blobs in memory (with size limits)
-   Collapsed sections should not render their children (performance optimization)
