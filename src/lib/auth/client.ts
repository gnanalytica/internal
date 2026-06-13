"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/** Browser-side auth client (sign-in/up, social, sign-out). */
export const authClient = createAuthClient();
