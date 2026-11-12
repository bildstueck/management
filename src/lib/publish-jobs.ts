import { prisma } from "@/lib/prisma";

export function createPublishJob(postId: string, queueJobId: string) {
  return prisma.publishJob.create({ data: { postId, queueJobId, status: "QUEUED" } });
}

export function markPublishJobRunning(jobId: string) {
  return prisma.publishJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });
}

export function markPublishJobSucceeded(jobId: string) {
  return prisma.publishJob.update({ where: { id: jobId }, data: { status: "SUCCEEDED" } });
}

export function markPublishJobFailed(jobId: string, errorMessage: string) {
  return prisma.publishJob.update({ where: { id: jobId }, data: { status: "FAILED", errorMessage } });
}

export function getLatestPublishJob(postId: string) {
  return prisma.publishJob.findFirst({ where: { postId }, orderBy: { createdAt: "desc" } });
}

export async function cancelQueuedPublishJobs(postId: string) {
  await prisma.publishJob.updateMany({
    where: { postId, status: "QUEUED" },
    data: { status: "FAILED", errorMessage: "Abgebrochen (zurück zu Entwurf/Freigegeben)." },
  });
}
