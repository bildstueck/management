import { describe, it, expect, afterEach, vi } from "vitest";
import { publishToFacebook } from "./facebook";
import { fakeResponse, mockFetchSequence } from "./test-utils";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publishToFacebook", () => {
  it("posts text-only content to /feed", async () => {
    const fetchMock = mockFetchSequence([fakeResponse({ id: "page_post_1" })]);

    const result = await publishToFacebook({
      accessToken: "token",
      externalAccountId: "123456",
      text: "Hallo Welt",
      media: [],
    });

    expect(result).toEqual({ success: true, externalPostId: "page_post_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/123456/feed");
    expect(String(init.body)).toContain("message=Hallo");
  });

  it("posts a single image via /photos", async () => {
    const fetchMock = mockFetchSequence([fakeResponse({ id: "photo_1" })]);

    const result = await publishToFacebook({
      accessToken: "token",
      externalAccountId: "123456",
      text: "Mit Bild",
      media: [{ type: "IMAGE", url: "https://cdn.example.com/a.jpg" }],
    });

    expect(result).toEqual({ success: true, externalPostId: "photo_1" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/123456/photos");
  });

  it("uploads each image unpublished, then attaches them to one /feed post", async () => {
    const fetchMock = mockFetchSequence([
      fakeResponse({ id: "unpub_1" }),
      fakeResponse({ id: "unpub_2" }),
      fakeResponse({ id: "feed_post_1" }),
    ]);

    const result = await publishToFacebook({
      accessToken: "token",
      externalAccountId: "123456",
      text: "Mehrere Bilder",
      media: [
        { type: "IMAGE", url: "https://cdn.example.com/a.jpg" },
        { type: "IMAGE", url: "https://cdn.example.com/b.jpg" },
      ],
    });

    expect(result).toEqual({ success: true, externalPostId: "feed_post_1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, finalInit] = fetchMock.mock.calls[2];
    expect(String(finalInit.body)).toContain("attached_media%5B0%5D");
    expect(String(finalInit.body)).toContain("attached_media%5B1%5D");
  });

  it("rejects a video mixed into a multi-media post", async () => {
    mockFetchSequence([]);

    const result = await publishToFacebook({
      accessToken: "token",
      externalAccountId: "123456",
      text: "Video + Bild",
      media: [
        { type: "VIDEO", url: "https://cdn.example.com/v.mp4" },
        { type: "IMAGE", url: "https://cdn.example.com/a.jpg" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("surfaces a Graph API error", async () => {
    mockFetchSequence([fakeResponse({ error: { message: "Invalid OAuth access token." } })]);

    const result = await publishToFacebook({
      accessToken: "bad-token",
      externalAccountId: "123456",
      text: "Hallo",
      media: [],
    });

    expect(result).toEqual({ success: false, error: "Invalid OAuth access token." });
  });
});
