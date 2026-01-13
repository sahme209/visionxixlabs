# App Icons - Setup Instructions

## Required Images

Please save the following images in the `public/` folder:

### 1. VisaNova Icon
- **Filename**: `visanova-icon.png`
- **Description**: Heraldic shield with American flag design (blue section with white stars, red and white stripes)
- **Recommended size**: 512x512px or 1024x1024px (square)
- **Format**: PNG with transparency (if available)

### 2. RecallEase Icon
- **Filename**: `recallease-icon.png`
- **Description**: Red background with white circle containing checkmark and plus sign
- **Recommended size**: 512x512px or 1024x1024px (square)
- **Format**: PNG with transparency (if available)

## How to Add Images

1. **Download or export your app icons** as PNG files
2. **Rename them** to match the filenames above:
   - VisaNova icon → `visanova-icon.png`
   - RecallEase icon → `recallease-icon.png`
3. **Place them** in the `public/` folder:
   ```
   visionxixlabs/
   └── public/
       ├── visanova-icon.png
       └── recallease-icon.png
   ```

## Image Requirements

- **Format**: PNG (preferred) or JPG
- **Size**: Minimum 256x256px, recommended 512x512px or larger
- **Aspect Ratio**: Square (1:1)
- **Background**: Transparent PNG preferred, or solid color background

## Verification

After adding the images, the website will automatically display them in the apps showcase section. The images will be:
- Responsive and properly sized
- Optimized by Next.js Image component
- Displayed with proper alt text for accessibility

## Notes

- The images are referenced in `app/page.tsx`
- Next.js will automatically optimize these images
- Make sure the filenames match exactly (case-sensitive)
