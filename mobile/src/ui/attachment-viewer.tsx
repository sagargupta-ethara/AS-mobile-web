import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/src/theme/colors";
import type { Attachment } from "@/src/api/client";

function isImageMime(mime: string): boolean {
  return mime?.startsWith("image/");
}

function isPdfMime(mime: string): boolean {
  return mime === "application/pdf" || (mime || "").includes("pdf");
}

function readableSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileIconFor(mime: string): {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
} {
  if (isImageMime(mime)) return { name: "image", color: colors.brand.navy };
  if (isPdfMime(mime)) return { name: "document-text", color: colors.brand.maroon };
  if ((mime || "").includes("word") || (mime || "").includes("msword"))
    return { name: "document-text", color: colors.brand.navy };
  if ((mime || "").includes("sheet") || (mime || "").includes("excel"))
    return { name: "grid", color: colors.brand.emerald };
  if ((mime || "").includes("video")) return { name: "videocam", color: colors.brand.navy };
  if ((mime || "").includes("audio")) return { name: "musical-notes", color: colors.brand.navy };
  return { name: "document-attach", color: colors.text.secondary };
}

interface Props {
  visible: boolean;
  attachment: Attachment | null;
  onClose: () => void;
}

// In-app viewer for images and PDFs (and simple docs via WebView).
export function AttachmentViewer({ visible, attachment, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [webLoading, setWebLoading] = useState(true);
  const [webError, setWebError] = useState(false);

  const reset = () => {
    setWebLoading(true);
    setWebError(false);
    onClose();
  };

  if (!attachment) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={reset}>
        <View style={styles.backdrop} />
      </Modal>
    );
  }

  const isImage = isImageMime(attachment.mime);
  const isPdf = isPdfMime(attachment.mime);
  const uri = attachment.data_uri;

  // For PDFs on Android, WebView won't render base64 PDFs natively.
  // Use Google Docs viewer only if remote; since we store base64 locally,
  // wrap PDFs in an HTML data URI with <embed>.
  const pdfHtml = isPdf
    ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5"><style>html,body{margin:0;padding:0;background:#111;height:100%;}embed,iframe,object{width:100%;height:100%;border:0;}</style></head><body><embed src="${uri}" type="application/pdf" /></body></html>`
    : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={reset}>
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            testID="attachment-close"
            onPress={reset}
            style={styles.closeBtn}
            hitSlop={12}
          >
            <Ionicons name="close" size={22} color={colors.text.inverse} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {attachment.name}
            </Text>
            {!!attachment.size && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {readableSize(attachment.size)} · {attachment.mime || "file"}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.body}>
          {isImage ? (
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={1}
              contentContainerStyle={styles.imgWrap}
              centerContent
            >
              <Image
                testID="attachment-image"
                source={{ uri }}
                style={styles.img}
                resizeMode="contain"
              />
            </ScrollView>
          ) : isPdf ? (
            <View style={{ flex: 1, backgroundColor: "#111" }}>
              {webLoading && !webError ? (
                <View style={styles.loader}>
                  <ActivityIndicator color={colors.brand.gold} size="large" />
                  <Text style={styles.loaderText}>Opening document…</Text>
                </View>
              ) : null}
              {webError ? (
                <UnsupportedFallback attachment={attachment} />
              ) : (
                <WebView
                  testID="attachment-webview"
                  originWhitelist={["*"]}
                  source={
                    Platform.OS === "android"
                      ? { html: pdfHtml, baseUrl: "" }
                      : { uri }
                  }
                  onLoadEnd={() => setWebLoading(false)}
                  onError={() => {
                    setWebLoading(false);
                    setWebError(true);
                  }}
                  javaScriptEnabled
                  domStorageEnabled
                  scalesPageToFit
                  style={{ backgroundColor: "#111" }}
                />
              )}
            </View>
          ) : (
            <UnsupportedFallback attachment={attachment} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function UnsupportedFallback({ attachment }: { attachment: Attachment }) {
  const icon = fileIconFor(attachment.mime);
  return (
    <View style={styles.fallback}>
      <View style={[styles.fallbackIcon, { backgroundColor: `${icon.color}22` }]}>
        <Ionicons name={icon.name} size={44} color={icon.color} />
      </View>
      <Text style={styles.fallbackTitle} numberOfLines={2}>
        {attachment.name}
      </Text>
      <Text style={styles.fallbackSub}>
        {readableSize(attachment.size)} · {attachment.mime || "unknown"}
      </Text>
      <Text style={styles.fallbackHint}>
        Preview isn’t available for this file type. Ask the reviewer to view
        images or PDFs directly.
      </Text>
    </View>
  );
}

const { width } = Dimensions.get("window");
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  backdrop: { flex: 1, backgroundColor: "#000" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text.inverse, fontSize: 14, fontWeight: "700" },
  subtitle: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 },
  body: { flex: 1, backgroundColor: "#111" },
  imgWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  img: { width: width, height: width * 1.35 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 1,
  },
  loaderText: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    gap: 12,
  },
  fallbackIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackTitle: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  fallbackSub: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  fallbackHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
});
