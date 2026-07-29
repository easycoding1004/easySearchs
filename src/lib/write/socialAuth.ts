import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

// Short-lived cookie holding the OAuth `state` value between the redirect-out
// and the provider's callback — prevents CSRF (a callback with a state that
// doesn't match this cookie is rejected). 10 minutes is generous for a login
// flow; no reason to keep it around longer.
const STATE_COOKIE = "write_oauth_state";
const STATE_MAX_AGE_SECONDS = 10 * 60;

export async function issueOAuthState(): Promise<string> {
  const state = randomUUID();
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  return state;
}

export async function verifyAndConsumeOAuthState(receivedState: string | null): Promise<boolean> {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  return !!expected && !!receivedState && expected === receivedState;
}
