import { createAuthClient } from "better-auth/react";

// Same origin as the app: requests go to /api/auth on whatever host serves the page.
export const authClient = createAuthClient();
