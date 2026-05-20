import { trackEvent } from "@/lib/analytics.functions";

type EventType = "roll_clicked" | "menu_item_clicked" | "menu_item_logged" | "menu_visited";

/**
 * Fire-and-forget event tracker. Never blocks UI, never throws.
 */
export function track(eventType: EventType, metadata?: Record<string, unknown>) {
  try {
    void trackEvent({ data: { eventType, metadata } }).catch(() => {});
  } catch {
    // ignore
  }
}
