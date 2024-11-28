import { type FatboyData } from "./data";
import { type FatboyAction } from "./reducer";
import { DatePicker } from "./DatePicker";
import { useStorage } from "../../encrypted-storage/Storage";
import { useContext, useEffect, useRef, useState } from "react";
import { EditingDay } from "./editingDay";

export interface NotesProps {
    state: FatboyData;
    dispatch: React.Dispatch<FatboyAction>;
}

export function Notes({ state, dispatch }: NotesProps) {
    const storage = useStorage();
    const editingDay = useContext(EditingDay);

    const note = state.notes?.find((x) => x.date === editingDay.value);

    const text = note?.text ?? "";
    const pictures = note?.pictures ?? [];

    function setText(text: string) {
        dispatch({ type: "EDIT_NOTE", text, editingDay: editingDay.value });
    }

    const imageCache = useRef<
        Record<
            string,
            {
                url: string;
                width: number;
                height: number;
            }
        >
    >({});

    const [_, setImageCacheVersion] = useState(0);

    async function cacheImage(id: string, blob: Blob) {
        const url = URL.createObjectURL(blob);

        const loaded = await new Promise<HTMLImageElement>((done) => {
            const image = new Image();
            image.onload = () => done(image);
            image.src = url;
        });

        imageCache.current[id] = {
            url,
            width: loaded.width,
            height: loaded.height,
        };

        setImageCacheVersion((v) => v + 1);
    }

    async function addFiles(ev: React.ChangeEvent<HTMLInputElement>) {
        if (ev.target.files) {
            for (const file of Array.from(ev.target.files)) {
                const id = `pictures/${editingDay}/${
                    file.type
                }/${window.crypto.randomUUID()}`;
                const data = await file.arrayBuffer();
                await storage.save(id, { data, version: "" });

                await cacheImage(id, file);

                dispatch({
                    type: "ADD_NOTE_PICTURE",
                    editingDay: editingDay.value,
                    id: id,
                    contentType: file.type,
                });
            }
        }
    }

    useEffect(() => {
        return () => {
            const oldImageCache = imageCache.current;
            imageCache.current = {};
            for (const [id, image] of Object.entries(oldImageCache)) {
                URL.revokeObjectURL(image.url);
            }
        };
    }, []);

    useEffect(() => {
        let quit = false;
        async function updateCache() {
            for (const picture of pictures) {
                if (quit) break;
                if (!imageCache.current[picture.id]) {
                    const payload = await storage.load(picture.id);
                    if (payload.data && !quit) {
                        const blob = new Blob([payload.data], {
                            type: picture.type,
                        });
                        cacheImage(picture.id, blob);
                    }
                }
            }

            for (const image of Object.keys(imageCache.current)) {
                if (!pictures.some((p) => p.id === image)) {
                    URL.revokeObjectURL(imageCache.current[image].url);
                    delete imageCache.current[image];
                }
            }
        }
        updateCache();
        return () => {
            quit = true;
        };
    }, [pictures]);

    const [showingPicture, setShowingPicture] = useState("");

    function removePicture() {
        if (showingPicture) {
            dispatch({
                type: "REMOVE_NOTE_PICTURE",
                id: showingPicture,
                editingDay: editingDay.value,
            });
            setShowingPicture("");
        }
    }

    if (showingPicture) {
        const url = imageCache.current[showingPicture]?.url;
        return (
            <div className="show-picture">
                {!url ? undefined : (
                    <div className="large-picture">
                        <img src={url} onClick={() => setShowingPicture("")} />
                    </div>
                )}
                <button onClick={removePicture}>Remove picture</button>
            </div>
        );
    }

    return (
        <>
            <DatePicker {...editingDay} />
            <div className="pictures">
                <label className="add">
                    <input
                        type="file"
                        accept="image/*, video/*"
                        onChange={addFiles}
                    />
                    📸
                </label>
                {pictures.map((picture) => {
                    const url = imageCache.current[picture.id]?.url;
                    return !url ? undefined : (
                        <div key={picture.id} className="picture">
                            <img
                                src={url}
                                onClick={() => setShowingPicture(picture.id)}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="full-date">
                <span>{new Date(editingDay.value).toDateString()}</span>
            </div>
            <div className="notes">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
            </div>
        </>
    );
}
