import { useVaultStorage } from "./reducer";
import { UploadFiles } from "./UploadFiles";

export function Vault() {
    const [state, dispatch] = useVaultStorage();

    return (
        <div className="vault">
            <div className="items">
                {state.items.map((i) => (
                    <div className="item" key={i.id}>
                        <div className="name">{i.name}</div>
                        <div className="type">{i.type}</div>
                        <div className="added">{i.added}</div>
                        <div className="tags">
                            {i.tags.map((t) => (
                                <div className="tag" key={t}>
                                    {t}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="upload">
                <UploadFiles dispatch={dispatch} />
            </div>
        </div>
    );
}
