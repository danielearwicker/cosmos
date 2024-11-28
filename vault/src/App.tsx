import { Storage } from "../../encrypted-storage/Storage";
// import { azureBackend } from "../../encrypted-storage/azureBackend";
import { localStorageBackend } from "../../encrypted-storage/localStorageBackend";
import { Vault } from "./Vault";

export default function App() {
    return (
        <Storage backend={localStorageBackend} app="vault">
            <Vault />
        </Storage>
    );
}
