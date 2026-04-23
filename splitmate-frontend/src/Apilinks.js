const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

export const BACKEND_URL = trimTrailingSlash(
  import.meta.env.VITE_BACKEND_URL || ""
);

export const API_BASE_URL = BACKEND_URL ? `${BACKEND_URL}/api` : "";

// Kept as an alias to avoid touching every API module right now.
export const TESTING_URL = API_BASE_URL;
