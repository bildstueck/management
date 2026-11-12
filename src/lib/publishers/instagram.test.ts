import { describe, it, expect, afterEach, vi } from "vitest";
import { publishToInstagram } from "./instagram";
import { fakeResponse, mockFetchSequence } from "./test-utils";

afterEach(() => {
  vi.unstubAllGlobals();
});

const BASE_INPUT = {
  accessToken: "token",
  externalAccountId: "ig_business_1",
};

describe("publishToInstagram", () => {
  it("rejects a post with no media", async () => {
    mockFetchSequence([]);
    const result = await publishToInstagram({ ...BASE_INPUT, text: "", media: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 media items", async () => {
    mockFetchSequence([]);
    const media = Array.from({ length: 11 }, (_, i) => ({
      type: "IMAGE" as const,
      url: `https://cdn.example.com/${i}.jpg`,
    }));
    const result = await publishToInstagram({ ...BASE_INPUT, text: "", media });
    expect(result.success).toBe(false);
  });

  it("publishes a single image: one container, then media_publish", async () => {
    const fetchMock = mockFetchSequence([
      fakeResponse({ id: "container_1" }),
      fakeResponse({ id: "media_1" }),
    ]);

    const result = await publishToInstagram({
      ...BASE_INPUT,
      text: "Ein Bild",
      media: [{ type: "IMAGE", url: "https://cdn.example.com/a.jpg" }],
    });

    expect(result).toEqual({ success: true, externalPostId: "media_1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/media_publish");
  });

  it("publishes a single video: container, status poll, then media_publish", async () => {
    const fetchMock = mockFetchSequence([
      fakeResponse({ id: "container_1" }),
      fakeResponse({ status_code: "FINISHED" }),
      fakeResponse({ id: "media_1" }),
    ]);

    const result = await publishToInstagram({
      ...BASE_INPUT,
      text: "Ein Reel",
      media: [{ type: "VIDEO", url: "https://cdn.example.com/v.mp4" }],
    });

    expect(result).toEqual({ success: true, externalPostId: "media_1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("publishes a carousel: one container per child, then a CAROUSEL container, then media_publish", async () => {
    const fetchMock = mockFetchSequence([
      fakeResponse({ id: "child_1" }),
      fakeResponse({ id: "child_2" }),
      fakeResponse({ id: "carousel_1" }),
      fakeResponse({ id: "media_1" }),
    ]);

    const result = await publishToInstagram({
      ...BASE_INPUT,
      text: "Carousel",
      media: [
        { type: "IMAGE", url: "https://cdn.example.com/a.jpg" },
        { type: "IMAGE", url: "https://cdn.example.com/b.jpg" },
      ],
    });

    expect(result).toEqual({ success: true, externalPostId: "media_1" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("surfaces a Graph API error from container creation", async () => {
    mockFetchSequence([fakeResponse({ error: { message: "Invalid image URL." } })]);

    const result = await publishToInstagram({
      ...BASE_INPUT,
      text: "",
      media: [{ type: "IMAGE", url: "https://cdn.example.com/broken.jpg" }],
    });

    expect(result).toEqual({ success: false, error: "Invalid image URL." });
  });
});
