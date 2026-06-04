#!/usr/bin/env bash
set -euo pipefail

# ----------------------------------------------------------------------------
# Build a crop-fixed v4l2codecs plugin for the Raspberry Pi 5 HEVC decoder.
#
# Root cause (verified against the exact 1.26.2 source). copy_frames is set in
# exactly two places in new_sequence, and for 1080p BOTH evaluate to TRUE:
#   if (!self->has_videometa) {                // stale default here; the alloc-meta
#     ... if (buffer.stride/offset != display-size ref) copy_frames = TRUE;  // 1088 vs 1080
#   } else {
#     copy_frames = self->need_crop;           // need_crop is TRUE for 1080p
#   }
# need_crop fires when the SPS conformance crop
# height differs from the coded height:
#   need_crop |= crop_rect_height (1080) != sps->height (1088);   // -> TRUE
# 1080 is padded to coded 1088 (crop down to 1080), so need_crop = TRUE. Either
# branch -> copy_frames = TRUE -> copy_output_buffer detiles the SAND dmabuf into a
# linear SystemMemory NV12 (1920*1088*1.5 = 3133440) -> waylandsink "cannot have a
# wl_buffer", and the per-frame copy drags the Pi down. 16-aligned tiers
# (720/1440/2160) are coded==display, no conformance crop, both branches FALSE, so
# they stay zero-copy.
#
# Fix (two parts, both local to the v4l2codecs plugin):
#  1) emit the full coded frame (display := coded, e.g. 1088) so caps, VideoMeta
#     and the SAND dmabuf are all consistent for waylandsink.
#  2) force copy_frames = FALSE in both branches. We deliberately emit the
#     uncropped 1088 and crop the 8 padding rows in the compositor, so the decoder
#     must never copy. The capture dmabuf is then pushed straight through -> the
#     720p zero-copy path. 720p/1440p/2160p are unaffected (already FALSE).
#
# CRITICAL: build from the DISTRO source (apt-get source), NOT the upstream
# tarball. The tarball ships a bundled kernel uAPI (sys/v4l2codecs/linux/
# videodev2.h) that does not match the Pi's rpi-hevc-dec driver, so a tarball
# build crashes the decoder with VIDIOC_QBUF "Invalid argument". The distro
# source is built against the Pi's kernel and is the only one that drives the HW.
#
# Run on the Pi:  bash scripts/gstreamer/patch-pi-v4l2codecs.sh
# ----------------------------------------------------------------------------

VER="$(gst-launch-1.0 --version 2>/dev/null | awk '/version/{print $NF; exit}')"
[ -n "$VER" ] || { echo "gst-launch-1.0 not found; install gstreamer first" >&2; exit 1; }
echo "System GStreamer: $VER"

WORK="${TMPDIR:-/tmp}/livi-v4l2codecs"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"

echo "==> Installing build dependencies"
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  build-essential meson ninja-build pkg-config dpkg-dev \
  libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
  libv4l-dev libudev-dev libgudev-1.0-dev

# --- Fetch the DISTRO source (deb-src). Enable deb-src temporarily if needed,
# and clean it up again on exit so we leave the apt config as we found it.
CREATED_SRC=()
cleanup() { for f in "${CREATED_SRC[@]:-}"; do sudo rm -f "$f"; done; }
trap cleanup EXIT

if ! apt-get source --download-only gstreamer1.0-plugins-bad >/dev/null 2>&1; then
  echo "==> deb-src not enabled, adding it temporarily"
  # deb822 format (Trixie default): mirror each deb stanza as a deb-src one
  for f in /etc/apt/sources.list.d/*.sources; do
    [ -f "$f" ] || continue
    grep -q '^Types:' "$f" || continue
    grep -q 'deb-src' "$f" && continue
    tmp="/etc/apt/sources.list.d/zz-livi-debsrc-$(basename "$f")"
    sudo sed 's/^Types:.*/Types: deb-src/' "$f" | sudo tee "$tmp" >/dev/null
    CREATED_SRC+=("$tmp")
  done
  # classic format: mirror each "deb " line as a "deb-src " line
  for f in /etc/apt/sources.list /etc/apt/sources.list.d/*.list; do
    [ -f "$f" ] || continue
    grep -qE '^[[:space:]]*deb ' "$f" || continue
    tmp="/etc/apt/sources.list.d/zz-livi-debsrc-$(basename "$f").list"
    grep -E '^[[:space:]]*deb ' "$f" | sed 's/^[[:space:]]*deb /deb-src /' | sudo tee "$tmp" >/dev/null
    CREATED_SRC+=("$tmp")
  done
  sudo apt-get update
fi

echo "==> Fetching gst-plugins-bad distro source"
if ! apt-get source --download-only gstreamer1.0-plugins-bad || ! ls gst-plugins-bad*.dsc >/dev/null 2>&1; then
  echo "ERROR: could not fetch the distro source for gstreamer1.0-plugins-bad." >&2
  echo "Enable deb-src in your apt config, run 'sudo apt-get update', then re-run." >&2
  echo "Do NOT use the upstream tarball: its kernel uAPI mismatches the Pi and the decoder crashes (VIDIOC_QBUF EINVAL)." >&2
  exit 1
fi
dpkg-source -x gst-plugins-bad*.dsc gpb-src   # applies debian/patches
cd gpb-src

echo "==> Applying zero-copy-crop patch (emit the uncropped CODED size for bottom crops)"
# In new_sequence the decoder sets the DISPLAY size from the SPS conformance
# window (crop_width/height = sps->crop_rect_*, e.g. 1080). Point it at the CODED
# size (sps->width/height, e.g. 1088) instead, so a bottom-only crop emits the
# full SAND dmabuf zero-copy. need_crop (x/y offset) is untouched, so real
# offset crops still take the copy path. 720p/1440p/2160p are coded==display and
# unaffected; only 1080p (coded 1088) changes, and shows 8 padding rows that the
# compositor crops back to 1080.
f="sys/v4l2codecs/gstv4l2codech265dec.c"
[ -f "$f" ] && grep -q 'crop_width = sps->crop_rect_width;' "$f" \
  || { echo "ERROR: 'crop_width = sps->crop_rect_width;' not found in $f - source layout differs" >&2; exit 1; }
sed -i \
  -e 's/crop_width = sps->crop_rect_width;/crop_width = sps->width;/' \
  -e 's/crop_height = sps->crop_rect_height;/crop_height = sps->height;/' \
  "$f"
grep -q 'crop_height = sps->height;' "$f" || { echo "ERROR: patch did not take in $f" >&2; exit 1; }
echo "    patched $f (display := coded -> consistent 1088 caps/VideoMeta/dmabuf)"

echo "==> Forcing copy_frames = FALSE (never copy; emit the uncropped coded frame)"
# copy_frames is set in exactly two places and for 1080p both evaluate to TRUE:
#   line ~1010: stride-check mismatch (coded-size buffer vs display-size ref)
#   line ~1015: copy_frames = need_crop, and need_crop is TRUE because the SPS
#               conformance crop height (1080) != coded height (1088).
# We emit the full coded 1088 SAND dmabuf and crop the 8 padding rows in the
# compositor, so the decoder must never copy. Force both assignments to FALSE; the
# capture dmabuf is then pushed straight through (the 720p zero-copy path).
grep -q 'self->copy_frames = self->need_crop;' "$f" \
  || { echo "ERROR: copy_frames decision not found in $f - source layout differs" >&2; exit 1; }
sed -i \
  -e 's/self->copy_frames = TRUE;/self->copy_frames = FALSE;/' \
  -e 's/self->copy_frames = self->need_crop;/self->copy_frames = FALSE;/' \
  "$f"
! grep -q 'self->copy_frames = self->need_crop;' "$f" \
  || { echo "ERROR: copy_frames patch did not take in $f" >&2; exit 1; }
echo "    patched $f (copy_frames forced FALSE -> capture dmabuf passes through)"

echo "==> Building only the v4l2codecs plugin"
meson setup build -Dauto_features=disabled -Dv4l2codecs=enabled \
  -Dintrospection=disabled -Ddoc=disabled -Dtests=disabled -Dexamples=disabled
ninja -C build

SO="$(find build -name 'libgstv4l2codecs.so' | head -1)"
[ -n "$SO" ] || { echo "build did not produce libgstv4l2codecs.so" >&2; exit 1; }
echo "    built: $SO"

PLUGINS_DIR="$(pkg-config --variable=pluginsdir gstreamer-1.0)"
TARGET="$PLUGINS_DIR/libgstv4l2codecs.so"
echo "==> Installing over $TARGET (original backed up to .orig)"
[ -f "$TARGET" ] && sudo cp -n "$TARGET" "$TARGET.orig" || true
sudo cp "$SO" "$TARGET"

echo "==> Clearing the GStreamer registry cache so the new plugin is rescanned"
rm -f "$HOME"/.cache/gstreamer-1.0/registry.*.bin 2>/dev/null || true

echo
echo "Done. Now VALIDATE in this order:"
echo "  1) gst-inspect-1.0 v4l2slh265dec >/dev/null && echo OK"
echo "  2) Run LIVI at 720p  -> must still show 'mem[0] alloc=dmabuf' (zero-copy intact)"
echo "  3) Run LIVI at 1080p -> should now show 'alloc=dmabuf' too (was SystemMemory)"
echo
echo "If 720p breaks, the build is bad: restore with"
echo "  sudo cp \"$TARGET.orig\" \"$TARGET\" && rm -f ~/.cache/gstreamer-1.0/registry.*.bin"
