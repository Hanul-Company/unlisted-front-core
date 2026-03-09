// client/utils/image.ts

export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

  // 1. 초기 캔버스 설정 (크롭 영역 원본 크기)
  let targetWidth = pixelCrop.width;
  let targetHeight = pixelCrop.height;

  // 초기 렌더링
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  // 2. Blob 크기가 3MB 이하가 되도록 압축/리사이즈 (최대 3번 시도)
  return new Promise(async (resolve, reject) => {
    let quality = 0.95; // 원본에 가까운 고배율
    let attempts = 0;

    const generateBlob = (q: number, w: number, h: number): Promise<Blob> => {
      return new Promise((res, rej) => {
        if (w !== canvas.width || h !== canvas.height) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = w;
          tempCanvas.height = h;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(canvas, 0, 0, w, h);
            tempCanvas.toBlob((b) => (b ? res(b) : rej(new Error('Canvas is empty'))), 'image/jpeg', q);
          } else {
            rej(new Error('No 2d context for resizing'));
          }
        } else {
          canvas.toBlob((b) => (b ? res(b) : rej(new Error('Canvas is empty'))), 'image/jpeg', q);
        }
      });
    };

    try {
      let blob = await generateBlob(quality, targetWidth, targetHeight);

      // 용량이 3MB 넘는 경우 품질을 낮추고, 그래도 안되면 해상도를 줄임
      while (blob.size > MAX_FILE_SIZE && attempts < 3) {
        attempts++;
        quality -= 0.15; // 품질 낮춤
        targetWidth = Math.floor(targetWidth * 0.8); // 80% 리사이즈
        targetHeight = Math.floor(targetHeight * 0.8);
        blob = await generateBlob(quality, targetWidth, targetHeight);
      }

      resolve(blob);
    } catch (e) {
      reject(e);
    }
  });
}

export async function resizeImageBlob(blob: Blob, targetSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No 2d context'));
      
      const scale = Math.max(targetSize / img.width, targetSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (targetSize - w) / 2;
      const y = (targetSize - h) / 2;

      ctx.drawImage(img, x, y, w, h);

      canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Canvas is empty')), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Image load error'));
    img.src = url;
  });
}