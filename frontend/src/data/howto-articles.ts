export interface HowToArticleData {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
}

export const HOWTO_ARTICLES: HowToArticleData[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started with porchsongs',
    excerpt: 'Learn how to paste lyrics, run your first rewrite, and save songs to your library.',
    content: `Getting Started with porchsongs

## Step 1: Paste your lyrics
Copy the lyrics from your source and paste them into the rewrite input area. porchsongs will automatically detect the song title and artist.

## Step 2: Choose your settings
Select your preferred AI model and any specific instructions for the rewrite (e.g., "simplify the chord progression" or "lower the key by two steps").

## Step 3: Review and refine
After the rewrite completes, use the comparison view to see changes side-by-side. If something isn't quite right, use the chat panel to request specific adjustments.

## Step 4: Save and export
Save the rewrite to your library. You can organize songs into folders and export them as PDF performance sheets.`,
  },
  {
    slug: 'chat-refinement',
    title: 'Using Chat to Refine Rewrites',
    excerpt: 'Master the iterative chat feature to get exactly the rewrite you want.',
    content: `Using Chat to Refine Rewrites

## How chat works
After an initial rewrite, you can have a conversation with the AI to refine specific parts. Each message creates a new revision of your song.

## Tips for effective refinement
- Be specific about which verse or section you want changed
- Reference line numbers or lyrics directly
- Explain *why* you want a change, not just what to change
- Ask for multiple options if you're unsure

## Example prompts
- "Make the second verse less wordy"
- "The chorus feels too high — can you suggest a lower melody line?"
- "Replace the bridge with something more upbeat"`,
  },
  {
    slug: 'pdf-export',
    title: 'Exporting PDF Performance Sheets',
    excerpt: 'Generate clean, printable chord sheets for live performance.',
    content: `Exporting PDF Performance Sheets

## Generating a PDF
From your song library, click the "Download PDF" button on any saved song. The PDF is formatted as a clean chord sheet with monospace text for easy reading on stage.

## Customization
- Adjust font size using the slider on the performance view
- The PDF respects your font size setting
- Two-column layout is available for longer songs

## Tips for performance
- Print at actual size for best readability
- Use a tablet stand for digital performance sheets
- The "Stay Awake" button keeps your screen on during performance`,
  },
];
