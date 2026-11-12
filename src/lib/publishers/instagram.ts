import { graphPost, graphGet, graphError } from "./graph-client";
import type { PublishInput, PublishMedia, PublishResult } from "./types";

async function createContainer(
  igUserId: string,
  accessToken: string,
  item: PublishMedia,
  opts: { isCarouselItem?: boolean; caption?: string },
): Promise<string> {
  const body: Record<string, string | boolean> = { access_token: accessToken };
  if (item.type === "VIDEO") {
    // REELS is required for video posted through this endpoint today;
    // plain feed VIDEO posts are being phased out in favor of Reels.
    body.media_type = opts.isCarouselItem ? "VIDEO" : "REELS";
    body.video_url = item.url;
  } else {
    body.image_url = item.url;
  }
  if (opts.isCarouselItem) body.is_carousel_item = true;
  if (opts.caption) body.caption = opts.caption;

  const res = await graphPost(`/${igUserId}/media`, body);
  const error = graphError(res);
  if (error) throw new Error(error);
  return res.id as string;
}

async function waitUntilFinished(containerId: string, accessToken: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await graphGet(`/${containerId}`, { fields: "status_code", access_token: accessToken });
    const status = res.status_code as string | undefined;
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error("Instagram-Medienverarbeitung fehlgeschlagen.");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Zeitüberschreitung beim Warten auf die Instagram-Medienverarbeitung.");
}

// Instagram Graph API container flow: create a media container (one per
// image/video, or one per carousel child), wait for video processing, then
// publish. See https://developers.facebook.com/docs/instagram-platform/content-publishing.
export async function publishToInstagram(input: PublishInput): Promise<PublishResult> {
  const { accessToken, externalAccountId: igUserId, text, media } = input;

  if (media.length === 0) {
    return { success: false, error: "Instagram benötigt mindestens ein Bild oder Video." };
  }
  if (media.length > 10) {
    return { success: false, error: "Instagram erlaubt maximal 10 Medien pro Carousel." };
  }

  try {
    let creationId: string;

    if (media.length === 1) {
      creationId = await createContainer(igUserId, accessToken, media[0], { caption: text });
      if (media[0].type === "VIDEO") await waitUntilFinished(creationId, accessToken);
    } else {
      const childIds: string[] = [];
      for (const item of media) {
        const childId = await createContainer(igUserId, accessToken, item, { isCarouselItem: true });
        if (item.type === "VIDEO") await waitUntilFinished(childId, accessToken);
        childIds.push(childId);
      }
      const carouselBody = await graphPost(`/${igUserId}/media`, {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: text,
        access_token: accessToken,
      });
      const error = graphError(carouselBody);
      if (error) return { success: false, error };
      creationId = carouselBody.id as string;
    }

    const publishBody = await graphPost(`/${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: accessToken,
    });
    const publishError = graphError(publishBody);
    if (publishError) return { success: false, error: publishError };
    return { success: true, externalPostId: publishBody.id as string };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
