# Google reviews on the website

## What shows now

The feedback row shows the business's **Google** reviews only. By default it uses the Places API (key `GOOGLE_PLACES_API_KEY` in Vercel and the Place ID in Settings), and Google
returns **at most the 5 most recent reviews** that way. That cap is Google's; nothing on our side can raise it.

## Showing every review (Business Profile API)

The Business Profile API lists all reviews of a business, with their posted date and the reviewer's picture. When it is set up, the site uses it instead: the feedback
row shows the newest 12, and "View all" lists every review. If it is not set up, or Google does not answer, the site quietly falls back to the 5 from the Places API.

It must be authorised once by the person who manages the business on Google (the owner), and Google must approve the project for this API first.

1. **Ask Google for access** (can take days to weeks). In the Google Cloud project, note the *project number*, then fill in Google's
   "Application for Basic API Access" for the Business Profile APIs, using the email that manages the Business Profile. The Business Profile must be verified and
   have been active for 60+ days, with the website listed on it.
2. **Enable the APIs** in the project: *Google My Business API*, *My Business Account Management API* and *My Business Business Information API*.
3. In *Google Auth Platform > Data access*, add the scope `https://www.googleapis.com/auth/business.manage`. In the OAuth client (Web application) add
   `http://localhost:53682/callback` to *Authorized redirect URIs*.
4. On a trusted computer: `GOOGLE_BUSINESS_CLIENT_ID=... GOOGLE_BUSINESS_CLIENT_SECRET=... pnpm google-business-auth`. Sign in as the business owner, press Allow,
   and copy the lines it prints.
5. Put the four values in Vercel (`GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET`, `GOOGLE_BUSINESS_REFRESH_TOKEN`, `GOOGLE_BUSINESS_LOCATION`) and redeploy.

The refresh token is a secret: it lives only in Vercel's environment variables. Reviews are read once every six hours and kept for that long.
