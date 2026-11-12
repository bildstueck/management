import { describe, it, expect, afterEach, vi } from "vitest";
import { publishToLinkedIn } from "./linkedin";
import { fakeResponse, mockFetchSequence } from "./test-utils";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publishToLinkedIn", () => {
  it("rejects more than one media item (MultiImage not implemented)", async () => {
    mockFetchSequence([]);
    const result = await publishToLinkedIn({
      accessToken: "token",
      externalAccountId: "abc123",
      text: "Mehrere Bilder",
      media: [
        { type: "IMAGE", url: "https://cdn.example.com/a.jpg" },
        { type: "IMAGE", url: "https://cdn.example.com/b.jpg" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("posts a personal-profile text-only update to /rest/posts", async () => {
    const fetchMock = mockFetchSequence([
      fakeResponse({}, { headers: { "x-restli-id": "urn:li:share:12345" } }),
    ]);

    const result = await publishToLinkedIn({
      accessToken: "token",
      externalAccountId: "abc123", // no "org:" prefix -> personal profile
      text: "Hallo LinkedIn",
      media: [],
    });

    expect(result).toEqual({ success: true, externalPostId: "urn:li:share:12345" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/posts");
    expect(init.headers["Linkedin-Version"]).toMatch(/^\d{6}$/);
    expect(init.headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
    const body = JSON.parse(init.body);
    expect(body.author).toBe("urn:li:person:abc123");
    expect(body.lifecycleState).toBe("PUBLISHED");
  });

  it("resolves an org:{id} account to an organization URN", async () => {
    const fetchMock = mockFetchSequence([fakeResponse({}, { headers: { "x-restli-id": "urn:li:share:1" } })]);

    await publishToLinkedIn({
      accessToken: "token",
      externalAccountId: "org:999",
      text: "Firmenseite",
      media: [],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.author).toBe("urn:li:organization:999");
  });

  it("uploads a single image, then references its URN in the post", async () => {
    const fetchMock = mockFetchSequence([
      fakeResponse({ value: { uploadUrl: "https://upload.linkedin.com/img", image: "urn:li:image:abc" } }), // initializeUpload
      fakeResponse({}), // fetch source image bytes
      fakeResponse({}), // PUT upload
      fakeResponse({}, { headers: { "x-restli-id": "urn:li:share:2" } }), // create post
    ]);

    const result = await publishToLinkedIn({
      accessToken: "token",
      externalAccountId: "abc123",
      text: "Mit Bild",
      media: [{ type: "IMAGE", url: "https://cdn.example.com/a.jpg" }],
    });

    expect(result).toEqual({ success: true, externalPostId: "urn:li:share:2" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const postBody = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(postBody.content).toEqual({ media: { id: "urn:li:image:abc" } });
  });

  it("uploads a video across its chunked multipart instructions, then finalizes", async () => {
    const fetchMock = mockFetchSequence([
      fakeResponse({}), // fetch source video bytes (needed upfront for fileSizeBytes)
      fakeResponse({
        value: {
          video: "urn:li:video:xyz",
          uploadToken: "tok",
          uploadInstructions: [{ firstByte: 0, lastByte: 7, uploadUrl: "https://upload.linkedin.com/vid/0" }],
        },
      }), // initializeUpload
      fakeResponse({}, { headers: { etag: '"part-etag-1"' } }), // PUT chunk
      fakeResponse({}), // finalizeUpload
      fakeResponse({}, { headers: { "x-restli-id": "urn:li:share:3" } }), // create post
    ]);

    const result = await publishToLinkedIn({
      accessToken: "token",
      externalAccountId: "abc123",
      text: "Mit Video",
      media: [{ type: "VIDEO", url: "https://cdn.example.com/v.mp4" }],
    });

    expect(result).toEqual({ success: true, externalPostId: "urn:li:share:3" });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const finalizeBody = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(finalizeBody.finalizeUploadRequest.uploadedPartIds).toEqual(["part-etag-1"]);
  });

  it("surfaces an error when the post creation call fails", async () => {
    mockFetchSequence([fakeResponse({ message: "Insufficient permissions." }, { ok: false, status: 403 })]);

    const result = await publishToLinkedIn({
      accessToken: "bad-token",
      externalAccountId: "abc123",
      text: "Hallo",
      media: [],
    });

    expect(result).toEqual({ success: false, error: "Insufficient permissions." });
  });
});
