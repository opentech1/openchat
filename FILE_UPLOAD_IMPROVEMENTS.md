# File Upload System Improvements

## Changes Implemented

### 1. ✅ Removed 150 File Quota Display
- Removed explicit "150 file limit" text from toast messages
- Changed to generic "file upload limit" messages
- Removed quota counter display from UI

### 2. ✅ Changed Upload Button to Icon
- Replaced "Upload File" button with simple paperclip icon
- Added tooltip on hover showing "Upload file"
- Made button more compact (size-9 square button)

### 3. ✅ Added Model Capability Tooltips
- **🧠 Brain icon (purple)**: Advanced reasoning and thinking capabilities
- **🖼️ Image icon (blue)**: Can process and understand images
- **🎤 Mic icon (green)**: Can process and understand audio files
- **🎬 Video icon (red)**: Can process and understand video files

### 4. ✅ Dynamic File Type Support Based on Model
- Models are automatically detected for their capabilities:
  - **Image support**: GPT-4V, Claude 3/4, Gemini, Qwen-VL, Pixtral, etc.
  - **Audio support**: Gemini 2.0 Flash, GPT-4o-audio, Whisper models
  - **Video support**: Gemini 2.0 Flash, video-specific models
- File types allowed dynamically based on selected model
- File size limits adjust based on type:
  - Images: 10MB
  - Documents: 10MB
  - Audio: 25MB
  - Video: 50MB

### 5. ✅ Unsupported File Upload Handling
- When trying to upload unsupported file types, shows specific error:
  - "This model doesn't support image/audio/video uploads"
  - Includes "Switch to a [type]-capable model" button
- Clicking switch button automatically selects compatible model
- Shows success toast when switching models

## Technical Implementation

### Files Modified

1. **`/apps/web/src/components/chat-composer.tsx`**
   - Removed quota display
   - Pass model capabilities to FileUploadButton
   - Added model switching logic

2. **`/apps/web/src/components/file-upload-button.tsx`**
   - Changed to icon-only design with tooltip
   - Added dynamic file type filtering based on capabilities
   - Added smart error messages with model switching

3. **`/apps/web/src/components/model-selector.tsx`**
   - Added capability icons (Image, Mic, Video)
   - Tooltips for each capability
   - Updated type definitions

4. **`/apps/web/src/app/api/openrouter/models/route.ts`**
   - Added capability detection functions
   - Detects image, audio, video support from model IDs
   - Returns capabilities in model data

5. **`/apps/server/convex/files.ts`**
   - Added audio and video file types
   - Increased size limits for audio (25MB) and video (50MB)
   - Updated validation logic

## User Experience

### For Users
1. Clean, minimal paperclip icon for uploads
2. Clear visual indicators of what each model can do
3. Helpful error messages when trying incompatible uploads
4. One-click switching to compatible models
5. Appropriate file size limits for different media types

### For Models
- **Text-only models**: Can upload PDFs and text documents
- **Vision models**: Additionally can upload images
- **Gemini 2.0 Flash**: Full support for images, audio, and video
- **GPT-4o models**: Image support, some with audio
- **Claude 3/4**: Image support

## Testing
- Upload buttons dynamically enable/disable based on model
- Error messages provide clear guidance
- Model switching is seamless
- File size limits are enforced correctly