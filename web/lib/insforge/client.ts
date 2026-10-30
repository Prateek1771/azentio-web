import { createBrowserClient } from "@insforge/sdk/ssr";

// Browser client for Client Components, Storage and Realtime. Auth mutations stay on the server.
export const insforge = createBrowserClient();
