export interface CategoryPathProps {
    path: string;
    setPath(path: string): void;
}

export function getPathElements(path: string) {
    const pathSegments = path.split("/").filter(x => !!x);

    return pathSegments.map((_, i) => ({
        name: pathSegments[i],
        path: pathSegments.slice(0, i + 1).join("/"),
    }));
}

export function CategoryPath({ path, setPath }: CategoryPathProps) {
    const pathElements = getPathElements(path);

    return (
        <>
            <div className="category" onClick={() => setPath("")}>
                -
            </div>
            {pathElements.map(e => (
                <div className="category" onClick={() => setPath(`${e.path}/`)}>
                    {e.name}
                </div>
            ))}
        </>
    );
}
