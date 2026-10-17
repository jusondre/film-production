/* Images: pick files and shrink them so they fit in browser storage. */
const Images = (() => {
  function fromFile(file, max, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
      img.src = url;
    });
  }

  /* Opens the file picker. Resolves with an array of image data URLs. */
  function pick({ multiple = false, max = 640, quality = 0.65 } = {}) {
    return new Promise(resolve => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*"; input.multiple = multiple;
      input.onchange = async () => {
        const results = await Promise.allSettled([...input.files].map(f => fromFile(f, max, quality)));
        resolve(results.filter(r => r.status === "fulfilled").map(r => r.value));
      };
      input.click();
    });
  }
  return { pick };
})();
