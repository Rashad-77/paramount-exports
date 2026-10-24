/**
 * One-off: lets the business owner authorise the website to READ the business's Google reviews, and prints the four values to put in Vercel.
 *
 *   GOOGLE_BUSINESS_CLIENT_ID=... GOOGLE_BUSINESS_CLIENT_SECRET=... pnpm google-business-auth
 *
 * Run it on a trusted computer, sign in as the Google account that manages the Business Profile, press Allow, and copy the lines it prints.
 * Needs the OAuth client's "Authorized redirect URIs" to include http://localhost:53682/callback and Google's approval of Business Profile API access
 * (see docs/GOOGLE_REVIEWS.md). The refresh token is a secret: it goes only into Vercel's environment variables, never into the code.
 */
import http from "node:http";

const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/business.manage";

async function main() {
  const id = process.env.GOOGLE_BUSINESS_CLIENT_ID;
  const secret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
  if (!id || !secret) {
    console.error("Set GOOGLE_BUSINESS_CLIENT_ID and GOOGLE_BUSINESS_CLIENT_SECRET first.");
    process.exit(1);
  }
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.search = new URLSearchParams({ client_id: id, redirect_uri: REDIRECT, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent" }).toString();
  console.log("\nOpen this address in your browser and press Allow:\n\n" + auth.toString() + "\n");

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url ?? "/", REDIRECT);
      if (u.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const c = u.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/plain" }).end(c ? "Done. You can close this tab and go back to the terminal." : "Google did not send a code. Try again.");
      server.close();
      c ? resolve(c) : reject(new Error(u.searchParams.get("error") ?? "no code"));
    });
    server.listen(PORT);
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: REDIRECT, grant_type: "authorization_code" }),
  });
  const token = (await tokenRes.json()) as { access_token?: string; refresh_token?: string; error_description?: string };
  if (!token.access_token || !token.refresh_token) {
    console.error("Google did not give a refresh token:", token.error_description ?? JSON.stringify(token));
    process.exit(1);
  }
  const bearer = { Authorization: `Bearer ${token.access_token}` };

  const accounts = (await (await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: bearer })).json()) as { accounts?: Array<{ name: string; accountName?: string }>; error?: { message?: string } };
  if (!accounts.accounts?.length) {
    console.error("No Business Profile accounts found:", accounts.error?.message ?? "none");
    process.exit(1);
  }
  console.log("\nAdd these to Vercel (Settings > Environment Variables), then redeploy:\n");
  console.log(`GOOGLE_BUSINESS_CLIENT_ID=${id}`);
  console.log("GOOGLE_BUSINESS_CLIENT_SECRET=(the same secret you used above)");
  console.log(`GOOGLE_BUSINESS_REFRESH_TOKEN=${token.refresh_token}`);
  for (const a of accounts.accounts) {
    const locs = (await (await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title`, { headers: bearer })).json()) as { locations?: Array<{ name: string; title?: string }> };
    for (const l of locs.locations ?? []) console.log(`GOOGLE_BUSINESS_LOCATION=${a.name}/${l.name}   # ${l.title ?? ""}`);
  }
  console.log("\nIf several locations are listed, use the line for this business.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
