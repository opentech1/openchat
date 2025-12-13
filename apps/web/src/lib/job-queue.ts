/**
 * Redis-backed background job queue for non-blocking operations
 *
 * This module provides a persistent job queue for operations like PDF exports,
 * batch deletions, and cleanup tasks. Jobs are processed asynchronously,
 * allowing the API to return immediately with a job ID for status polling.
 *
 * ARCHITECTURE:
 * 1. Client calls API -> API creates job in Redis -> Returns job ID immediately
 * 2. Worker polls for pending jobs -> Claims job atomically -> Processes
 * 3. Client polls job status -> Gets result when complete
 *
 * KEY PATTERNS:
 * - jobs:pending      - List of pending job IDs (FIFO queue)
 * - jobs:processing   - List of currently processing job IDs
 * - jobs:completed    - Hash of completed jobs (job ID -> result)
 * - jobs:failed       - Hash of failed jobs (job ID -> error)
 * - job:{jobId}       - Individual job data (JSON)
 *
 * TTLs:
 * - Pending jobs: 24 hours (auto-expire stale jobs)
 * - Processing jobs: 5 minutes timeout (heartbeat required)
 * - Completed jobs: 1 hour (for status checks)
 * - Failed jobs: 24 hours (for debugging)
 *
 * @see redis.ts for the underlying Redis client
 */

import { redis } from "./redis";

// =============================================================================
// Types
// =============================================================================

export type JobType = "export_pdf" | "export_json" | "batch_delete" | "cleanup";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job<T = unknown> {
	id: string;
	type: JobType;
	payload: T;
	status: JobStatus;
	createdAt: number;
	startedAt?: number;
	completedAt?: number;
	result?: unknown;
	error?: string;
	retryCount: number;
	maxRetries: number;
}

export interface ExportJobPayload {
	chatId: string;
	userId: string;
	format: "pdf" | "json";
}

export interface BatchDeleteJobPayload {
	chatIds: string[];
	userId: string;
}

export interface CleanupJobPayload {
	type: "expired_streams" | "stale_jobs" | "orphaned_data";
	olderThanMs?: number;
}

export interface CreateJobResult {
	jobId: string;
	estimatedWait?: number;
}

export interface CreateJobOptions {
	maxRetries?: number;
}

export interface QueueStats {
	pending: number;
	processing: number;
	completed: number;
	failed: number;
}

// =============================================================================
// Constants
// =============================================================================

const KEY_PREFIX = {
	job: "job:",
	pendingList: "jobs:pending",
	processingList: "jobs:processing",
	completedHash: "jobs:completed",
	failedHash: "jobs:failed",
} as const;

// TTLs in seconds
const TTL = {
	pendingJob: 86400, // 24 hours
	processingTimeout: 300, // 5 minutes
	completedJob: 3600, // 1 hour
	failedJob: 86400, // 24 hours
} as const;

// Default configuration
const DEFAULT_MAX_RETRIES = 3;
const JOB_WAIT_POLL_INTERVAL_MS = 500;

// =============================================================================
// Availability Check
// =============================================================================

/**
 * Check if the job queue is available
 *
 * @returns True if Redis is configured and available
 */
export function isJobQueueAvailable(): boolean {
	return redis.isConfigured();
}

// =============================================================================
// Job Creation
// =============================================================================

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 10);
	return `job_${timestamp}_${random}`;
}

/**
 * Create a new job in the queue
 *
 * Jobs are added atomically to both the job data store and the pending queue.
 * If Redis is unavailable, returns a fallback job ID for graceful degradation.
 *
 * @param type - Type of job to create
 * @param payload - Job-specific payload data
 * @param options - Optional configuration (maxRetries)
 * @returns Job ID and estimated wait time
 */
export async function createJob<T>(
	type: JobType,
	payload: T,
	options: CreateJobOptions = {},
): Promise<CreateJobResult> {
	const jobId = generateJobId();

	// Graceful degradation if Redis unavailable
	if (!isJobQueueAvailable()) {
		console.warn("[job-queue] Redis unavailable, returning fallback job ID");
		return { jobId: `fallback_${jobId}` };
	}

	const job: Job<T> = {
		id: jobId,
		type,
		payload,
		status: "pending",
		createdAt: Date.now(),
		retryCount: 0,
		maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
	};

	try {
		const client = await redis.get();

		// Atomic pipeline: store job data and add to pending queue
		const pipeline = client.pipeline();
		pipeline.set(`${KEY_PREFIX.job}${jobId}`, JSON.stringify(job), {
			ex: TTL.pendingJob,
		});
		pipeline.lpush(KEY_PREFIX.pendingList, jobId);
		await pipeline.exec();

		// Estimate wait time based on queue length
		const queueLength = await client.llen(KEY_PREFIX.pendingList);
		const estimatedWait = queueLength * 2000; // ~2 seconds per job estimate

		return { jobId, estimatedWait };
	} catch (error) {
		console.error("[job-queue] Failed to create job:", error);
		// Return fallback on error
		return { jobId: `fallback_${jobId}` };
	}
}

// =============================================================================
// Job Status
// =============================================================================

/**
 * Get the current status of a job
 *
 * @param jobId - Job ID to check
 * @returns Job data or null if not found
 */
export async function getJobStatus(jobId: string): Promise<Job | null> {
	if (!isJobQueueAvailable()) {
		return null;
	}

	// Handle fallback jobs
	if (jobId.startsWith("fallback_")) {
		return {
			id: jobId,
			type: "export_pdf",
			payload: {},
			status: "completed",
			createdAt: Date.now(),
			completedAt: Date.now(),
			retryCount: 0,
			maxRetries: 0,
			result: { message: "Processed synchronously (Redis unavailable)" },
		};
	}

	try {
		const client = await redis.get();
		const jobData = await client.get<string>(`${KEY_PREFIX.job}${jobId}`);

		if (!jobData) {
			// Check completed hash
			const completedResult = await client.hget<string>(
				KEY_PREFIX.completedHash,
				jobId,
			);
			if (completedResult) {
				return JSON.parse(completedResult) as Job;
			}

			// Check failed hash
			const failedResult = await client.hget<string>(
				KEY_PREFIX.failedHash,
				jobId,
			);
			if (failedResult) {
				return JSON.parse(failedResult) as Job;
			}

			return null;
		}

		return JSON.parse(jobData) as Job;
	} catch (error) {
		console.error("[job-queue] Failed to get job status:", error);
		return null;
	}
}

/**
 * Get the result of a completed job
 *
 * @param jobId - Job ID to get result for
 * @returns Job result or null if not found/not completed
 */
export async function getJobResult(jobId: string): Promise<unknown | null> {
	const job = await getJobStatus(jobId);
	if (!job || job.status !== "completed") {
		return null;
	}
	return job.result ?? null;
}

/**
 * Wait for a job to complete
 *
 * Polls the job status until it reaches a terminal state (completed/failed)
 * or the timeout is reached.
 *
 * @param jobId - Job ID to wait for
 * @param timeoutMs - Maximum time to wait (default 30 seconds)
 * @returns Final job state
 * @throws Error if timeout or job not found
 */
export async function waitForJob(
	jobId: string,
	timeoutMs: number = 30000,
): Promise<Job> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		const job = await getJobStatus(jobId);

		if (!job) {
			throw new Error(`Job ${jobId} not found`);
		}

		if (job.status === "completed" || job.status === "failed") {
			return job;
		}

		// Wait before next poll
		await new Promise((resolve) =>
			setTimeout(resolve, JOB_WAIT_POLL_INTERVAL_MS),
		);
	}

	throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}

// =============================================================================
// Job Processing (Worker)
// =============================================================================

/**
 * Claim the next pending job for processing
 *
 * Uses atomic LMOVE to move job from pending to processing queue,
 * preventing double-processing by multiple workers.
 *
 * Note: Upstash Redis uses LMOVE instead of deprecated RPOPLPUSH.
 * Workers should poll this function with a delay.
 *
 * @returns Claimed job or null if queue is empty
 */
export async function claimNextJob(): Promise<Job | null> {
	if (!isJobQueueAvailable()) {
		return null;
	}

	try {
		const client = await redis.get();

		// Atomic move from pending to processing
		// LMOVE: pop from right of pending (oldest), push to left of processing
		// This implements FIFO queue semantics
		const jobId = await client.lmove<string>(
			KEY_PREFIX.pendingList,
			KEY_PREFIX.processingList,
			"right",
			"left",
		);

		if (!jobId) {
			return null;
		}

		// Get job data
		const jobData = await client.get<string>(`${KEY_PREFIX.job}${jobId}`);
		if (!jobData) {
			// Job data expired, remove from processing
			await client.lrem(KEY_PREFIX.processingList, 1, jobId);
			return null;
		}

		// Update job status to processing
		const job = JSON.parse(jobData) as Job;
		job.status = "processing";
		job.startedAt = Date.now();

		// Update job with processing TTL (will timeout if worker dies)
		await client.set(`${KEY_PREFIX.job}${jobId}`, JSON.stringify(job), {
			ex: TTL.processingTimeout,
		});

		return job;
	} catch (error) {
		console.error("[job-queue] Failed to claim job:", error);
		return null;
	}
}

/**
 * Mark a job as completed with result
 *
 * Removes from processing queue, stores result, and updates job status.
 *
 * @param jobId - Job ID to complete
 * @param result - Result data to store
 */
export async function completeJob(jobId: string, result: unknown): Promise<void> {
	if (!isJobQueueAvailable()) {
		return;
	}

	try {
		const client = await redis.get();

		// Get current job data
		const jobData = await client.get<string>(`${KEY_PREFIX.job}${jobId}`);
		if (!jobData) {
			console.warn(`[job-queue] Job ${jobId} not found for completion`);
			return;
		}

		const job = JSON.parse(jobData) as Job;
		job.status = "completed";
		job.completedAt = Date.now();
		job.result = result;

		const pipeline = client.pipeline();

		// Remove from processing queue
		pipeline.lrem(KEY_PREFIX.processingList, 1, jobId);

		// Store in completed hash (for historical lookup)
		pipeline.hset(KEY_PREFIX.completedHash, { [jobId]: JSON.stringify(job) });

		// Update job data with completion TTL
		pipeline.set(`${KEY_PREFIX.job}${jobId}`, JSON.stringify(job), {
			ex: TTL.completedJob,
		});

		// Set TTL on completed hash entries (clean up old entries)
		// Note: Redis doesn't support TTL on hash fields, so we use job key TTL

		await pipeline.exec();
	} catch (error) {
		console.error("[job-queue] Failed to complete job:", error);
	}
}

/**
 * Mark a job as failed with error
 *
 * If retries remain, requeues the job. Otherwise, moves to failed state.
 *
 * @param jobId - Job ID to fail
 * @param error - Error message to store
 */
export async function failJob(jobId: string, error: string): Promise<void> {
	if (!isJobQueueAvailable()) {
		return;
	}

	try {
		const client = await redis.get();

		// Get current job data
		const jobData = await client.get<string>(`${KEY_PREFIX.job}${jobId}`);
		if (!jobData) {
			console.warn(`[job-queue] Job ${jobId} not found for failure`);
			return;
		}

		const job = JSON.parse(jobData) as Job;
		job.retryCount += 1;

		const pipeline = client.pipeline();

		// Remove from processing queue
		pipeline.lrem(KEY_PREFIX.processingList, 1, jobId);

		if (job.retryCount < job.maxRetries) {
			// Requeue for retry
			job.status = "pending";
			job.error = `Retry ${job.retryCount}/${job.maxRetries}: ${error}`;

			pipeline.set(`${KEY_PREFIX.job}${jobId}`, JSON.stringify(job), {
				ex: TTL.pendingJob,
			});
			pipeline.lpush(KEY_PREFIX.pendingList, jobId);

			console.log(
				`[job-queue] Requeuing job ${jobId} (retry ${job.retryCount}/${job.maxRetries})`,
			);
		} else {
			// Max retries exceeded, mark as failed
			job.status = "failed";
			job.completedAt = Date.now();
			job.error = error;

			// Store in failed hash
			pipeline.hset(KEY_PREFIX.failedHash, { [jobId]: JSON.stringify(job) });

			// Update job data with failed TTL
			pipeline.set(`${KEY_PREFIX.job}${jobId}`, JSON.stringify(job), {
				ex: TTL.failedJob,
			});

			console.error(
				`[job-queue] Job ${jobId} failed permanently after ${job.maxRetries} retries: ${error}`,
			);
		}

		await pipeline.exec();
	} catch (err) {
		console.error("[job-queue] Failed to fail job:", err);
	}
}

/**
 * Send heartbeat for a processing job
 *
 * Extends the job TTL to prevent timeout while still processing.
 * Call this periodically for long-running jobs.
 *
 * @param jobId - Job ID to heartbeat
 * @returns True if heartbeat successful, false if job not found
 */
export async function heartbeatJob(jobId: string): Promise<boolean> {
	if (!isJobQueueAvailable()) {
		return false;
	}

	try {
		const client = await redis.get();
		const key = `${KEY_PREFIX.job}${jobId}`;

		// Extend TTL
		const result = await client.expire(key, TTL.processingTimeout);
		return result === 1;
	} catch (error) {
		console.error("[job-queue] Failed to heartbeat job:", error);
		return false;
	}
}

// =============================================================================
// Queue Stats
// =============================================================================

/**
 * Get current queue statistics
 *
 * @returns Counts for each queue state
 */
export async function getQueueStats(): Promise<QueueStats> {
	if (!isJobQueueAvailable()) {
		return { pending: 0, processing: 0, completed: 0, failed: 0 };
	}

	try {
		const client = await redis.get();

		const [pending, processing, completed, failed] = await Promise.all([
			client.llen(KEY_PREFIX.pendingList),
			client.llen(KEY_PREFIX.processingList),
			client.hlen(KEY_PREFIX.completedHash),
			client.hlen(KEY_PREFIX.failedHash),
		]);

		return {
			pending,
			processing,
			completed,
			failed,
		};
	} catch (error) {
		console.error("[job-queue] Failed to get queue stats:", error);
		return { pending: 0, processing: 0, completed: 0, failed: 0 };
	}
}

// =============================================================================
// Queue Management
// =============================================================================

/**
 * Clean up stale processing jobs
 *
 * Jobs that have been processing longer than the timeout are considered
 * stale (worker died). This function requeues them for retry.
 *
 * @returns Number of jobs recovered
 */
export async function recoverStaleJobs(): Promise<number> {
	if (!isJobQueueAvailable()) {
		return 0;
	}

	try {
		const client = await redis.get();
		let recovered = 0;

		// Get all jobs in processing queue
		const processingJobs = await client.lrange(KEY_PREFIX.processingList, 0, -1);

		for (const jobId of processingJobs) {
			// Check if job data still exists (TTL not expired)
			const jobData = await client.get<string>(`${KEY_PREFIX.job}${jobId}`);

			if (!jobData) {
				// Job TTL expired - it was stale, remove from processing
				await client.lrem(KEY_PREFIX.processingList, 1, jobId);
				console.log(`[job-queue] Removed expired stale job: ${jobId}`);
				recovered++;
				continue;
			}

			const job = JSON.parse(jobData) as Job;

			// Check if job has exceeded processing timeout
			if (job.startedAt && Date.now() - job.startedAt > TTL.processingTimeout * 1000) {
				// Requeue for retry
				await failJob(jobId, "Processing timeout - worker may have died");
				recovered++;
			}
		}

		return recovered;
	} catch (error) {
		console.error("[job-queue] Failed to recover stale jobs:", error);
		return 0;
	}
}

/**
 * Get list of pending job IDs
 *
 * @param limit - Maximum number to return
 * @returns Array of pending job IDs
 */
export async function getPendingJobIds(limit: number = 100): Promise<string[]> {
	if (!isJobQueueAvailable()) {
		return [];
	}

	try {
		const client = await redis.get();
		return await client.lrange(KEY_PREFIX.pendingList, 0, limit - 1);
	} catch (error) {
		console.error("[job-queue] Failed to get pending jobs:", error);
		return [];
	}
}

/**
 * Get list of processing job IDs
 *
 * @param limit - Maximum number to return
 * @returns Array of processing job IDs
 */
export async function getProcessingJobIds(limit: number = 100): Promise<string[]> {
	if (!isJobQueueAvailable()) {
		return [];
	}

	try {
		const client = await redis.get();
		return await client.lrange(KEY_PREFIX.processingList, 0, limit - 1);
	} catch (error) {
		console.error("[job-queue] Failed to get processing jobs:", error);
		return [];
	}
}

/**
 * Cancel a pending job
 *
 * Only works for jobs that haven't started processing yet.
 *
 * @param jobId - Job ID to cancel
 * @returns True if cancelled, false if not found or already processing
 */
export async function cancelJob(jobId: string): Promise<boolean> {
	if (!isJobQueueAvailable()) {
		return false;
	}

	try {
		const client = await redis.get();

		// Check job status
		const job = await getJobStatus(jobId);
		if (!job || job.status !== "pending") {
			return false;
		}

		const pipeline = client.pipeline();

		// Remove from pending queue
		pipeline.lrem(KEY_PREFIX.pendingList, 1, jobId);

		// Delete job data
		pipeline.del(`${KEY_PREFIX.job}${jobId}`);

		const results = await pipeline.exec();

		// Check if removal was successful (lrem returns count of removed)
		return (results?.[0] as number) > 0;
	} catch (error) {
		console.error("[job-queue] Failed to cancel job:", error);
		return false;
	}
}

/**
 * Purge completed jobs older than a threshold
 *
 * Note: Due to Redis hash limitations, this clears the entire completed hash.
 * Individual job data will still expire via TTL.
 *
 * @returns True if purge successful
 */
export async function purgeCompletedJobs(): Promise<boolean> {
	if (!isJobQueueAvailable()) {
		return false;
	}

	try {
		const client = await redis.get();
		await client.del(KEY_PREFIX.completedHash);
		return true;
	} catch (error) {
		console.error("[job-queue] Failed to purge completed jobs:", error);
		return false;
	}
}

/**
 * Purge failed jobs
 *
 * @returns True if purge successful
 */
export async function purgeFailedJobs(): Promise<boolean> {
	if (!isJobQueueAvailable()) {
		return false;
	}

	try {
		const client = await redis.get();
		await client.del(KEY_PREFIX.failedHash);
		return true;
	} catch (error) {
		console.error("[job-queue] Failed to purge failed jobs:", error);
		return false;
	}
}
