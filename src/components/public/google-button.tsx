import { googleSignInAction } from "@/app/(public)/account/actions";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.59-5.15 3.59-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.1Z" />
      <path fill="#EA4335" d="M12 4.76c1.76 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76Z" />
    </svg>
  );
}

/** "Continue with Google", with a quiet "or" line above it. Shown only once Google sign-in is set up. */
export function GoogleButton({ next }: { next?: string }) {
  return (
    <form action={googleSignInAction} className="space-y-4">
      <p className="google-or" aria-hidden="true">
        <span>or</span>
      </p>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button
        type="submit"
        className="btn google-btn inline-flex w-full items-center justify-center gap-3 border border-walnut bg-transparent text-walnut hover:bg-walnut hover:text-ivory"
      >
        <GoogleMark />
        Continue with Google
      </button>
    </form>
  );
}
