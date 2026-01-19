# Vault - Encrypted File Storage Application

Vault is a secure, browser-based file storage application that encrypts all files client-side before uploading to cloud storage. It supports large files through chunked transfers with progress indication, and includes a progressive PDF viewer.

## Architecture Overview

The application consists of these major components:

1. **Encrypted Storage Layer** - A reusable module providing client-side encryption and cloud storage integration
2. **Vault Application** - The file management UI built on top of the encrypted storage layer
3. **PDF Viewer** - A progressive PDF viewing component with on-demand chunk loading
4. **Image Viewer** - metadata for GPS location is extracted during upload and retained, so we can show the location on a map

## Specifications

Each section below is marked with implementation status. Search for 🟦 to find unimplemented features.

### Core Infrastructure

-   [Encrypted Storage System](../../encrypted-storage/specification/README.md) - Client-side encryption, key management, and storage backends

### Vault Application

-   [File Management](./file-management.md) - Upload, download, rename, delete, and organize files
-   [Tag System](./tags.md) - Flexible tagging with autocomplete, filtering, and management
-   [Search](./search.md) - Filename search, plus advanced filtering options
-   [Timeline View](./timeline-view.md) - Chronological browsing of images with thumbnails

### PDF Viewer

-   [PDF Viewer](./pdf-viewer.md) - Progressive loading, navigation, and zoom controls

### Image Support

-   [Image Support](./image-support.md) - Extraction of properties from image formats, thumbnail generation, and HEIC conversion

## Key Design Principles

1. **Client-Side Encryption** - All encryption/decryption happens in the browser. The server never sees unencrypted data.

2. **Pure Blob Storage** - The backend is a simple blob/object store (Azure Blob Storage, S3, or equivalent) with no custom server-side logic. This rules out features that would require server-side indexing, search, or processing. All intelligence lives in the client.

3. **Progressive Loading** - Large files are split into chunks that can be loaded on demand, enabling features like PDF page viewing without downloading the entire file.

4. **Backward Compatibility** - The chunked transfer system is optional. Apps that don't need it continue to use the simple load/save interface.

5. **Offline-First Metadata** - User actions are queued locally and synced when possible, preventing data loss during connectivity issues.

## Technology Stack

-   **Frontend**: React 18, TypeScript
-   **Encryption**: Web Crypto API (AES-GCM, 256-bit)
-   **PDF Rendering**: PDF.js (v3.x legacy build for broad compatibility)
-   **Storage Backends**: Azure Blob Storage, custom Blobshop server
-   **Build**: Bun/esbuild
