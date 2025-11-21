/**
 * File upload hook for chat composer
 * Handles file selection, upload to Convex, and file management
 */

import { useCallback, useReducer } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "@server/convex/_generated/dataModel";
import { logError } from "@/lib/logger";
import type { ConvexFileAttachment } from "@/lib/convex-types";

type FileAttachment = ConvexFileAttachment;

// File upload state
type FileUploadState = {
	uploadingFiles: File[];
	uploadedFiles: FileAttachment[];
};

type FileUploadAction =
	| { type: "ADD_UPLOADING"; payload: File }
	| { type: "REMOVE_UPLOADING"; payload: File }
	| { type: "ADD_UPLOADED"; payload: FileAttachment }
	| { type: "REMOVE_UPLOADED"; payload: number }
	| { type: "CLEAR_UPLOADED" }
	| { type: "RESTORE_UPLOADED"; payload: FileAttachment[] };

function fileUploadReducer(state: FileUploadState, action: FileUploadAction): FileUploadState {
	switch (action.type) {
		case "ADD_UPLOADING":
			return { ...state, uploadingFiles: [...state.uploadingFiles, action.payload] };
		case "REMOVE_UPLOADING":
			return { ...state, uploadingFiles: state.uploadingFiles.filter(f => f !== action.payload) };
		case "ADD_UPLOADED":
			return { ...state, uploadedFiles: [...state.uploadedFiles, action.payload] };
		case "REMOVE_UPLOADED":
			return { ...state, uploadedFiles: state.uploadedFiles.filter((_, i) => i !== action.payload) };
		case "CLEAR_UPLOADED":
			return { ...state, uploadedFiles: [] };
		case "RESTORE_UPLOADED":
			return { ...state, uploadedFiles: action.payload };
		default:
			return state;
	}
}

export interface UseFileUploadParams {
	userId?: Id<"users"> | null;
	chatId?: Id<"chats"> | null;
}

export interface UseFileUploadResult {
	uploadingFiles: File[];
	uploadedFiles: FileAttachment[];
	quota: { used: number; limit: number } | undefined;
	handleFileSelect: (file: File) => Promise<void>;
	handleRemoveFile: (index: number) => void;
	clearUploadedFiles: () => void;
	restoreUploadedFiles: (files: FileAttachment[]) => void;
}

/**
 * Hook to manage file uploads in chat composer
 */
export function useFileUpload({ userId, chatId }: UseFileUploadParams): UseFileUploadResult {
	// Consolidated file upload state with useReducer
	const [fileUploadState, dispatchFileUpload] = useReducer(fileUploadReducer, {
		uploadingFiles: [],
		uploadedFiles: [],
	});
	const { uploadingFiles, uploadedFiles } = fileUploadState;

	// Convex mutations and queries
	const generateUploadUrl = useMutation(api.files.generateUploadUrl);
	const saveFileMetadata = useMutation(api.files.saveFileMetadata);
	const quota = useQuery(
		api.files.getUserQuota,
		userId ? { userId } : "skip"
	);

	// File upload handler
	const handleFileSelect = useCallback(
		async (file: File) => {
			// Check if we have userId and chatId
			if (!userId || !chatId) {
				toast.error("Unable to upload file. Please try again.");
				return;
			}

			// Check quota first
			if (quota && quota.used >= quota.limit) {
				toast.error("You've reached your file upload limit", { duration: 5000 });
				return;
			}

			// Add to uploading state
			dispatchFileUpload({ type: "ADD_UPLOADING", payload: file });

			try {
				// Step 1: Generate upload URL
				const uploadUrl = await generateUploadUrl({ userId, chatId });

				// Step 2: Upload file to Convex storage
				const uploadResponse = await fetch(uploadUrl, {
					method: "POST",
					headers: { "Content-Type": file.type },
					body: file,
				});

				if (!uploadResponse.ok) {
					throw new Error("Failed to upload file");
				}

				const { storageId } = (await uploadResponse.json()) as {
					storageId: Id<"_storage">;
				};

				// Step 3: Save file metadata and get URL
				const { filename: sanitizedFilename, url } = await saveFileMetadata({
					userId,
					chatId,
					storageId,
					filename: file.name,
					contentType: file.type,
					size: file.size,
				});

				// Add to uploaded files with URL
				dispatchFileUpload({
					type: "ADD_UPLOADED",
					payload: {
						storageId,
						filename: sanitizedFilename,
						contentType: file.type,
						size: file.size,
						uploadedAt: Date.now(),
						url: url || undefined,
					},
				});

				toast.success(`${sanitizedFilename} uploaded successfully`);
			} catch (error) {
				logError("Failed to upload file", error);

				// Check if it's a quota error
				if (error instanceof Error && error.message.includes("quota exceeded")) {
					toast.error("You've reached your file upload limit", { duration: 5000 });
				} else {
					toast.error(
						error instanceof Error ? error.message : "Failed to upload file"
					);
				}
			} finally {
				// Remove from uploading state
				dispatchFileUpload({ type: "REMOVE_UPLOADING", payload: file });
			}
		},
		[userId, chatId, quota, generateUploadUrl, saveFileMetadata]
	);

	// Remove uploaded file
	const handleRemoveFile = useCallback((index: number) => {
		dispatchFileUpload({ type: "REMOVE_UPLOADED", payload: index });
	}, []);

	// Clear all uploaded files (used after sending message)
	const clearUploadedFiles = useCallback(() => {
		dispatchFileUpload({ type: "CLEAR_UPLOADED" });
	}, []);

	// Restore uploaded files (used when send fails)
	const restoreUploadedFiles = useCallback((files: FileAttachment[]) => {
		dispatchFileUpload({ type: "RESTORE_UPLOADED", payload: files });
	}, []);

	return {
		uploadingFiles,
		uploadedFiles,
		quota,
		handleFileSelect,
		handleRemoveFile,
		clearUploadedFiles,
		restoreUploadedFiles,
	};
}
