# Creating a Demo GIF for Songsmith

This guide explains how to create a demo GIF showing Songsmith in action.

## Recommended Tools

### macOS
- **Kap** (Free) - https://getkap.co/
  - Simple, native macOS app
  - Built-in GIF conversion
  - Easy to use

- **Gifox** (Paid) - https://gifox.app/
  - High-quality GIFs
  - Recording features

### Linux
- **Peek** (Free) - https://github.com/phw/peek
  - Lightweight
  - Simple interface

### Windows
- **ScreenToGif** (Free) - https://www.screentogif.com/
  - Full-featured
  - Built-in editor

### Cross-platform
- **LICEcap** (Free) - https://www.cockos.com/licecap/
  - Simple, lightweight
  - Works on Mac/Windows/Linux

## Steps to Create the Demo GIF

### 1. Prepare Your Environment
```bash
# Make sure your app is running
npm run dev
```

### 2. Plan Your Demo Flow
Show these key features in order:

1. **Form Input**
   - Fill in lyrics (base text)
   - Select emotion (e.g., "sad", "happy", "love")
   - Optionally select genre
   - Optionally check "Enable Human-in-the-Loop"

2. **Generate Button**
   - Click "Generate Draft"
   - Show the loading progress with steps (Planning, Acting, Observing, Reflecting)

3. **Human-in-the-Loop (if enabled)**
   - Show the approval dialog
   - Optionally add feedback
   - Click "Approve" or "Regenerate with Feedback"

4. **Results Display**
   - Show the Creative Brief
   - Show the Song Structure with sections
   - Show the Evaluation (if available)
   - Optionally show the Trace

### 3. Recording Tips

- **Resolution**: Record at 1280x720 or higher for better quality
- **Duration**: Keep it under 30-60 seconds
- **Frame Rate**: 10-15 FPS is usually enough for UI demos
- **File Size**: Optimize to keep under 2-3 MB for GitHub

### 4. Recording Workflow

1. **Start your recording tool**
   - Position the recording window to capture the browser
   - Adjust the capture area to focus on the app

2. **Perform the demo**
   - Enter sample data:
     - Lyrics: "Walking through the rain, feeling all the pain"
     - Emotion: "sad"
     - Genre: "ballad" (optional)
     - Enable Human-in-the-Loop checkbox
   - Click "Generate Draft"
   - Wait for the progress indicators
   - If human-in-the-loop is enabled, show the approval dialog
   - Show the final results

3. **Stop recording**
   - Save as GIF format
   - Name it `demo.gif`

### 5. Optimize the GIF (Optional but Recommended)

Use tools to optimize file size:

- **Gifsicle** (command-line):
  ```bash
  gifsicle -O3 --lossy=80 demo.gif -o demo-optimized.gif
  ```

- **ezgif.com** (online):
  - Upload your GIF
  - Use "Optimize" or "Compress" tools
  - Download optimized version

### 6. Add to Repository

```bash
# Add the demo.gif to your repository
git add demo.gif
git commit -m "Add demo GIF"
git push
```

Then update the README.md to reference it (already done in the README).

## Example Demo Script

Here's a suggested demo flow:

1. **Opening** (1-2 seconds)
   - Show the clean, minimalist interface
   - Highlight the title "Songsmith"

2. **Form Filling** (3-5 seconds)
   - Type lyrics: "In the silence of the night, I find my way"
   - Type emotion: "melancholic"
   - Select genre: "ballad"
   - Check "Enable Human-in-the-Loop"

3. **Generation** (10-15 seconds)
   - Click "Generate Draft"
   - Show progress steps:
     - Planning
     - Acting (with tool execution)
     - Observing
     - Reflecting
   - If human-in-the-loop: Show approval dialog
   - Add feedback: "Make the chorus more emotional"
   - Click "Regenerate with Feedback"

4. **Results** (5-10 seconds)
   - Scroll through Creative Brief
   - Show Song Structure sections
   - Show Evaluation results
   - Optional: Expand Trace

5. **Total duration**: ~20-30 seconds

## Alternative: Create a Video Instead

If GIF size is a concern, you can also:

1. Record as MP4 using QuickTime (Mac) or OBS (cross-platform)
2. Upload to YouTube/Vimeo
3. Embed in README using iframe or link

Example README section:
```markdown
## 🎬 Demo

Watch the demo on [YouTube](https://youtube.com/watch?v=...) or view the GIF below:

![Songsmith Demo](./demo.gif)
```

## Tips for Best Results

- **Clean browser**: Close unnecessary tabs, use clean browser window
- **Good contrast**: Ensure the dark theme is visible
- **Smooth scrolling**: Scroll slowly through results
- **Highlight interactions**: Pause slightly on buttons before clicking
- **Remove sensitive data**: Don't show API keys or personal information
- **Use mock mode**: If you don't have OpenAI credits, use `USE_MOCK_LLM=true` for faster, consistent results

Happy recording! 🎥
