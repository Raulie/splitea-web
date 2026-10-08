export default {
  async fetch(request, env) {
    const head = request.method === "HEAD";
    const response = await env.ASSETS.fetch(head ? new Request(request, { method: "GET" }) : request);
    const range = request.headers.get("Range");
    if (response.status !== 200) return response;

    const headers = new Headers(response.headers);
    headers.set("Accept-Ranges", "bytes");
    const match = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === "" && match[2] === "")) {
      return new Response(head ? null : response.body, { status: 200, headers });
    }

    const body = await response.arrayBuffer();
    const size = body.byteLength;
    let start;
    let end;
    if (match[1] === "") {
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
    }
    if (start >= size || start > end) {
      headers.set("Content-Range", `bytes */${size}`);
      headers.delete("Content-Length");
      return new Response(null, { status: 416, headers });
    }

    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(head ? null : body.slice(start, end + 1), { status: 206, headers });
  },
};
