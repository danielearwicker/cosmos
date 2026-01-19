# Claude Code Guidelines

## Specification-Driven Development

This project uses specification files to define features before implementation. Specs are located in `specification/` directories within each app or module.

### Implementation Status Markers

Features in specs are marked with status indicators:

- ✅ **Implemented** - Feature is complete and working
- 🟦 **Not implemented** - Feature is specified but not yet coded

### Finding Work To Do

To find unimplemented features, search for the blank square marker:

```bash
grep -r "🟦" */specification/
```

Or in your editor, search for `🟦` across the `specification/` directories.

### Writing Specs

When adding new features to a spec:

1. Write the feature as if it were already implemented
2. Mark it with 🟦 at the start of the section heading
3. Include all details: types, UI behavior, edge cases
4. When implementing, change 🟦 to ✅

Example:

```markdown
## 🟦 Export to CSV

Users can export their data to CSV format.

### Process

1. Click the "Export" button
2. Select date range
3. Download starts automatically
```

After implementation:

```markdown
## ✅ Export to CSV
...
```

### Spec Structure

Each app has a `specification/` directory containing:

- `README.md` - Overview and links to detailed specs
- Feature-specific markdown files (e.g., `file-management.md`, `tags.md`)

Specs should be detailed enough that implementation is straightforward.

## Automated Implementation

The `/implement` command picks a 🟦 feature from the spec, implements it, marks it ✅, and commits.

To run this automatically in a loop until all work is done:

```bash
node auto-implement.js <project>
```

Example:
```bash
node auto-implement.js vault
```

The script:
- Runs `/implement <project>` repeatedly
- Sleeps for 1 hour if rate-limited ("You've hit your limit")
- Exits when "NO_REMAINING_WORK" is found
- Press Ctrl+C to stop
