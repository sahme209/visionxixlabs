# How to Add App Icons to Your Website

## Quick Steps

1. **Save your images** with these exact names:
   - `visanova-icon.png` (the heraldic shield image)
   - `recallease-icon.png` (the red checkmark/plus icon)

2. **Place them in the `public/` folder:**
   ```
   visionxixlabs/
   └── public/
       ├── visanova-icon.png      ← Add this file
       └── recallease-icon.png     ← Add this file
   ```

3. **File Requirements:**
   - Format: PNG or JPG
   - Size: 512x512px or larger (square images work best)
   - Name: Must match exactly (case-sensitive)

## Current Status

The code is ready to display your images. Once you add the files to the `public/` folder, they will automatically appear on the website.

## Verification

After adding the images:
1. Restart your dev server: `npm run dev`
2. Check the browser console for any errors
3. The images should appear in the apps showcase section

## Troubleshooting

If images still don't load:
- Check that filenames match exactly: `visanova-icon.png` and `recallease-icon.png`
- Make sure files are in the `public/` folder (not `public/images/`)
- Check browser console for 404 errors
- Verify file permissions (images should be readable)
