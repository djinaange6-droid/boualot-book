/**
 * Resilient fetching utility with auto-retry on network errors or transient HTTP statuses (like 429, 502, 503, 504)
 * Particularly helpful when waking up from standby mode or during micro-disconnections.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelayMs = 1500
): Promise<Response> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Check if navigator is online, otherwise wait briefly for online event
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        console.warn("[Connectivity] Device appears to be offline. Waiting up to 5s for connection...");
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 5000);
          window.addEventListener("online", () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
      }

      const response = await fetch(url, options);

      // Retry if transient server error or rate limitation
      const retriableStatuses = [429, 502, 503, 504];
      if (response.ok || !retriableStatuses.includes(response.status)) {
        return response;
      }

      console.warn(`[Connectivity] Received status ${response.status} from ${url}. Attempt ${attempt + 1}/${maxRetries}.`);
    } catch (err) {
      console.warn(`[Connectivity] Fetch error on ${url}:`, err);
      // Let it fall through to retry
    }

    attempt++;
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.log(`[Connectivity] Retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Final attempt to fetch normally so we propagate the original error/response
  return fetch(url, options);
}
