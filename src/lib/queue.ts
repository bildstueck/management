import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

// Job payload for a single post publish attempt. The worker that processes
// this queue (Phase 5) will fan out to the Facebook/Instagram/LinkedIn
// publishers for each PostChannelVariant on the post.
export type PublishPostJobData = {
  postId: string;
};

export const PUBLISH_QUEUE_NAME = "publish-post";

export const publishQueue = new Queue<PublishPostJobData>(PUBLISH_QUEUE_NAME, {
  connection: redis,
});
