# Image Support

## ✅ Property extraction at upload time

Image file types have special support. Where an image format can contain additional properties, such as when the image was created, the device used, focal length, F number, exposure time, location (lat/long), these will be extracted in the browser during upload, using a suitable .js library, and captured as properties of the file in the metadata.

The lat/long positional properties should be captured as simple signed numbers, e.g.

```
latitude: 51.464795,
longitude: -0.473289,
```

This will make them suitable for incorporating into a map URL.

### Content Creation Date

The EXIF `DateTimeOriginal` or `CreateDate` property (equivalent to macOS `kMDItemContentCreationDate`) should be extracted and stored in the `VaultItem.created` property as an ISO 8601 UTC datetime string. This represents when the photo was actually taken, as opposed to `VaultItem.added` which represents when it was uploaded to the vault.

Example:
```typescript
{
  created: "2021-06-14T16:18:34.000Z",  // When photo was taken
  added: "2026-01-18T12:34:56.000Z"     // When uploaded to vault
}
```

## ✅ Image viewer

Image files show a "Read" button in addition to Download and Rename. Clicking Read opens the image viewer, replacing the file list view. It is similar to the PDF viewer but much simpler in implementation as it has no need for progressive loading, chunking etc.

## ✅ Mapping Support

If the image includes latitude/longitude properties, the viewer should have a _Location_ button. When clicked, this should open a map on OpenStreetMap by embedding an `iframe`, targeting a URL formed like this:

```
https://www.openstreetmap.org/?mlat=[latitude]&mlon=[longitude]
```

Example:

```
https://www.openstreetmap.org/?mlat=51.464795&mlon=-0.473289
```

## ✅ Tag Bar

At the bottom of the image viewer there is a bar showing tags and allowing them to be added/removed, exactly like the tag manipulation shown on each file in the file list.

## ✅ HEIC to JPEG Conversion Utility

A standalone Node.js script that converts Apple HEIC format images to high-quality JPEG files while preserving all EXIF metadata, particularly GPS location data.

### Purpose

Many modern Apple devices capture photos in HEIC format. While this format offers good compression, it may not be universally supported. This utility allows users to batch convert HEIC images to JPEG before uploading to the vault, ensuring compatibility while preserving metadata needed for features like location mapping.

### Requirements

-   **Directory Scanning**: Recursively scan a specified directory for `.heic` and `.HEIC` files
-   **Selective Processing**: Ignore non-HEIC files during the scan
-   **EXIF Preservation**: Preserve all EXIF metadata, especially:
    -   GPS latitude and longitude
    -   Creation date/time
    -   Camera model and settings (focal length, F-number, exposure time, ISO)
    -   Orientation flags
-   **High Quality Output**: Generate JPEG files with quality setting of 95 or higher to minimize compression artifacts
-   **Output Location**: Create JPEG files in the same directory as source files, with `.jpg` extension
-   **Error Handling**: Report files that fail to convert but continue processing remaining files

### ✅ Image Orientation Correction

The orientation of an image is encoded in the HEIC file's EXIF metadata. The `heic-convert` library automatically rotates the pixel data during conversion to match the HEIC orientation, so the resulting JPEG pixels are already correctly oriented.

The conversion script handles this by:
1. Converting HEIC to JPEG (pixels are auto-rotated by `heic-convert`)
2. Copying all EXIF metadata from HEIC **except** the Orientation tag
3. Setting Orientation=1 (normal) in the JPEG since pixels are already correctly oriented

This ensures the resulting JPEG displays correctly without requiring runtime transformation.

### Usage

```bash
node convert-heic-to-jpeg.js <directory-path>
```

Example:

```bash
node convert-heic-to-jpeg.js ~/Pictures/iPhone/2024
```

### Output

For each successfully converted file, display:

```
✓ IMG_1234.HEIC → IMG_1234.jpg (preserved 12 EXIF properties)
```

For errors:

```
✗ IMG_5678.HEIC - Failed: [error message]
```

Summary at completion:

```
Converted 45 of 47 files (2 failed)
```

### Implementation Notes

-   Should use an npm library capable of HEIC decoding and EXIF preservation (e.g., `heic-convert` with `exifr` or similar)
-   Script is run outside the vault application as a pre-processing step
-   Users run this manually before uploading photos to ensure metadata is available for vault's property extraction

## ✅ Thumbnail Generation

When an image file is uploaded to the vault, a thumbnail version is automatically generated and stored alongside the original image.

### Requirements

-   **Size**: Fixed height of 200px, width varies to maintain original aspect ratio
-   **Format**: JPEG format with 70% quality compression
-   **Aspect Ratio**: Maintain original image's aspect ratio (not cropped to square)
-   **Storage**: Thumbnails are stored with a suffixed blob ID:
    -   Original: `files/{uuid}`
    -   Thumbnail: `files/{uuid}-thumb`
-   **Generation**: Thumbnails are created in the browser during upload using Canvas API
    1. Load the uploaded image into an Image element
    2. Create a canvas with height=200px and width=originalWidth \* (200/originalHeight)
    3. Draw the scaled image to the canvas
    4. Export as JPEG with quality=0.7
    5. Upload the thumbnail blob
-   **Progressive**: Thumbnail generation and upload happens after the original image upload completes
-   **Error Handling**: If thumbnail generation fails, the original image upload continues normally (thumbnail is optional)

### Usage

Thumbnails are used in the Timeline View to provide quick visual browsing without loading full-resolution images.
