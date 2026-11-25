import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  PanResponder,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Minus, Plus, RotateCcw, X, Check } from 'lucide-react-native';
import { colors } from '../../config/colors';
import { FONT, snPro } from '../../config/fonts';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const OUTPUT = 512; // saved avatar size (px)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * WhatsApp / Instagram style avatar crop: drag the photo inside a round frame, pinch (or use
 * − / +) to zoom, then "Use photo" saves a square 512×512 JPEG of what is inside the circle.
 * Works the same on the Android app and on web.
 *
 * Props: visible, uri, width, height (of the picked image, if known), onCancel(),
 * onDone({ uri, base64, mimeType, fileName })
 */
export default function AvatarCropModal({ visible, uri, width, height, onCancel, onDone }) {
  const { width: screenW } = useWindowDimensions();
  const frame = Math.min(screenW - 48, 320);

  const [size, setSize] = useState(null); // { w, h } of the source image
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  // Image size: from the picker, or ask the image itself.
  useEffect(() => {
    if (!visible || !uri) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setBusy(false);
    if (width && height) {
      setSize({ w: width, h: height });
      return;
    }
    setSize(null);
    Image.getSize(
      uri,
      (w, h) => setSize({ w, h }),
      () => setSize({ w: frame, h: frame }),
    );
  }, [visible, uri, width, height, frame]);

  // Base scale so the shorter side just fills the circle; zoom goes on top of that.
  const base = size ? frame / Math.min(size.w, size.h) : 1;
  const dispW = size ? size.w * base * zoom : frame;
  const dispH = size ? size.h * base * zoom : frame;

  /** Keep the photo covering the whole circle — no empty edges. */
  const clampOffset = (o, w = dispW, h = dispH) => ({
    x: clamp(o.x, -(w - frame) / 2, (w - frame) / 2),
    y: clamp(o.y, -(h - frame) / 2, (h - frame) / 2),
  });

  const setZoomSafe = (z) => {
    const nz = clamp(z, MIN_ZOOM, MAX_ZOOM);
    setZoom(nz);
    if (size) {
      setOffset((o) => clampOffset(o, size.w * base * nz, size.h * base * nz));
    }
  };

  // Gesture state lives in a ref so PanResponder (created once) always sees fresh values.
  const live = useRef({});
  live.current = { zoom, offset, dispW, dispH, size, base, frame };
  const gesture = useRef({ startOffset: { x: 0, y: 0 }, startZoom: 1, startDist: 0 });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gesture.current = { startOffset: live.current.offset, startZoom: live.current.zoom, startDist: 0 };
        },
        onPanResponderMove: (evt, g) => {
          const touches = evt.nativeEvent.touches || [];
          const L = live.current;
          if (touches.length >= 2) {
            // Pinch to zoom
            const [a, b] = touches;
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (!gesture.current.startDist) {
              gesture.current.startDist = dist;
              gesture.current.startZoom = L.zoom;
              return;
            }
            const nz = clamp((gesture.current.startZoom * dist) / gesture.current.startDist, MIN_ZOOM, MAX_ZOOM);
            setZoom(nz);
            if (L.size) {
              const w = L.size.w * L.base * nz;
              const h = L.size.h * L.base * nz;
              setOffset((o) => ({
                x: clamp(o.x, -(w - L.frame) / 2, (w - L.frame) / 2),
                y: clamp(o.y, -(h - L.frame) / 2, (h - L.frame) / 2),
              }));
            }
            return;
          }
          // One finger / mouse: drag
          const next = {
            x: gesture.current.startOffset.x + g.dx,
            y: gesture.current.startOffset.y + g.dy,
          };
          setOffset({
            x: clamp(next.x, -(L.dispW - L.frame) / 2, (L.dispW - L.frame) / 2),
            y: clamp(next.y, -(L.dispH - L.frame) / 2, (L.dispH - L.frame) / 2),
          });
        },
        onPanResponderRelease: () => {
          gesture.current.startDist = 0;
        },
      }),
    [],
  );

  const reset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const confirm = async () => {
    if (!size || busy) return;
    setBusy(true);
    try {
      const scale = base * zoom; // displayed px per source px
      const side = Math.min(size.w, size.h, frame / scale);
      const originX = clamp((dispW / 2 - frame / 2 - offset.x) / scale, 0, size.w - side);
      const originY = clamp((dispH / 2 - frame / 2 - offset.y) / scale, 0, size.h - side);
      const result = await manipulateAsync(
        uri,
        [
          { crop: { originX: Math.round(originX), originY: Math.round(originY), width: Math.round(side), height: Math.round(side) } },
          { resize: { width: OUTPUT, height: OUTPUT } },
        ],
        { compress: 0.82, format: SaveFormat.JPEG, base64: true },
      );
      onDone?.({
        uri: result.uri,
        base64: result.base64 || '',
        mimeType: 'image/jpeg',
        fileName: `avatar-${Date.now()}.jpg`,
      });
    } catch {
      setBusy(false);
      onCancel?.('Could not crop this photo. Please try another one.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onCancel?.()}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <Pressable onPress={() => onCancel?.()} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Cancel">
            <X size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.title, { fontFamily: FONT.nova }]}>Move and scale</Text>
          <Pressable onPress={reset} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Reset">
            <RotateCcw size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.stage}>
          <View style={{ width: frame, height: frame }}>
          <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
            {size ? (
              <Image
                source={{ uri }}
                style={{
                  position: 'absolute',
                  width: dispW,
                  height: dispH,
                  left: (frame - dispW) / 2 + offset.x,
                  top: (frame - dispH) / 2 + offset.y,
                }}
                resizeMode="cover"
              />
            ) : (
              <ActivityIndicator color="#FFFFFF" style={StyleSheet.absoluteFill} />
            )}
          </View>
          {/* Dim everything outside the circle (centred on the frame) */}
          <Svg
            width={frame + 400}
            height={frame + 400}
            style={[styles.mask, { left: -200, top: -200 }]}
            pointerEvents="none"
          >
            <Defs>
              <Mask id="hole">
                <Rect x="0" y="0" width={frame + 400} height={frame + 400} fill="white" />
                <Circle cx={(frame + 400) / 2} cy={(frame + 400) / 2} r={frame / 2} fill="black" />
              </Mask>
            </Defs>
            <Rect x="0" y="0" width={frame + 400} height={frame + 400} fill="rgba(0,0,0,0.6)" mask="url(#hole)" />
            <Circle
              cx={(frame + 400) / 2}
              cy={(frame + 400) / 2}
              r={frame / 2}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={2}
              fill="none"
            />
          </Svg>
          </View>
        </View>

        <Text style={[styles.hint, { fontFamily: snPro('600') }]}>
          {Platform.OS === 'web' ? 'Drag to move · use − / + to zoom' : 'Drag to move · pinch to zoom'}
        </Text>

        <View style={styles.zoomRow}>
          <Pressable onPress={() => setZoomSafe(zoom - 0.25)} style={styles.zoomBtn} accessibilityLabel="Zoom out">
            <Minus size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.zoomTrack}>
            <View style={[styles.zoomFill, { width: `${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%` }]} />
          </View>
          <Pressable onPress={() => setZoomSafe(zoom + 0.25)} style={styles.zoomBtn} accessibilityLabel="Zoom in">
            <Plus size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => onCancel?.()} style={[styles.actionBtn, styles.cancelBtn]}>
            <Text style={[styles.actionText, { color: '#FFFFFF', fontFamily: snPro('800') }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={confirm}
            disabled={!size || busy}
            style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: !size || busy ? 0.6 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Check size={18} color="#FFFFFF" strokeWidth={2.6} />
                <Text style={[styles.actionText, { color: '#FFFFFF', fontFamily: snPro('800') }]}>Use photo</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000', paddingTop: 48, paddingBottom: 28, paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontSize: 18 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mask: { position: 'absolute' },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, textAlign: 'center', marginBottom: 14 },
  zoomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  zoomFill: { height: 4, backgroundColor: '#FFFFFF' },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelBtn: { backgroundColor: 'rgba(255,255,255,0.12)' },
  actionText: { fontSize: 15.5 },
});
