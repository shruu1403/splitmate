const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const getRuntimeEnv = () => process.env.NODE_ENV || "development";

const getFrontendUrl = () => {
  const runtimeEnv = getRuntimeEnv();
  const preferredUrl =
    runtimeEnv === "production"
      ? process.env.CLIENT_URL
      : process.env.LOCAL_CLIENT_URL || process.env.CLIENT_URL;

  return trimTrailingSlash(preferredUrl || "");
};

const getBackendUrl = () => {
  const runtimeEnv = getRuntimeEnv();
  const preferredUrl =
    runtimeEnv === "production"
      ? process.env.BACKEND_URL
      : process.env.LOCAL_BACKEND_URL || process.env.BACKEND_URL;

  return trimTrailingSlash(preferredUrl || "");
};

const getAllowedClientUrls = () =>
  [process.env.CLIENT_URL, process.env.LOCAL_CLIENT_URL]
    .map((url) => trimTrailingSlash(url || ""))
    .filter(Boolean);

module.exports = {
  getAllowedClientUrls,
  getBackendUrl,
  getFrontendUrl,
};
