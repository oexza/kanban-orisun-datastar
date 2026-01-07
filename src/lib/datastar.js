// Datastar SSE helpers for Server-Sent Events… had some issues w/ official SDK in bun,
// but just need to try it out again.
export function sseFragment(selector, html) {
    // Escape newlines, backslashes, and quotes in HTML
    const escaped = html
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "");
    return `event: datastar-fragment\ndata: {"selector":"${selector}","merge":"morph","fragment":"${escaped}"}\n\n`;
}
export function ssePatch(selector, html) {
    const escaped = html.replace(/\n/g, " ").replace(/\r/g, "");
    return {
        event: "datastar-patch-elements",
        data: `mode outer\nselector ${selector}\nelements ${escaped}`,
    };
}
export function sseRedirect(url) {
    return {
        event: "datastar-patch-elements",
        data: `selector body\nmode append\nelements <script>window.location.href = "${url}"</script>`,
    };
}
export function sendKeepAlivePing(stream) {
    return stream.writeSSE({
        event: "keep-alive",
        data: "ping",
    });
}
