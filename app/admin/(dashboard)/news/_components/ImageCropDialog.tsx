"use client";

import { useEffect, useRef, useState } from "react";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragMode = "move" | "nw" | "ne" | "sw" | "se";

type DragState = {
  mode: DragMode;
  crop: CropRect;
  imageAspect: number;
  aspect: number | null;
  bounds: DOMRect;
  startX: number;
  startY: number;
};

type Props = {
  file: File;
  title: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const MIN_CROP = 0.08;
const RATIOS = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:4", value: 3 / 4 },
  { label: "9:16", value: 9 / 16 },
  { label: "16:9", value: 16 / 9 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cropForAspect(aspect: number, imageAspect: number): CropRect {
  const normalizedAspect = aspect / imageAspect;
  if (normalizedAspect >= 1) {
    const height = 1 / normalizedAspect;
    return { x: 0, y: (1 - height) / 2, width: 1, height };
  }
  return { x: (1 - normalizedAspect) / 2, y: 0, width: normalizedAspect, height: 1 };
}

function resolveDrag(drag: DragState, clientX: number, clientY: number): CropRect {
  const { crop, bounds } = drag;
  if (drag.mode === "move") {
    return {
      ...crop,
      x: clamp(crop.x + (clientX - drag.startX) / bounds.width, 0, 1 - crop.width),
      y: clamp(crop.y + (clientY - drag.startY) / bounds.height, 0, 1 - crop.height),
    };
  }

  const west = drag.mode.includes("w");
  const north = drag.mode.includes("n");
  const pointerX = clamp((clientX - bounds.left) / bounds.width, 0, 1);
  const pointerY = clamp((clientY - bounds.top) / bounds.height, 0, 1);

  if (drag.aspect) {
    const anchorX = west ? crop.x + crop.width : crop.x;
    const anchorY = north ? crop.y + crop.height : crop.y;
    const directedX = west
      ? Math.min(pointerX, anchorX - MIN_CROP)
      : Math.max(pointerX, anchorX + MIN_CROP);
    const directedY = north
      ? Math.min(pointerY, anchorY - MIN_CROP)
      : Math.max(pointerY, anchorY + MIN_CROP);
    const desiredWidth = Math.abs(directedX - anchorX);
    const desiredHeight = Math.abs(directedY - anchorY);
    const normalizedAspect = drag.aspect / drag.imageAspect;

    let width: number;
    let height: number;
    if (desiredWidth / desiredHeight > normalizedAspect) {
      height = desiredHeight;
      width = height * normalizedAspect;
    } else {
      width = desiredWidth;
      height = width / normalizedAspect;
    }

    const maxWidth = west ? anchorX : 1 - anchorX;
    const maxHeight = north ? anchorY : 1 - anchorY;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    width *= scale;
    height *= scale;

    return {
      x: west ? anchorX - width : anchorX,
      y: north ? anchorY - height : anchorY,
      width,
      height,
    };
  }

  let left = crop.x;
  let right = crop.x + crop.width;
  let top = crop.y;
  let bottom = crop.y + crop.height;

  if (west) left = clamp(pointerX, 0, right - MIN_CROP);
  else right = clamp(pointerX, left + MIN_CROP, 1);
  if (north) top = clamp(pointerY, 0, bottom - MIN_CROP);
  else bottom = clamp(pointerY, top + MIN_CROP, 1);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function outputTypeFor(file: File) {
  if (file.type === "image/png" || file.type === "image/webp") return file.type;
  return "image/jpeg";
}

export default function ImageCropDialog({ file, title, onCancel, onConfirm }: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [aspect, setAspect] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled && typeof reader.result === "string") setImageUrl(reader.result);
    };
    reader.onerror = () => {
      if (!cancelled) setError("This image could not be loaded for cropping.");
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
      reader.abort();
    };
  }, [file]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  useEffect(() => {
    if (!drag) return;

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      setCrop(resolveDrag(drag, event.clientX, event.clientY));
    };
    const stopDragging = () => setDrag(null);

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    window.addEventListener("blur", stopDragging);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
      window.removeEventListener("blur", stopDragging);
    };
  }, [drag]);

  const imageAspect = imageSize.width && imageSize.height ? imageSize.width / imageSize.height : 1;
  const loaded = imageSize.width > 0 && imageSize.height > 0;

  useEffect(() => {
    if (!loaded) return;
    const updateStageSize = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };
    const timer = setTimeout(updateStageSize, 0);
    window.addEventListener("resize", updateStageSize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateStageSize);
    };
  }, [loaded]);

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    setCrop(aspect ? cropForAspect(aspect, image.naturalWidth / image.naturalHeight) : FULL_CROP);
  };

  const selectAspect = (nextAspect: number | null) => {
    setAspect(nextAspect);
    if (nextAspect && loaded) setCrop(cropForAspect(nextAspect, imageAspect));
  };

  const resetCrop = () => {
    setCrop(aspect && loaded ? cropForAspect(aspect, imageAspect) : FULL_CROP);
  };

  const beginDrag = (event: React.PointerEvent<HTMLElement>, mode: DragMode) => {
    const stage = stageRef.current;
    if (!stage || !loaded || busy) return;
    event.preventDefault();
    event.stopPropagation();
    setDrag({
      mode,
      crop,
      imageAspect,
      aspect,
      bounds: stage.getBoundingClientRect(),
      startX: event.clientX,
      startY: event.clientY,
    });
  };

  const handleApply = async () => {
    const image = imageRef.current;
    if (!image || !loaded || busy) return;

    const sourceX = Math.max(0, Math.round(crop.x * imageSize.width));
    const sourceY = Math.max(0, Math.round(crop.y * imageSize.height));
    const sourceWidth = Math.min(imageSize.width - sourceX, Math.max(1, Math.round(crop.width * imageSize.width)));
    const sourceHeight = Math.min(imageSize.height - sourceY, Math.max(1, Math.round(crop.height * imageSize.height)));
    const fullImage =
      sourceX === 0 &&
      sourceY === 0 &&
      sourceWidth === imageSize.width &&
      sourceHeight === imageSize.height;

    if (fullImage) {
      onConfirm(file);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to create the crop canvas.");

      if (outputTypeFor(file) === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, sourceWidth, sourceHeight);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight
      );

      const outputType = outputTypeFor(file);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Unable to crop this image."))),
          outputType,
          outputType === "image/png" ? undefined : 0.92
        );
      });

      const extension = outputType === "image/png" ? "png" : outputType === "image/webp" ? "webp" : "jpg";
      const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
      onConfirm(new File([blob], `${baseName}-crop.${extension}`, { type: outputType }));
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Unable to crop this image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="image-crop-backdrop">
      <div
        ref={dialogRef}
        className="image-crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-crop-title"
        aria-busy={busy}
        tabIndex={-1}
      >
        <div className="image-crop-header">
          <div>
            <p>IMAGE TOOL</p>
            <h2 id="image-crop-title">{title}</h2>
          </div>
          <button type="button" className="image-crop-close" onClick={onCancel} disabled={busy} aria-label="Close image cropper">
            ×
          </button>
        </div>

        <div className="image-crop-ratios" role="group" aria-label="Crop aspect ratio">
          {RATIOS.map((ratio) => (
            <button
              key={ratio.label}
              type="button"
              className={`image-crop-ratio${aspect === ratio.value ? " is-active" : ""}`}
              aria-pressed={aspect === ratio.value}
              onClick={() => selectAspect(ratio.value)}
              disabled={!loaded || busy}
            >
              {ratio.label}
            </button>
          ))}
          <button type="button" className="image-crop-reset" onClick={resetCrop} disabled={!loaded || busy}>
            Reset
          </button>
        </div>

        <div className="image-crop-stage-shell">
          {!imageUrl || !loaded ? (
            <div className="image-crop-loading">{imageUrl ? "Loading image..." : "Preparing image..."}</div>
          ) : null}
          <div ref={stageRef} className="image-crop-stage" style={loaded ? undefined : { display: "none" }}>
            {imageUrl ? (
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Image to crop"
                onLoad={handleImageLoad}
                onError={() => setError("This image could not be loaded for cropping.")}
                draggable={false}
              />
            ) : null}
            {loaded ? (
              <div
                className="image-crop-selection"
                style={{
                  left: `${crop.x * stageSize.width}px`,
                  top: `${crop.y * stageSize.height}px`,
                  width: `${crop.width * stageSize.width}px`,
                  height: `${crop.height * stageSize.height}px`,
                }}
                onPointerDown={(event) => beginDrag(event, "move")}
              >
                {(["nw", "ne", "sw", "se"] as const).map((handle) => (
                  <span
                    key={handle}
                    className={`image-crop-handle image-crop-handle-${handle}`}
                    onPointerDown={(event) => beginDrag(event, handle)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <p className="image-crop-help">
          Drag inside the frame to move it, or drag a corner to resize. Choose a ratio or keep Free for the
          image&apos;s original portrait or landscape shape.
        </p>
        <div className="image-crop-meta">
          <span>
            {loaded ? `${imageSize.width} × ${imageSize.height} px` : "Reading image dimensions..."}
          </span>
          <span>
            Crop {Math.max(1, Math.round(crop.width * imageSize.width))} ×{" "}
            {Math.max(1, Math.round(crop.height * imageSize.height))} px
          </span>
        </div>

        {error ? <div className="admin-error image-crop-error">{error}</div> : null}

        <div className="image-crop-actions">
          <button type="button" className="button-secondary" onClick={() => onConfirm(file)} disabled={busy}>
            Upload full image
          </button>
          <div>
            <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="button-primary" onClick={handleApply} disabled={!loaded || busy}>
              {busy ? "Cropping..." : "Apply crop & upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
