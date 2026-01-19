import { useStorage } from "../../encrypted-storage/Storage";
import { useStorageBackedState } from "../../encrypted-storage/useStorageBackedState";

export type UploadState = "queued" | "uploading" | "complete";

export type UploadProgress = Readonly<{
    uploaded: number;
    total: number;
}>;

export type VaultItem = Readonly<{
    id: string;
    name: string;
    type: string;
    added: string; // ISO UTC datetime when uploaded
    created?: string; // ISO UTC datetime when content was created (from EXIF/metadata)
    tags: string[];
    uploadState: UploadState;
    uploadProgress?: UploadProgress;
    currentPage?: number; // For PDFs: last viewed page
    properties?: Record<string, any>; // File metadata (e.g., EXIF data for images)
}>;

export type VaultState = Readonly<{
    items: readonly VaultItem[];
    tagColors: Readonly<Record<string, string>>; // tag name -> color
    viewMode: "files" | "timeline"; // Current view mode
    timelineCollapsed: Readonly<{
        years: readonly number[];
        months: readonly string[]; // Format: "YYYY-MM"
    }>;
}>;

export type VaultAction =
    | {
          type: "LOAD";
          state: VaultState;
      }
    | {
          type: "ITEM_ADD";
          item: VaultItem;
      }
    | {
          type: "ITEM_DELETE";
          id: string;
      }
    | {
          type: "ITEM_RENAME";
          id: string;
          name: string;
      }
    | {
          type: "ITEM_TAG_ADD";
          id: string;
          tag: string;
      }
    | {
          type: "ITEM_TAG_REMOVE";
          id: string;
          tag: string;
      }
    | {
          type: "TAG_RENAME_GLOBAL";
          oldTag: string;
          newTag: string;
      }
    | {
          type: "TAG_DELETE_GLOBAL";
          tag: string;
      }
    | {
          type: "TAG_MERGE_GLOBAL";
          sourceTag: string;
          targetTag: string;
      }
    | {
          type: "ITEM_SET_UPLOAD_STATE";
          id: string;
          uploadState: UploadState;
      }
    | {
          type: "ITEM_SET_UPLOAD_PROGRESS";
          id: string;
          uploaded: number;
          total: number;
      }
    | {
          type: "ITEM_SET_CURRENT_PAGE";
          id: string;
          page: number;
      }
    | {
          type: "TAG_SET_COLOR";
          tag: string;
          color: string;
      }
    | {
          type: "SET_VIEW_MODE";
          viewMode: "files" | "timeline";
      }
    | {
          type: "TIMELINE_TOGGLE_YEAR";
          year: number;
      }
    | {
          type: "TIMELINE_TOGGLE_MONTH";
          yearMonth: string; // Format: "YYYY-MM"
      };

export function vaultReducer(old: VaultState, action: VaultAction) {
    switch (action.type) {
        case "LOAD": {
            // Handle old state format where Sets might have been serialized as objects
            const timelineCollapsed = action.state.timelineCollapsed;
            let years: readonly number[] = [];
            let months: readonly string[] = [];

            if (timelineCollapsed) {
                // If years is an array, use it; otherwise empty array
                years = Array.isArray(timelineCollapsed.years) ? timelineCollapsed.years : [];
                // If months is an array, use it; otherwise empty array
                months = Array.isArray(timelineCollapsed.months) ? timelineCollapsed.months : [];
            }

            return {
                ...action.state,
                tagColors: action.state.tagColors || {},
                viewMode: action.state.viewMode || "files",
                timelineCollapsed: {
                    years,
                    months,
                },
            };
        }

        case "ITEM_ADD": {
            return {
                ...old,
                items: [...old.items, action.item],
            };
        }

        case "ITEM_DELETE": {
            return {
                ...old,
                items: old.items.filter((item) => item.id !== action.id),
            };
        }

        case "ITEM_RENAME": {
            return {
                ...old,
                items: old.items.map((item) =>
                    item.id === action.id
                        ? { ...item, name: action.name }
                        : item
                ),
            };
        }

        case "ITEM_TAG_ADD": {
            const tag = action.tag.toLowerCase().trim();
            if (!tag) return old;
            return {
                ...old,
                items: old.items.map((item) =>
                    item.id === action.id && !item.tags.includes(tag)
                        ? { ...item, tags: [...item.tags, tag] }
                        : item
                ),
            };
        }

        case "ITEM_TAG_REMOVE": {
            return {
                ...old,
                items: old.items.map((item) =>
                    item.id === action.id
                        ? { ...item, tags: item.tags.filter((t) => t !== action.tag) }
                        : item
                ),
            };
        }

        case "ITEM_SET_UPLOAD_STATE": {
            return {
                ...old,
                items: old.items.map((item) =>
                    item.id === action.id
                        ? { ...item, uploadState: action.uploadState }
                        : item
                ),
            };
        }

        case "ITEM_SET_UPLOAD_PROGRESS": {
            return {
                ...old,
                items: old.items.map((item) =>
                    item.id === action.id
                        ? {
                              ...item,
                              uploadProgress: {
                                  uploaded: action.uploaded,
                                  total: action.total,
                              },
                          }
                        : item
                ),
            };
        }

        case "ITEM_SET_CURRENT_PAGE": {
            return {
                ...old,
                items: old.items.map((item) =>
                    item.id === action.id
                        ? { ...item, currentPage: action.page }
                        : item
                ),
            };
        }

        case "TAG_RENAME_GLOBAL": {
            const oldTag = action.oldTag.toLowerCase().trim();
            const newTag = action.newTag.toLowerCase().trim();
            if (!newTag || oldTag === newTag) return old;

            return {
                ...old,
                items: old.items.map((item) =>
                    item.tags.includes(oldTag)
                        ? {
                              ...item,
                              tags: item.tags.map((t) => (t === oldTag ? newTag : t)),
                          }
                        : item
                ),
            };
        }

        case "TAG_DELETE_GLOBAL": {
            const tag = action.tag.toLowerCase().trim();
            return {
                ...old,
                items: old.items.map((item) =>
                    item.tags.includes(tag)
                        ? { ...item, tags: item.tags.filter((t) => t !== tag) }
                        : item
                ),
            };
        }

        case "TAG_MERGE_GLOBAL": {
            const sourceTag = action.sourceTag.toLowerCase().trim();
            const targetTag = action.targetTag.toLowerCase().trim();
            if (!targetTag || sourceTag === targetTag) return old;

            return {
                ...old,
                items: old.items.map((item) => {
                    if (!item.tags.includes(sourceTag)) return item;

                    // Remove source tag and add target tag if not already present
                    const newTags = item.tags.filter((t) => t !== sourceTag);
                    if (!newTags.includes(targetTag)) {
                        newTags.push(targetTag);
                    }
                    return { ...item, tags: newTags };
                }),
            };
        }

        case "TAG_SET_COLOR": {
            const tag = action.tag.toLowerCase().trim();
            if (!tag) return old;

            return {
                ...old,
                tagColors: {
                    ...old.tagColors,
                    [tag]: action.color,
                },
            };
        }

        case "SET_VIEW_MODE": {
            return {
                ...old,
                viewMode: action.viewMode,
            };
        }

        case "TIMELINE_TOGGLE_YEAR": {
            const years = old.timelineCollapsed.years;
            const newYears = years.includes(action.year)
                ? years.filter((y) => y !== action.year)
                : [...years, action.year];
            return {
                ...old,
                timelineCollapsed: {
                    ...old.timelineCollapsed,
                    years: newYears,
                },
            };
        }

        case "TIMELINE_TOGGLE_MONTH": {
            const months = old.timelineCollapsed.months;
            const newMonths = months.includes(action.yearMonth)
                ? months.filter((m) => m !== action.yearMonth)
                : [...months, action.yearMonth];
            return {
                ...old,
                timelineCollapsed: {
                    ...old.timelineCollapsed,
                    months: newMonths,
                },
            };
        }
    }
}

const initialState: VaultState = {
    items: [],
    tagColors: {},
    viewMode: "files",
    timelineCollapsed: {
        years: [],
        months: [],
    },
};

function generateLoadAction(state: VaultState): VaultAction {
    return { type: "LOAD", state };
}

export function useVaultStorage() {
    const storage = useStorage();

    return useStorageBackedState(
        storage,
        "vault",
        vaultReducer,
        initialState,
        generateLoadAction
    );
}

export type VaultStorage = ReturnType<typeof useVaultStorage>;
