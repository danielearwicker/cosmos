import { Storage } from "../../encrypted-storage/Storage";
import { azureBackend } from "../../encrypted-storage/azureBackend";
import { Vault } from "./Vault";

export default function App() {
    return (
        <Storage backend={azureBackend} app="vault">
            <Vault />
        </Storage>
    );
}
