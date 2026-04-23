const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");
const splitEnvUrls = (value = "") =>
  value
    .split(",")
    .map((item) => trimTrailingSlash(item.trim()))
    .filter(Boolean);
const normalizeUrlVariants = (value = "") => {
  const trimmed = trimTrailingSlash(value);

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = new URL(trimmed);
    const variants = new Set([trimmed]);

    if (parsed.hostname.startsWith("www.")) {
      parsed.hostname = parsed.hostname.replace(/^www\./, "");
      variants.add(trimTrailingSlash(parsed.toString()));
    } else if (parsed.hostname.split(".").length >= 2) {
      parsed.hostname = `www.${parsed.hostname}`;
      variants.add(trimTrailingSlash(parsed.toString()));
    }

    return [...variants];
  } catch {
    return [trimmed];
  }
};

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
  ].flatMap((url) => normalizeUrlVariants(url))
   .filter((url, index, array) => array.indexOf(url) === index);

const isAllowedClientUrl = (url = "") =>
  getAllowedClientUrls().includes(trimTrailingSlash(url));

module.exports = {
  getAllowedClientUrls,
  getBackendUrl,
  getFrontendUrl,
  isAllowedClientUrl,
};
