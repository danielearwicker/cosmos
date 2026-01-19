#!/usr/bin/env node

/**
 * HEIC to JPEG Conversion Utility
 *
 * Converts Apple HEIC format images to high-quality JPEG files while preserving
 * all EXIF metadata, particularly GPS location data.
 *
 * Usage: node convert-heic-to-jpeg.js <directory-path>
 */

const fs = require('fs').promises;
const path = require('path');
const convert = require('heic-convert');
const exifr = require('exifr');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/**
 * Recursively finds all HEIC files in a directory
 * @param {string} dirPath - Directory to scan
 * @returns {Promise<string[]>} - Array of absolute file paths
 */
async function findHeicFiles(dirPath) {
    const files = [];

    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                const subFiles = await findHeicFiles(fullPath);
                files.push(...subFiles);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (ext === '.heic') {
                    files.push(fullPath);
                }
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${dirPath}: ${error.message}`);
    }

    return files;
}

/**
 * Converts a single HEIC file to JPEG
 * @param {string} heicPath - Path to HEIC file
 * @returns {Promise<{success: boolean, exifCount?: number, error?: string}>}
 */
async function convertHeicToJpeg(heicPath) {
    try {
        // Read the HEIC file
        const inputBuffer = await fs.readFile(heicPath);

        // Extract EXIF data before conversion
        const exifData = await exifr.parse(inputBuffer, {
            tiff: true,
            exif: true,
            gps: true,
            interop: true,
            ifd0: true,
            ifd1: true
        });

        const exifCount = exifData ? Object.keys(exifData).length : 0;

        // Convert HEIC to JPEG
        const jpegBuffer = await convert({
            buffer: inputBuffer,
            format: 'JPEG',
            quality: 0.95 // High quality (95%)
        });

        // Generate output path
        const dir = path.dirname(heicPath);
        const baseName = path.basename(heicPath, path.extname(heicPath));
        const outputPath = path.join(dir, `${baseName}.jpg`);

        // Write the initial JPEG file
        await fs.writeFile(outputPath, jpegBuffer);

        // Copy EXIF metadata from HEIC to JPEG, excluding orientation
        // heic-convert already auto-rotates pixels based on HEIC orientation,
        // so we don't want to copy the orientation tag or rotate again
        try {
            // Use the exiftool binary from exiftool-vendored.pl package
            const exiftoolPath = path.join(__dirname, 'node_modules', 'exiftool-vendored.pl', 'bin', 'exiftool');

            // Copy all EXIF data from HEIC except orientation
            // The --Orientation flag excludes the orientation tag
            const copyArgs = [
                '-TagsFromFile', heicPath,
                '-all:all',
                '--Orientation',  // Exclude orientation tag
                '-overwrite_original',
                outputPath
            ];
            await execFileAsync(exiftoolPath, copyArgs);

            // Set orientation to 1 (normal) since heic-convert has already
            // rotated the pixels to the correct orientation
            await execFileAsync(exiftoolPath, [
                '-Orientation#=1',
                '-n',
                '-overwrite_original',
                outputPath
            ]);
        } catch (exiftoolError) {
            console.warn(`Warning: Could not process EXIF data: ${exiftoolError.message}`);
        }

        return { success: true, exifCount };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Main function
 */
async function main() {
    // Parse command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: node convert-heic-to-jpeg.js <directory-path>');
        process.exit(1);
    }

    const dirPath = path.resolve(args[0]);

    // Verify directory exists
    try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            console.error(`Error: ${dirPath} is not a directory`);
            process.exit(1);
        }
    } catch (error) {
        console.error(`Error: Directory ${dirPath} does not exist`);
        process.exit(1);
    }

    console.log(`Scanning ${dirPath} for HEIC files...\n`);

    // Find all HEIC files
    const heicFiles = await findHeicFiles(dirPath);

    if (heicFiles.length === 0) {
        console.log('No HEIC files found.');
        return;
    }

    console.log(`Found ${heicFiles.length} HEIC file(s)\n`);

    // Convert each file
    let successCount = 0;
    let failCount = 0;

    for (const heicPath of heicFiles) {
        const fileName = path.basename(heicPath);
        const result = await convertHeicToJpeg(heicPath);

        if (result.success) {
            const outputName = path.basename(heicPath, path.extname(heicPath)) + '.jpg';
            console.log(`✓ ${fileName} → ${outputName} (preserved ${result.exifCount} EXIF properties)`);
            successCount++;
        } else {
            console.log(`✗ ${fileName} - Failed: ${result.error}`);
            failCount++;
        }
    }

    // Print summary
    console.log(`\nConverted ${successCount} of ${heicFiles.length} files${failCount > 0 ? ` (${failCount} failed)` : ''}`);
}

// Run the script
main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
