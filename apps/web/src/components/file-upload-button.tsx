"use client";

import React, { useRef } from "react";
import { Paperclip } from "@/lib/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModelCapabilities {
	image?: boolean;
	audio?: boolean;
	video?: boolean;
}

interface FileUploadButtonProps {
	onFileSelect: (file: File) => void;
	disabled?: boolean;
	maxSizeMB?: number;
	allowedTypes?: string[];
	modelCapabilities?: ModelCapabilities;
	onUnsupportedModel?: () => void;
}

const IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"image/bmp",
];

const AUDIO_TYPES = [
	"audio/mpeg",
	"audio/mp3",
	"audio/wav",
	"audio/ogg",
	"audio/m4a",
	"audio/aac",
	"audio/webm",
];

const VIDEO_TYPES = [
	"video/mp4",
	"video/mpeg",
	"video/quicktime",
	"video/webm",
	"video/x-msvideo",
	"video/x-ms-wmv",
];

const DOCUMENT_TYPES = [
	"application/pdf",
	"text/plain",
	"text/markdown",
];

const DEFAULT_MAX_SIZE_MB = 10;
const AUDIO_MAX_SIZE_MB = 25; // Higher limit for audio files
const VIDEO_MAX_SIZE_MB = 50; // Higher limit for video files

export function FileUploadButton({
	onFileSelect,
	disabled = false,
	maxSizeMB,
	allowedTypes,
	modelCapabilities,
	onUnsupportedModel,
}: FileUploadButtonProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Determine allowed types based on model capabilities
	const getAllowedTypes = (): string[] => {
		if (allowedTypes) return allowedTypes;

		// Always include documents
		const types: string[] = [...DOCUMENT_TYPES];

		// Add types based on capabilities
		if (modelCapabilities?.image) types.push(...IMAGE_TYPES);
		if (modelCapabilities?.audio) types.push(...AUDIO_TYPES);
		if (modelCapabilities?.video) types.push(...VIDEO_TYPES);

		// If no capabilities specified or no special capabilities, just allow images and documents
		if (!modelCapabilities || (!modelCapabilities.image && !modelCapabilities.audio && !modelCapabilities.video)) {
			types.push(...IMAGE_TYPES); // Default to allowing images
		}

		return types;
	};

	// Determine max size based on file type
	const getMaxSizeForType = (fileType: string): number => {
		if (maxSizeMB !== undefined) return maxSizeMB;

		if (VIDEO_TYPES.includes(fileType)) return VIDEO_MAX_SIZE_MB;
		if (AUDIO_TYPES.includes(fileType)) return AUDIO_MAX_SIZE_MB;
		return DEFAULT_MAX_SIZE_MB;
	};

	const handleButtonClick = () => {
		// Check if model supports any file uploads
		if (modelCapabilities && !modelCapabilities.image && !modelCapabilities.audio && !modelCapabilities.video) {
			toast.error(
				<div className="flex flex-col gap-2">
					<span>This model doesn't support file uploads</span>
					{onUnsupportedModel && (
						<button
							onClick={onUnsupportedModel}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onUnsupportedModel();
								}
							}}
							className="text-sm text-blue-500 hover:text-blue-600 underline text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
						>
							Switch to a model with file support
						</button>
					)}
				</div>,
				{ duration: 5000 }
			);
			return;
		}
		fileInputRef.current?.click();
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];

		if (!file) {
			return;
		}

		const effectiveAllowedTypes = getAllowedTypes();
		const effectiveMaxSize = getMaxSizeForType(file.type);

		// Validate file type
		if (!effectiveAllowedTypes.includes(file.type)) {
			// Check what types of files this is
			const isImage = IMAGE_TYPES.includes(file.type);
			const isAudio = AUDIO_TYPES.includes(file.type);
			const isVideo = VIDEO_TYPES.includes(file.type);

			// Provide specific error messages
			if (isImage && !modelCapabilities?.image) {
				toast.error(
					<div className="flex flex-col gap-2">
						<span>This model doesn't support image uploads</span>
						{onUnsupportedModel && (
							<button
								onClick={onUnsupportedModel}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onUnsupportedModel();
									}
								}}
								className="text-sm text-blue-500 hover:text-blue-600 underline text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
							>
								Switch to a vision model
							</button>
						)}
					</div>,
					{ duration: 5000 }
				);
			} else if (isAudio && !modelCapabilities?.audio) {
				toast.error(
					<div className="flex flex-col gap-2">
						<span>This model doesn't support audio uploads</span>
						{onUnsupportedModel && (
							<button
								onClick={onUnsupportedModel}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onUnsupportedModel();
									}
								}}
								className="text-sm text-blue-500 hover:text-blue-600 underline text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
							>
								Switch to an audio-capable model
							</button>
						)}
					</div>,
					{ duration: 5000 }
				);
			} else if (isVideo && !modelCapabilities?.video) {
				toast.error(
					<div className="flex flex-col gap-2">
						<span>This model doesn't support video uploads</span>
						{onUnsupportedModel && (
							<button
								onClick={onUnsupportedModel}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onUnsupportedModel();
									}
								}}
								className="text-sm text-blue-500 hover:text-blue-600 underline text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
							>
								Switch to a video-capable model
							</button>
						)}
					</div>,
					{ duration: 5000 }
				);
			} else {
				const supportedTypes = [];
				if (modelCapabilities?.image) supportedTypes.push("images");
				if (modelCapabilities?.audio) supportedTypes.push("audio");
				if (modelCapabilities?.video) supportedTypes.push("video");
				supportedTypes.push("documents");

				toast.error(
					`File type not supported. This model accepts: ${supportedTypes.join(", ")}`,
				);
			}
			resetInput();
			return;
		}

		// Validate file size
		const fileSizeMB = file.size / (1024 * 1024);
		if (fileSizeMB > effectiveMaxSize) {
			toast.error(
				`File size exceeds ${effectiveMaxSize}MB limit. Please select a smaller file.`,
			);
			resetInput();
			return;
		}

		// File is valid, call onFileSelect
		onFileSelect(file);
		resetInput();
	};

	const resetInput = () => {
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const effectiveAllowedTypes = getAllowedTypes();

	return (
		<>
			<input
				ref={fileInputRef}
				type="file"
				className="hidden"
				onChange={handleFileChange}
				disabled={disabled}
				accept={effectiveAllowedTypes.join(",")}
			/>
			<TooltipProvider delayDuration={100}>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={handleButtonClick}
							disabled={disabled}
							className={cn(
								"inline-flex items-center justify-center",
								"size-9",
								"text-sm",
								"rounded-lg border",
								"bg-background shadow-xs",
								"transition-all",
								"hover:bg-accent hover:text-accent-foreground",
								"dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								"disabled:pointer-events-none disabled:opacity-50",
							)}
							aria-label="Upload file"
						>
							<Paperclip className="size-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<span>Upload file</span>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</>
	);
}
