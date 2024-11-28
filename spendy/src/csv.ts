export function* parseCsvText(text: string) {
    let quotes = false;
    let field: string[] = [];
    let line: string[] = [];
    let start = 0;

    for (let c = 0; c < text.length; c++) {
        const ch = text[c];
        if (ch === '"') {
            if (quotes) {
                field.push(text.substring(start, c));
            }
            quotes = !quotes;
            start = c + 1;
        } else if (!quotes) {
            if (ch === "," || ch === "\n") {
                field.push(text.substring(start, c));
                line.push(field.join(""));
                field = [];
                start = c + 1;
            }
            if (ch === "\n") {
                yield line;
                line = [];
            }
        }
    }

    if (start < text.length) {
        field.push(text.substring(start));
    }

    if (field.length > 0) {
        line.push(field.join(""));
    }

    if (line.length > 0) {
        yield line;
    }
}
