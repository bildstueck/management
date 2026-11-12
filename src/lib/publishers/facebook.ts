import { graphPost, graphError } from "./graph-client";
import type { PublishInput, PublishResult } from "./types";

// Facebook Page publishing. No media -> a plain feed post. One image/video
// -> the dedicated /photos or /videos endpoint (Meta fetches by URL). More
// than one image -> upload each unpublished first, then attach them all to
// one /feed post (Facebook has no "carousel" container like Instagram's).
export async function publishToFacebook(input: PublishInput): Promise<PublishResult> {
  const { accessToken, externalAccountId: pageId, text, media } = input;

  try {
    if (media.length === 0) {
      const body = await graphPost(`/${pageId}/feed`, { message: text, access_token: accessToken });
      const error = graphError(body);
      if (error) return { success: false, error };
      return { success: true, externalPostId: body.id as string };
    }

    if (media.length === 1 && media[0].type === "VIDEO") {
      const body = await graphPost(`/${pageId}/videos`, {
        file_url: media[0].url,
        description: text,
        access_token: accessToken,
      });
      const error = graphError(body);
      if (error) return { success: false, error };
      return { success: true, externalPostId: body.id as string };
    }

    if (media.length === 1) {
      const body = await graphPost(`/${pageId}/photos`, {
        url: media[0].url,
        caption: text,
        published: true,
        access_token: accessToken,
      });
      const error = graphError(body);
      if (error) return { success: false, error };
      return { success: true, externalPostId: body.id as string };
    }

    // Multiple media: Facebook only supports multiple *images* attached to
    // one feed post this way — a mixed/video carousel isn't supported here.
    const photoIds: string[] = [];
    for (const item of media) {
      if (item.type !== "IMAGE") {
        return {
          success: false,
          error: "Facebook unterstützt nur mehrere Bilder in einem Beitrag, kein Video im Carousel.",
        };
      }
      const body = await graphPost(`/${pageId}/photos`, {
        url: item.url,
        published: false,
        access_token: accessToken,
      });
      const error = graphError(body);
      if (error) return { success: false, error };
      photoIds.push(body.id as string);
    }

    const feedBody: Record<string, string> = { message: text, access_token: accessToken };
    photoIds.forEach((id, i) => {
      feedBody[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
    });
    const body = await graphPost(`/${pageId}/feed`, feedBody);
    const error = graphError(body);
    if (error) return { success: false, error };
    return { success: true, externalPostId: body.id as string };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
