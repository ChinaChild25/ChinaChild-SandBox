import type { Area } from "react-easy-crop"

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener("load", () => resolve(img))
    img.addEventListener("error", () => reject(new Error("load image")))
    img.src = src
  })
}

/** Квадратный JPEG фиксированного размера для аватара (загрузка в Storage). */
export async function getCroppedAvatarBlob(
  imageSrc: string,
  pixelCrop: Area,
  outputSize = 512,
  quality = 0.9
): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Canvas 2D недоступен")
  }
  canvas.width = outputSize
  canvas.height = outputSize
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputSize,
    outputSize
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("toBlob"))
      },
      "image/jpeg",
      quality
    )
  })
}
