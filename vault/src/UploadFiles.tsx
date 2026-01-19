import React from "react";
import { useStorage } from "../../encrypted-storage/Storage";
import type { VaultAction } from "./reducer";
import * as exifr from "exifr";

export interface UploadFilesProps {
    dispatch: (action: VaultAction) => void;
}

async function generateThumbnail(file: File): Promise<ArrayBuffer> {
    const THUMBNAIL_HEIGHT = 200;
    const THUMBNAIL_QUALITY = 0.7;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            try {
                // Calculate dimensions maintaining aspect ratio
                const aspectRatio = img.width / img.height;
                const thumbnailWidth = Math.round(THUMBNAIL_HEIGHT * aspectRatio);

                // Create canvas with thumbnail dimensions
                const canvas = document.createElement("canvas");
                canvas.width = thumbnailWidth;
                canvas.height = THUMBNAIL_HEIGHT;

                // Draw scaled image
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    throw new Error("Failed to get canvas context");
                }
                ctx.drawImage(img, 0, 0, thumbnailWidth, THUMBNAIL_HEIGHT);

                // Convert to JPEG blob
                canvas.toBlob(
                    async (blob) => {
                        URL.revokeObjectURL(url);
                        if (!blob) {
                            reject(new Error("Failed to create thumbnail blob"));
                            return;
                        }
                        const arrayBuffer = await blob.arrayBuffer();
                        resolve(arrayBuffer);
                    },
                    "image/jpeg",
                    THUMBNAIL_QUALITY
                );
            } catch (error) {
                URL.revokeObjectURL(url);
                reject(error);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };

        img.src = url;
    });
}

export function UploadFiles({ dispatch }: UploadFilesProps) {
    const storage = useStorage();

    async function addFiles(ev: React.ChangeEvent<HTMLInputElement>) {
        if (ev.target.files) {
            const filesToUpload: { file: File; id: string }[] = [];

            // First, queue all files
            for (const file of Array.from(ev.target.files)) {
                const id = `files/${crypto.randomUUID()}`;
                filesToUpload.push({ file, id });

                // Extract EXIF data for image files
                let properties: Record<string, any> | undefined;
                let created: string | undefined;
                if (file.type.startsWith("image/")) {
                    try {
                        // Extract GPS coordinates using exifr.gps()
                        const gpsData = await exifr.gps(file);

                        // Extract other EXIF data without using pick (which doesn't work with GPS)
                        const exifData = await exifr.parse(file, {
                            tiff: true,
                            exif: true,
                            gps: false, // GPS already extracted separately
                        });

                        if (exifData || gpsData) {
                            properties = {};

                            // Extract creation date for VaultItem.created
                            // Prefer DateTimeOriginal, fall back to CreateDate
                            if (exifData?.DateTimeOriginal) {
                                created = exifData.DateTimeOriginal.toISOString();
                                properties.dateTimeOriginal = created;
                            } else if (exifData?.CreateDate) {
                                created = exifData.CreateDate.toISOString();
                                properties.createDate = created;
                            }

                            // Copy relevant camera properties
                            if (exifData?.Make) properties.make = exifData.Make;
                            if (exifData?.Model) properties.model = exifData.Model;
                            if (exifData?.FocalLength) properties.focalLength = exifData.FocalLength;
                            if (exifData?.FNumber) properties.fNumber = exifData.FNumber;
                            if (exifData?.ExposureTime) properties.exposureTime = exifData.ExposureTime;
                            if (exifData?.ISO) properties.iso = exifData.ISO;

                            // GPS coordinates as signed numbers
                            if (gpsData?.latitude !== undefined) {
                                properties.latitude = gpsData.latitude;
                            }
                            if (gpsData?.longitude !== undefined) {
                                properties.longitude = gpsData.longitude;
                            }
                        }
                    } catch (error) {
                        // EXIF parsing failed, continue without properties
                        console.warn("Failed to extract EXIF data:", error);
                    }
                }

                dispatch({
                    type: "ITEM_ADD",
                    item: {
                        id,
                        name: file.name,
                        type: file.type,
                        added: new Date().toISOString(),
                        created,
                        tags: ["new"],
                        uploadState: "queued",
                        uploadProgress: { uploaded: 0, total: file.size },
                        properties,
                    },
                });
            }

            // Then upload each file sequentially
            for (const { file, id } of filesToUpload) {
                dispatch({ type: "ITEM_SET_UPLOAD_STATE", id, uploadState: "uploading" });

                if (storage.saveChunked) {
                    await storage.saveChunked(id, file, (uploaded, total) => {
                        dispatch({
                            type: "ITEM_SET_UPLOAD_PROGRESS",
                            id,
                            uploaded,
                            total,
                        });
                    });
                } else {
                    const data = await file.arrayBuffer();
                    await storage.save(id, { data, version: "" });
                }

                dispatch({ type: "ITEM_SET_UPLOAD_STATE", id, uploadState: "complete" });

                // Generate and upload thumbnail for image files
                if (file.type.startsWith("image/")) {
                    try {
                        const thumbnail = await generateThumbnail(file);
                        await storage.save(`${id}-thumb`, { data: thumbnail, version: "" });
                    } catch (error) {
                        // Thumbnail generation failed, but original image upload succeeded
                        console.warn(`Failed to generate thumbnail for ${file.name}:`, error);
                    }
                }
            }
        }
        ev.target.value = "";
    }

    return (
        <label className="upload-btn">
            <input type="file" onChange={addFiles} multiple={true} />
            Upload
        </label>
    );
}
