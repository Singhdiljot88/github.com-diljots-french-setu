import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

/**
 * Fetches a public web page for the learner without letting the server be used to reach
 * internal addresses (SSRF). Every DNS answer is checked at connect time (so DNS rebinding
 * can't swap in a private IP), redirects are followed manually and re-checked, only ports
 * 80/443 are allowed, and size and time are capped.
 */

export class FetchBlocked extends Error {}

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 169 && b === 254) return false; // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (ip.startsWith("192.0.0.") || ip.startsWith("192.0.2.") || ip.startsWith("198.51.100.") || ip.startsWith("203.0.113.")) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a >= 224) return false; // multicast, reserved, broadcast
    return true;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return false;
    if (x.startsWith("::ffff:")) return isPublicAddress(x.slice(7));
    if (/^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff")) return false; // ULA, link-local, multicast
    if (x.startsWith("64:ff9b:") || x.startsWith("2001:db8")) return false;
    return true;
  }
  return false;
}

const safeLookup: net.LookupFunction = (hostname, options, cb) => {
  dns.lookup(hostname, { all: true }, (err, addrs) => {
    if (err) return cb(err, "", 4);
    const list = addrs as dns.LookupAddress[];
    const bad = list.find((a) => !isPublicAddress(a.address));
    if (!list.length || bad) return cb(new FetchBlocked("This address is not allowed."), "", 4);
    if ((options as dns.LookupOptions).all) return (cb as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    cb(null, list[0].address, list[0].family);
  });
};

export type FetchedPage = { url: string; status: number; contentType: string; body: string };

function checkUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new FetchBlocked("That is not a valid web address."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new FetchBlocked("Only http and https links can be opened.");
  if (u.username || u.password) throw new FetchBlocked("Links with a username or password are not allowed.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new FetchBlocked("Only standard web ports are allowed.");
  if (net.isIP(u.hostname.replace(/^\[|\]$/g, "")) && !isPublicAddress(u.hostname.replace(/^\[|\]$/g, ""))) throw new FetchBlocked("This address is not allowed.");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(u.hostname)) throw new FetchBlocked("This address is not allowed.");
  return u;
}

function once(u: URL): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(u, { method: "GET", lookup: safeLookup, timeout: TIMEOUT_MS, headers: { "user-agent": "FrenchSetu/1.0 (language-learning reader)", accept: "text/html,text/plain;q=0.9", "accept-language": "fr,fr-CA;q=0.9" } }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => { size += c.length; if (size > MAX_BYTES) { req.destroy(new FetchBlocked("The page is too large.")); return; } chunks.push(c); });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new FetchBlocked("The page took too long to load.")));
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetch(raw: string): Promise<FetchedPage> {
  let u = checkUrl(raw);
  const deadline = Date.now() + TIMEOUT_MS * 2;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (Date.now() > deadline) throw new FetchBlocked("The page took too long to load.");
    let r;
    try { r = await once(u); } catch (e) {
      if (e instanceof FetchBlocked) throw e;
      throw new FetchBlocked("Could not load that page.");
    }
    if (r.status >= 300 && r.status < 400 && r.headers.location) { u = checkUrl(new URL(r.headers.location, u).toString()); continue; }
    const ct = String(r.headers["content-type"] ?? "");
    if (r.status >= 400) throw new FetchBlocked(`The site answered with an error (${r.status}).`);
    if (!/text\/html|text\/plain|application\/xhtml/.test(ct)) throw new FetchBlocked("That link is not a web page with text.");
    const charset = /charset=([\w-]+)/i.exec(ct)?.[1]?.toLowerCase() ?? "utf-8";
    let body: string;
    try { body = new TextDecoder(charset).decode(r.body); } catch { body = r.body.toString("utf8"); }
    return { url: u.toString(), status: r.status, contentType: ct, body };
  }
  throw new FetchBlocked("Too many redirects.");
}
