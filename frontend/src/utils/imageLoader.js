export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

export const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

export const cropLeftSlice = (sourceImage, sliceRatio = 0.04) => {
  const sliceWidth = Math.max(1, Math.floor(sourceImage.width * sliceRatio));
  const canvas = document.createElement('canvas');
  canvas.width = sliceWidth;
  canvas.height = sourceImage.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(
    sourceImage,
    0,
    0,
    sliceWidth,
    sourceImage.height,
    0,
    0,
    sliceWidth,
    sourceImage.height
  );
  const sliceImg = new Image();
  sliceImg.crossOrigin = 'anonymous';
  sliceImg.src = canvas.toDataURL('image/png');
  return { sliceImg, sliceWidth, offscreenCanvas: canvas };
};

export const waitForImage = (img) =>
  new Promise((resolve, reject) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve(img);
      return;
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
  });
