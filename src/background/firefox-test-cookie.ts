import { patternToRegexFilter } from "@/background/dnr";
import { BUILD_BROWSER_TARGET, FX_RUNTIME_TEST_HOST } from "@/shared/build-flags";

const TEST_COOKIE_RULE_ID = 900_001;
const MODIFY_HEADERS = "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType;
const SET_HEADER = "set" as chrome.declarativeNetRequest.HeaderOperation;
const MAIN_FRAME_TYPES = ["main_frame"] as chrome.declarativeNetRequest.ResourceType[];

const removeTestCookies = async (
  hostname: string,
  cookieName: string,
): Promise<void> => {
  const cookies = await chrome.cookies.getAll({ domain: hostname, name: cookieName });
  await Promise.all(
    cookies.map(async (cookie) => {
      const protocol = cookie.secure ? "https" : "http";
      const domain = cookie.domain.startsWith(".")
        ? cookie.domain.slice(1)
        : cookie.domain;
      await chrome.cookies.remove({
        url: `${protocol}://${domain}${cookie.path || "/"}`,
        name: cookie.name,
        storeId: cookie.storeId,
      });
    }),
  );
};

export const configureFxTestCookie = async ({
  hostname,
  cookieName,
  cookieValue,
}: {
  hostname: string;
  cookieName: string;
  cookieValue: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> => {
  if (BUILD_BROWSER_TARGET !== "firefox" || !FX_RUNTIME_TEST_HOST) {
    return {
      ok: false,
      error: "Firefox runtime-test cookie spike is unavailable.",
    };
  }
  const normalizedHostname = hostname.trim().toLowerCase();
  const normalizedCookieName = cookieName.trim();
  if (
    !normalizedHostname ||
    normalizedHostname !== FX_RUNTIME_TEST_HOST ||
    !normalizedCookieName
  ) {
    return {
      ok: false,
      error: "Firefox runtime-test cookie spike requires the seeded runtime-test host.",
    };
  }
  const regexFilter = patternToRegexFilter(normalizedHostname);
  if (!regexFilter) {
    return {
      ok: false,
      error: "Invalid hostname for Firefox runtime-test cookie spike.",
    };
  }
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [TEST_COOKIE_RULE_ID],
      addRules:
        cookieValue === null
          ? []
          : [
              {
                id: TEST_COOKIE_RULE_ID,
                priority: 1,
                action: {
                  type: MODIFY_HEADERS,
                  responseHeaders: [
                    {
                      header: "Set-Cookie",
                      operation: SET_HEADER,
                      value: `${normalizedCookieName}=${encodeURIComponent(cookieValue)}; Path=/; Max-Age=600; SameSite=Lax`,
                    },
                  ],
                },
                condition: { regexFilter, resourceTypes: MAIN_FRAME_TYPES },
              },
            ],
    });
    if (cookieValue === null) {
      await removeTestCookies(normalizedHostname, normalizedCookieName);
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to configure Firefox response cookie spike.",
    };
  }
};
