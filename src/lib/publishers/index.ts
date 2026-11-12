import type { Platform } from "@prisma/client";
import { publishToFacebook } from "./facebook";
import { publishToInstagram } from "./instagram";
import { publishToLinkedIn } from "./linkedin";
import type { PublishInput, PublishResult } from "./types";

export type { PublishInput, PublishMedia, PublishResult } from "./types";

export function publishToChannel(platform: Platform, input: PublishInput): Promise<PublishResult> {
  switch (platform) {
    case "FACEBOOK":
      return publishToFacebook(input);
    case "INSTAGRAM":
      return publishToInstagram(input);
    case "LINKEDIN":
      return publishToLinkedIn(input);
  }
}
