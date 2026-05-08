# Practice Test (Local)

How to use:

- Open `index.html` in a browser (serve via static server for best results).
- The app reads a `manifest.json` file at startup to discover available topics (folders) and text files inside them. Select a topic, then a file. The file label shown is the first two words of the filename (e.g. `nursing_history_student_friday_4.txt` → `Nursing History`).
- When you select a file and click `Start Practice` the app shows a short 2s "Please wait" overlay while loading, then starts the practice.
- File format: questions numbered, options A–E on separate lines. Mark the correct option with an asterisk `*` or the word `(correct)`.

Example snippet:

1. Question text
A. Option one
B. Option two *
C. Option three
D. Option four
E. Option five

Behavior:
- 20 questions per page. Next moves to the next page. After the final page (up to 40 questions) Submit will show your score.
- Selections are retained while navigating pages.
- Score >= 70% is Pass (green); otherwise Fail (red).

Managing topics/files:
- To have the UI automatically list folders and files, run the manifest generator once from the project root (requires Node.js):

```powershell
node build-manifest.js
```

- This writes `manifest.json`. Re-run `build-manifest.js` whenever you add new folders or files.

If `manifest.json` is missing the page will fall back to the original file upload input (if present).
