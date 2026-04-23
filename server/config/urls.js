const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");
const splitEnvUrls = (value = "") =>
  value
    .split(",")
    .map((item) => trimTrailingSlash(item.trim()))
    .filter(Boolean);

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
  [
    ...splitEnvUrls(process.env.CLIENT_URL || ""),
    ...splitEnvUrls(process.env.LOCAL_CLIENT_URL || ""),
    ...splitEnvUrls(process.env.CLIENT_URL_ALIASES || ""),
  ];

const isAllowedClientUrl = (url = "") =>
  getAllowedClientUrls().includes(trimTrailingSlash(url));

module.exports = {
  getAllowedClientUrls,
  getBackendUrl,
  getFrontendUrl,
  isAllowedClientUrl,
};
