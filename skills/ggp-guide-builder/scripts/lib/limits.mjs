// Hard limits for .ggp files. The CLI and the Game Guide widget enforce the same numbers.
const MB = 1024 * 1024;

export const LIMITS = {
  zipBytes: 60 * MB,
  dataBytes: 5 * MB,
  manifestBytes: 256 * 1024,
  imageBytes: 8 * MB,
  imagePx: 4096,
  pinsPerMap: 2000,
  uncompressedBytes: 300 * MB,
  entries: 5000,
  navDepth: 6,
  stringLen: 20000,
};

export const ID_RE = /^[a-z0-9._-]{1,64}$/;
export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
export const IMAGE_TYPES = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
};
