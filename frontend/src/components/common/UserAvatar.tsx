/** Round profile picture, or the first letter of the name when there is none. */
export function UserAvatar({ name, src, className = '' }: { name?: string | null; src?: string | null; className?: string }) {
  if (src) return <img src={src} alt="" className={`rounded-full object-cover flex-shrink-0 ${className}`} />;
  return (
    <div className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 ${className}`}>
      {(name ?? 'U').charAt(0).toUpperCase()}
    </div>
  );
}

/** Crops an image file to a square and shrinks it to a small JPEG data URL for saving. */
export function imageFileToAvatar(file: File, size = 192): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Could not read the image')); return; }
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image')); };
    img.src = url;
  });
}
