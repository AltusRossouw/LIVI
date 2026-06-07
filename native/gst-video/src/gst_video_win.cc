// Windows video plane.
//
// A video plane is a borderless, click-through top-level window pinned directly below the
// (transparent) Electron window it belongs to. DWM composites it through the transparent
// regions of the UI, which gives us the same "video sits under the UI" model that the
// NSView subview provides on macOS and the wlroots compositor provides on Linux.

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <commctrl.h>

#include <cmath>

#include <gst/gst.h>
#include <gst/video/videooverlay.h>

struct LiviVideoView {
  HWND parent;  // the Electron top-level window this plane belongs to
  HWND video;   // our borderless plane window (the d3d11videosink renders into this)
  void* sink;   // GstElement* (GstVideoOverlay), to re-apply the render rect on resize
  // AA content region inside the decoded tier, in tier pixels; 0 => fill the window.
  double cropL, cropT, visW, visH, tierW, tierH;
  int lastW, lastH;  // plane size the render rect was last computed for (skip redundant work)
  bool hidden;  // logical visibility from livi_set_view_hidden
};

static const wchar_t* kLiviVideoClass = L"LiviVideoPlane";

static LRESULT CALLBACK livi_plane_proc(HWND h, UINT msg, WPARAM w, LPARAM l) {
  // The plane is WS_EX_TRANSPARENT (fully click-through) and only ever hosts the sink's
  // swapchain, so there is nothing to handle here.
  return DefWindowProcW(h, msg, w, l);
}

static void livi_ensure_class() {
  static bool registered = false;
  if (registered) return;
  registered = true;
  WNDCLASSEXW wc;
  ZeroMemory(&wc, sizeof(wc));
  wc.cbSize = sizeof(wc);
  wc.lpfnWndProc = livi_plane_proc;
  wc.hInstance = GetModuleHandleW(NULL);
  wc.hCursor = NULL;
  wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
  wc.lpszClassName = kLiviVideoClass;
  RegisterClassExW(&wc);
}

// Map the AA content region onto the plane via the sink's render rectangle: contain the content
// AR in the window, then render the whole tier scaled and shifted so the content (at cropL/cropT)
// lands on that centered rect; the sink clips the overscan to the window. Mirrors the macOS
// clip/gl layout. Re-run on size changes so the crop tracks window/fullscreen resizes.
static void livi_apply_render_rect(LiviVideoView* v) {
  if (!v || !v->sink || !GST_IS_VIDEO_OVERLAY(v->sink) || !IsWindow(v->video)) return;
  RECT rc;
  if (!GetClientRect(v->video, &rc)) return;
  const double W = rc.right - rc.left;
  const double H = rc.bottom - rc.top;
  if (W <= 0.0 || H <= 0.0) return;
  v->lastW = static_cast<int>(W);
  v->lastH = static_cast<int>(H);

  GstVideoOverlay* ov = GST_VIDEO_OVERLAY(v->sink);
  if (v->visW <= 0.0 || v->visH <= 0.0 || v->tierW <= 0.0 || v->tierH <= 0.0) {
    // No content region: render the whole tier filling the window.
    gst_video_overlay_set_render_rectangle(ov, 0, 0, static_cast<gint>(W), static_cast<gint>(H));
  } else {
    const double scale = std::fmin(W / v->visW, H / v->visH);
    const double cdw = v->visW * scale;
    const double cdh = v->visH * scale;
    const double cx = (W - cdw) / 2.0;
    const double cy = (H - cdh) / 2.0;
    gst_video_overlay_set_render_rectangle(
        ov, static_cast<gint>(std::lround(cx - v->cropL * scale)),
        static_cast<gint>(std::lround(cy - v->cropT * scale)),
        static_cast<gint>(std::lround(v->tierW * scale)),
        static_cast<gint>(std::lround(v->tierH * scale)));
  }
  gst_video_overlay_expose(ov);
}

// Match the plane window to the parent's client area (in screen coordinates) and pin it
// directly behind the parent in the z-order.
static void livi_sync(LiviVideoView* v) {
  if (!v || !IsWindow(v->parent) || !IsWindow(v->video)) return;
  RECT cr;
  if (!GetClientRect(v->parent, &cr)) return;
  POINT tl = {cr.left, cr.top};
  ClientToScreen(v->parent, &tl);
  const int x = tl.x;
  const int y = tl.y;
  const int w = cr.right - cr.left;
  const int h = cr.bottom - cr.top;
  UINT flags = SWP_NOACTIVATE | SWP_NOOWNERZORDER;
  flags |= v->hidden ? SWP_HIDEWINDOW : SWP_SHOWWINDOW;
  // hWndInsertAfter = parent -> the plane lands immediately below the parent.
  SetWindowPos(v->video, v->parent, x, y, w, h, flags);
  // The render rect is sized to the plane; recompute it when the plane actually changed size.
  if (w != v->lastW || h != v->lastH) livi_apply_render_rect(v);
}

// Subclass on the PARENT (Electron) window: keep the plane glued under it on every move,
// resize, z-order and show change. Keyed by the view pointer so several planes can share
// one parent (main projection + cluster overlay on the same window).
static LRESULT CALLBACK livi_parent_proc(HWND h, UINT msg, WPARAM w, LPARAM l, UINT_PTR id,
                                         DWORD_PTR ref) {
  LiviVideoView* v = reinterpret_cast<LiviVideoView*>(ref);
  switch (msg) {
    case WM_WINDOWPOSCHANGED:
    case WM_MOVE:
    case WM_SIZE:
    case WM_SHOWWINDOW:
    case WM_ACTIVATE:
      livi_sync(v);
      break;
    case WM_NCDESTROY:
      RemoveWindowSubclass(h, livi_parent_proc, id);
      break;
    default:
      break;
  }
  return DefSubclassProc(h, msg, w, l);
}

extern "C" guintptr livi_attach_view(guintptr parent, void** outView) {
  *outView = nullptr;
  HWND parentHwnd = reinterpret_cast<HWND>(static_cast<uintptr_t>(parent));
  if (!parentHwnd || !IsWindow(parentHwnd)) return parent;

  livi_ensure_class();

  RECT cr = {0, 0, 0, 0};
  GetClientRect(parentHwnd, &cr);
  POINT tl = {cr.left, cr.top};
  ClientToScreen(parentHwnd, &tl);

  HWND video = CreateWindowExW(WS_EX_NOACTIVATE | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW,
                               kLiviVideoClass, L"", WS_POPUP, tl.x, tl.y,
                               cr.right - cr.left, cr.bottom - cr.top, NULL, NULL,
                               GetModuleHandleW(NULL), NULL);
  if (!video) return parent;

  LiviVideoView* v = new LiviVideoView();
  v->parent = parentHwnd;
  v->video = video;
  v->sink = nullptr;
  v->cropL = v->cropT = v->visW = v->visH = v->tierW = v->tierH = 0;
  v->lastW = v->lastH = 0;
  v->hidden = false;

  SetWindowSubclass(parentHwnd, livi_parent_proc, reinterpret_cast<UINT_PTR>(v),
                    reinterpret_cast<DWORD_PTR>(v));
  livi_sync(v);

  *outView = v;
  return reinterpret_cast<guintptr>(video);  // the sink renders into the plane window
}

extern "C" void livi_set_view_hidden(void* view, bool hidden) {
  LiviVideoView* v = reinterpret_cast<LiviVideoView*>(view);
  if (!v || !IsWindow(v->video)) return;
  v->hidden = hidden;
  ShowWindow(v->video, hidden ? SW_HIDE : SW_SHOWNOACTIVATE);
  if (!hidden) livi_sync(v);  // re-pin under the parent when re-shown
}

// Set the AA content region (crop offsets + visible size within the decoded tier) by
// positioning the sink's render rectangle. cropL=0/visW=0 disables cropping (fill window).
extern "C" void livi_set_content_region(void* view, void* sink, double cropL, double cropT,
                                        double visW, double visH, double tierW, double tierH) {
  LiviVideoView* v = reinterpret_cast<LiviVideoView*>(view);
  if (!v) return;
  v->sink = sink;
  v->cropL = cropL;
  v->cropT = cropT;
  v->visW = visW;
  v->visH = visH;
  v->tierW = tierW;
  v->tierH = tierH;
  v->lastW = v->lastH = 0;  // force a recompute even if the plane size is unchanged
  livi_apply_render_rect(v);
}

extern "C" void livi_remove_view(void* view) {
  LiviVideoView* v = reinterpret_cast<LiviVideoView*>(view);
  if (!v) return;
  if (IsWindow(v->parent)) {
    RemoveWindowSubclass(v->parent, livi_parent_proc, reinterpret_cast<UINT_PTR>(v));
  }
  if (IsWindow(v->video)) DestroyWindow(v->video);
  delete v;
}

extern "C" void livi_set_backdrop(guintptr parent, double r, double g, double b) {
  // The Electron window is transparent and the plane sits behind it; there is no separate
  // backdrop layer to tint on Windows. No-op (and not called on win32 anyway).
  (void)parent;
  (void)r;
  (void)g;
  (void)b;
}
