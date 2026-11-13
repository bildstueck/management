import "server-only";
import { prisma } from "@/lib/prisma";

export function createRunningPublishJob(postId: string) {
  return prisma.publishJob.create({ data: { postId, status: "RUNNING" } });
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
