import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import { api, Attachment, Task, TaskAssignment } from "@/src/api/client";
import { colors } from "@/src/theme/colors";
import { useAuth } from "@/src/auth/AuthContext";
import { useToast } from "@/src/ui/toast";
import {
  AssignmentStatusPill,
  OverallStatusPill,
  PriorityPill,
  RatingStars,
} from "@/src/ui/pills";
import { AttachmentViewer, fileIconFor } from "@/src/ui/attachment-viewer";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
}

async function fetchAsBase64(uri: string): Promise<string | null> {
  try {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const result = reader.result as string;
        const idx = result.indexOf("base64,");
        resolve(idx >= 0 ? result.slice(idx + 7) : result);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Submit modal state
  const [submitFor, setSubmitFor] = useState<TaskAssignment | null>(null);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]); // base64 data URIs
  const [files, setFiles] = useState<Attachment[]>([]);

  // In-app attachment viewer
  const [viewer, setViewer] = useState<Attachment | null>(null);

  // Review modal state
  const [reviewFor, setReviewFor] = useState<TaskAssignment | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [rating, setRating] = useState(4);
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const t = await api.get<Task>(`/tasks/${id}`);
      setTask(t);
    } catch (e: any) {
      toast.show(e?.message || "Failed to load task", "error");
    }
  }, [id, toast]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await load();
        setLoading(false);
      })();
    }, [load])
  );

  const canManage =
    user &&
    task &&
    (user.role === "admin" || task.created_by === user.id);

  const askPickPermissions = async (): Promise<boolean> => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (perm.granted) return true;
    if (!perm.canAskAgain) {
      toast.show("Enable photos access in settings", "error");
      await Linking.openSettings();
      return false;
    }
    const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return req.granted;
  };

  const pickPhoto = async () => {
    const ok = await askPickPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const base64 =
      asset.base64 ?? (asset.uri ? await fetchAsBase64(asset.uri) : null);
    if (!base64) {
      toast.show("Failed to read image", "error");
      return;
    }
    setPhotos((prev) => [...prev, `data:image/jpeg;base64,${base64}`]);
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      // Guard: max ~8MB base64 (~5.9MB binary) so payload stays reasonable
      if (asset.size && asset.size > 8 * 1024 * 1024) {
        toast.show("File too large (max 8 MB)", "error");
        return;
      }
      const mime = asset.mimeType || "application/octet-stream";
      const b64 = await fetchAsBase64(asset.uri);
      if (!b64) {
        toast.show("Failed to read file", "error");
        return;
      }
      const dataUri = b64.startsWith("data:") ? b64 : `data:${mime};base64,${b64}`;
      const attachment: Attachment = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: asset.name || "attachment",
        mime,
        size: asset.size || 0,
        data_uri: dataUri,
      };
      setFiles((prev) => [...prev, attachment]);
    } catch (e: any) {
      toast.show(e?.message || "Failed to pick file", "error");
    }
  };

  const openSubmit = (a: TaskAssignment) => {
    setSubmitFor(a);
    setNote("");
    setPhotos([]);
    setFiles([]);
  };

  const doSubmit = async () => {
    if (!task || !submitFor) return;
    if (photos.length === 0 && files.length === 0 && !note.trim()) {
      toast.show("Add a photo, file, or note first", "error");
      return;
    }
    setBusy(true);
    try {
      const updated = await api.post<Task>(
        `/tasks/${task.id}/assignments/${submitFor.id}/submit`,
        { photos, files, note }
      );
      setTask(updated);
      setSubmitFor(null);
      toast.show("Submitted for review", "success");
    } catch (e: any) {
      toast.show(e?.message || "Submit failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const startAssignment = async (a: TaskAssignment) => {
    if (!task) return;
    setBusy(true);
    try {
      const updated = await api.post<Task>(
        `/tasks/${task.id}/assignments/${a.id}/status`,
        { status: "in_progress" }
      );
      setTask(updated);
      toast.show("Marked as in progress", "success");
    } catch (e: any) {
      toast.show(e?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const openReview = (a: TaskAssignment, d: "approve" | "reject") => {
    setReviewFor(a);
    setDecision(d);
    setRating(d === "approve" ? 5 : 3);
    setFeedback("");
  };

  const doReview = async () => {
    if (!task || !reviewFor) return;
    setBusy(true);
    try {
      const updated = await api.post<Task>(
        `/tasks/${task.id}/assignments/${reviewFor.id}/review`,
        { decision, rating, feedback }
      );
      setTask(updated);
      setReviewFor(null);
      toast.show(
        decision === "approve" ? "Approved with rating" : "Rejected — sent back",
        "success"
      );
    } catch (e: any) {
      toast.show(e?.message || "Review failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteTask = async () => {
    if (!task) return;
    setBusy(true);
    try {
      await api.del(`/tasks/${task.id}`);
      toast.show("Task deleted", "success");
      router.back();
    } catch (e: any) {
      toast.show(e?.message || "Failed to delete", "error");
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="task-detail-back"
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color={colors.brand.maroon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Task Details
        </Text>
        {canManage && task ? (
          <TouchableOpacity
            testID="task-delete"
            onPress={deleteTask}
            style={styles.iconBtn}
            hitSlop={10}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={colors.brand.maroon}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator
          color={colors.brand.maroon}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : task ? (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          {task.project_name ? (
            <TouchableOpacity
              onPress={() =>
                task.project_id &&
                router.push(`/(app)/projects/${task.project_id}`)
              }
              testID="task-project-link"
              activeOpacity={0.75}
            >
              <Text style={styles.project}>◆ {task.project_name}</Text>
            </TouchableOpacity>
          ) : task.category ? (
            <Text style={styles.category}>{task.category}</Text>
          ) : null}

          <Text style={styles.title} testID="task-detail-title">
            {task.title}
          </Text>

          <View style={styles.pillsRow}>
            <OverallStatusPill status={task.overall_status} />
            <PriorityPill priority={task.priority} />
            {task.is_recurring ? (
              <View style={styles.recurring}>
                <Ionicons name="repeat" size={11} color={colors.brand.gold} />
                <Text style={styles.recurringText}>
                  {task.recurrence?.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>

          {task.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Details</Text>
              <Text style={styles.description}>{task.description}</Text>
            </View>
          ) : null}

          <View style={styles.metaGrid}>
            <MetaRow
              icon="ribbon"
              label="Assigned by"
              value={task.created_by_name || "—"}
            />
            <MetaRow
              icon="calendar"
              label="Due date"
              value={
                task.due_date
                  ? new Date(task.due_date).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "No due date"
              }
            />
            <MetaRow
              icon="time"
              label="Created"
              value={new Date(task.created_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
          </View>

          <Text style={styles.sectionLabel}>
            Assignments ({task.assignments.length})
          </Text>

          {task.assignments.map((a) => {
            const isMine = user?.id === a.assignee_id;
            const isReviewer = canManage;
            return (
              <View
                key={a.id}
                style={styles.assignCard}
                testID={`assignment-${a.id}`}
              >
                <View style={styles.assignTop}>
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor:
                          a.assignee_role === "manager"
                            ? colors.brand.navy
                            : colors.brand.maroon,
                      },
                    ]}
                  >
                    <Text style={styles.avatarText}>
                      {initials(a.assignee_name || "?")}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assignName}>
                      {a.assignee_name}
                      {isMine ? "  (you)" : ""}
                    </Text>
                    <AssignmentStatusPill status={a.status} size="sm" />
                  </View>
                  {a.final_rating != null ? (
                    <RatingStars value={a.final_rating} size={13} showValue />
                  ) : null}
                </View>

                {a.rounds.length > 0 ? (
                  <View style={styles.roundsWrap}>
                    {a.rounds.map((r, ridx) => (
                      <View key={r.id} style={styles.round}>
                        <View style={styles.roundHeader}>
                          <Text style={styles.roundLabel}>
                            Round {ridx + 1} · {" "}
                            <Text style={styles.roundDate}>
                              {new Date(r.submitted_at).toLocaleDateString(
                                undefined,
                                { day: "numeric", month: "short" }
                              )}
                            </Text>
                          </Text>
                          {r.decision ? (
                            <View
                              style={[
                                styles.decisionPill,
                                {
                                  backgroundColor:
                                    r.decision === "approve"
                                      ? "rgba(9,121,105,0.15)"
                                      : "rgba(123,24,30,0.15)",
                                  borderColor:
                                    r.decision === "approve"
                                      ? colors.brand.emerald
                                      : colors.brand.maroon,
                                },
                              ]}
                            >
                              <Ionicons
                                name={
                                  r.decision === "approve"
                                    ? "checkmark"
                                    : "close"
                                }
                                size={11}
                                color={
                                  r.decision === "approve"
                                    ? colors.brand.emerald
                                    : colors.brand.maroon
                                }
                              />
                              <Text
                                style={[
                                  styles.decisionText,
                                  {
                                    color:
                                      r.decision === "approve"
                                        ? colors.brand.emerald
                                        : colors.brand.maroon,
                                  },
                                ]}
                              >
                                {r.decision.toUpperCase()}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.reviewPending}>
                              Awaiting review
                            </Text>
                          )}
                        </View>

                        {r.note ? (
                          <Text style={styles.roundNote}>“{r.note}”</Text>
                        ) : null}

                        {r.photos.length > 0 ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
                          >
                            {r.photos.map((p, i) => (
                              <TouchableOpacity
                                key={i}
                                testID={`round-photo-${r.id}-${i}`}
                                activeOpacity={0.85}
                                onPress={() =>
                                  setViewer({
                                    id: `photo-${r.id}-${i}`,
                                    name: `Photo ${i + 1}`,
                                    mime: "image/jpeg",
                                    size: 0,
                                    data_uri: p,
                                  })
                                }
                              >
                                <Image source={{ uri: p }} style={styles.thumb} />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : null}

                        {(r.files || []).length > 0 ? (
                          <View style={styles.roundFilesList}>
                            {(r.files || []).map((f) => {
                              const icon = fileIconFor(f.mime);
                              return (
                                <TouchableOpacity
                                  key={f.id}
                                  testID={`round-file-${r.id}-${f.id}`}
                                  onPress={() => setViewer(f)}
                                  activeOpacity={0.85}
                                  style={styles.roundFileChip}
                                >
                                  <Ionicons
                                    name={icon.name}
                                    size={15}
                                    color={icon.color}
                                  />
                                  <Text
                                    style={styles.roundFileName}
                                    numberOfLines={1}
                                  >
                                    {f.name}
                                  </Text>
                                  <Ionicons
                                    name="chevron-forward"
                                    size={13}
                                    color={colors.text.muted}
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : null}

                        {r.rating != null ? (
                          <View style={styles.reviewBlock}>
                            <View style={styles.reviewBlockRow}>
                              <Text style={styles.reviewBy}>
                                by {r.reviewed_by_name || "—"}
                              </Text>
                              <RatingStars value={r.rating} size={12} showValue />
                            </View>
                            {r.feedback ? (
                              <Text style={styles.reviewFeedback}>
                                {r.feedback}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Actions per role */}
                <View style={styles.assignActions}>
                  {isMine &&
                  (a.status === "pending" || a.status === "rejected") ? (
                    <TouchableOpacity
                      testID={`start-${a.id}`}
                      onPress={() => startAssignment(a)}
                      disabled={busy || a.status !== "pending"}
                      style={[
                        styles.actionBtnAlt,
                        a.status !== "pending" && { opacity: 0.4 },
                      ]}
                    >
                      <Ionicons
                        name="play"
                        size={13}
                        color={colors.brand.maroon}
                      />
                      <Text style={styles.actionBtnAltText}>Start</Text>
                    </TouchableOpacity>
                  ) : null}

                  {isMine &&
                  (a.status === "pending" ||
                    a.status === "in_progress" ||
                    a.status === "rejected") ? (
                    <TouchableOpacity
                      testID={`submit-${a.id}`}
                      onPress={() => openSubmit(a)}
                      disabled={busy}
                      style={styles.actionBtn}
                    >
                      <Ionicons
                        name="send"
                        size={13}
                        color={colors.text.inverse}
                      />
                      <Text style={styles.actionBtnText}>
                        {a.status === "rejected" ? "Resubmit" : "Submit"}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {isReviewer && a.status === "submitted" ? (
                    <>
                      <TouchableOpacity
                        testID={`reject-${a.id}`}
                        onPress={() => openReview(a, "reject")}
                        disabled={busy}
                        style={[
                          styles.actionBtnAlt,
                          { borderColor: colors.brand.maroon },
                        ]}
                      >
                        <Ionicons
                          name="close-circle"
                          size={13}
                          color={colors.brand.maroon}
                        />
                        <Text style={styles.actionBtnAltText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`approve-${a.id}`}
                        onPress={() => openReview(a, "approve")}
                        disabled={busy}
                        style={[
                          styles.actionBtn,
                          { backgroundColor: colors.brand.emerald },
                        ]}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={13}
                          color={colors.text.inverse}
                        />
                        <Text style={styles.actionBtnText}>Approve</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ padding: 20 }}>
          <Text style={styles.description}>Task not found.</Text>
        </View>
      )}

      {/* Submit modal */}
      <Modal
        visible={!!submitFor}
        transparent
        animationType="fade"
        onRequestClose={() => setSubmitFor(null)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard} testID="submit-modal">
            <View style={styles.modalHeader}>
              <View style={styles.modalCrest}>
                <Ionicons name="send" size={15} color={colors.brand.gold} />
              </View>
              <Text style={styles.modalTitle}>Submit for Review</Text>
              <TouchableOpacity
                testID="submit-modal-close"
                onPress={() => setSubmitFor(null)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Add photos, files, or a short note describing what you completed.
            </Text>
            <TextInput
              testID="submit-note-input"
              value={note}
              onChangeText={setNote}
              multiline
              placeholder="Notes (optional)…"
              placeholderTextColor={colors.text.muted}
              style={styles.modalInput}
              textAlignVertical="top"
            />
            <View style={styles.thumbsRow}>
              {photos.map((p, i) => (
                <View key={i} style={{ position: "relative" }}>
                  <Image source={{ uri: p }} style={styles.thumb} />
                  <TouchableOpacity
                    testID={`remove-photo-${i}`}
                    onPress={() =>
                      setPhotos((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    style={styles.removeThumb}
                  >
                    <Ionicons
                      name="close"
                      size={11}
                      color={colors.text.inverse}
                    />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                testID="pick-photo"
                onPress={pickPhoto}
                style={styles.addThumb}
                activeOpacity={0.85}
              >
                <Ionicons name="image" size={20} color={colors.brand.gold} />
                <Text style={styles.addThumbText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="pick-file"
                onPress={pickFile}
                style={styles.addThumb}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="document-attach"
                  size={20}
                  color={colors.brand.gold}
                />
                <Text style={styles.addThumbText}>File</Text>
              </TouchableOpacity>
            </View>
            {files.length > 0 ? (
              <View style={styles.filesList}>
                {files.map((f, i) => {
                  const icon = fileIconFor(f.mime);
                  return (
                    <View key={f.id} style={styles.fileChip}>
                      <Ionicons name={icon.name} size={16} color={icon.color} />
                      <Text style={styles.fileChipName} numberOfLines={1}>
                        {f.name}
                      </Text>
                      <TouchableOpacity
                        testID={`remove-file-${i}`}
                        onPress={() =>
                          setFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        hitSlop={8}
                      >
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={colors.text.muted}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <TouchableOpacity
              testID="confirm-submit"
              disabled={busy || (photos.length === 0 && files.length === 0 && !note.trim())}
              onPress={doSubmit}
              activeOpacity={0.85}
              style={[
                styles.confirmBtn,
                (busy ||
                  (photos.length === 0 && files.length === 0 && !note.trim())) && { opacity: 0.5 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <>
                  <Ionicons name="send" size={16} color={colors.text.inverse} />
                  <Text style={styles.confirmBtnText}>Send for Review</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Review modal */}
      <Modal
        visible={!!reviewFor}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewFor(null)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard} testID="review-modal">
            <View style={styles.modalHeader}>
              <View style={styles.modalCrest}>
                <Ionicons
                  name={decision === "approve" ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={
                    decision === "approve"
                      ? colors.brand.emerald
                      : colors.brand.maroon
                  }
                />
              </View>
              <Text style={styles.modalTitle}>
                {decision === "approve" ? "Approve & Rate" : "Reject & Rate"}
              </Text>
              <TouchableOpacity
                testID="review-modal-close"
                onPress={() => setReviewFor(null)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              {decision === "approve"
                ? "Rate this submission. Final task rating = mean of all rounds."
                : "Rate this attempt and give feedback so they can retry."}
            </Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  testID={`rating-star-${n}`}
                  onPress={() => setRating(n)}
                  hitSlop={8}
                >
                  <Text
                    style={{
                      fontSize: 32,
                      color:
                        n <= rating
                          ? colors.brand.gold
                          : "rgba(212,175,55,0.35)",
                      marginHorizontal: 4,
                    }}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              testID="review-feedback"
              value={feedback}
              onChangeText={setFeedback}
              multiline
              placeholder={
                decision === "reject"
                  ? "What needs to be improved?"
                  : "Optional feedback…"
              }
              placeholderTextColor={colors.text.muted}
              style={styles.modalInput}
              textAlignVertical="top"
            />
            <TouchableOpacity
              testID="confirm-review"
              disabled={busy}
              onPress={doReview}
              activeOpacity={0.85}
              style={[
                styles.confirmBtn,
                {
                  backgroundColor:
                    decision === "approve"
                      ? colors.brand.emerald
                      : colors.brand.maroon,
                },
                busy && { opacity: 0.6 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <>
                  <Ionicons
                    name={
                      decision === "approve" ? "checkmark-circle" : "close-circle"
                    }
                    size={16}
                    color={colors.text.inverse}
                  />
                  <Text style={styles.confirmBtnText}>
                    {decision === "approve" ? "Approve" : "Reject"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AttachmentViewer
        visible={!!viewer}
        attachment={viewer}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIconWrap}>
        <Ionicons name={icon} size={14} color={colors.brand.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15, fontWeight: "700",
    color: colors.brand.maroon, letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  project: {
    color: colors.brand.gold,
    fontSize: 11.5, letterSpacing: 2, fontWeight: "700",
    marginBottom: 6,
  },
  category: {
    color: colors.brand.maroon,
    fontSize: 11, letterSpacing: 2, fontWeight: "700",
    marginBottom: 6, textTransform: "uppercase",
  },
  title: {
    fontSize: 26, fontWeight: "700",
    color: colors.text.primary, letterSpacing: -0.4,
    lineHeight: 32, marginBottom: 14,
  },
  pillsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20,
  },
  recurring: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(212,175,55,0.15)",
    borderWidth: 1, borderColor: colors.border.medium,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
  },
  recurringText: {
    fontSize: 10.5, fontWeight: "700",
    color: colors.brand.goldDeep, letterSpacing: 1,
  },
  section: { marginBottom: 22 },
  sectionLabel: {
    fontSize: 11, color: colors.text.secondary,
    letterSpacing: 2, fontWeight: "700",
    textTransform: "uppercase", marginBottom: 10,
  },
  description: {
    fontSize: 15, color: colors.text.primary, lineHeight: 22,
  },
  metaGrid: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 14, padding: 6,
    borderWidth: 1, borderColor: colors.border.subtle,
    marginBottom: 22,
  },
  metaRow: {
    flexDirection: "row", alignItems: "center",
    padding: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(212,175,55,0.15)",
  },
  metaIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(212,175,55,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  metaLabel: {
    fontSize: 10.5, color: colors.text.muted,
    letterSpacing: 1.5, fontWeight: "700",
    textTransform: "uppercase", marginBottom: 3,
  },
  metaValue: {
    fontSize: 14, color: colors.text.primary, fontWeight: "600",
  },
  assignCard: {
    backgroundColor: colors.bg.primary,
    borderWidth: 1, borderColor: colors.border.subtle,
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  assignTop: {
    flexDirection: "row", alignItems: "center",
    gap: 10, marginBottom: 10,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: {
    color: colors.text.inverse, fontWeight: "700", fontSize: 13,
  },
  assignName: {
    fontSize: 14, fontWeight: "700", color: colors.text.primary,
    marginBottom: 4,
  },
  roundsWrap: {
    marginTop: 4,
    gap: 8,
  },
  round: {
    backgroundColor: colors.bg.secondary,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  roundHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  roundLabel: {
    fontSize: 11.5, fontWeight: "700",
    color: colors.brand.maroon, letterSpacing: 0.5,
  },
  roundDate: {
    color: colors.text.muted, fontWeight: "600",
  },
  decisionPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  decisionText: {
    fontSize: 9.5, fontWeight: "700", letterSpacing: 0.6,
  },
  reviewPending: {
    fontSize: 10, color: colors.brand.gold,
    fontWeight: "700", letterSpacing: 0.5,
  },
  roundNote: {
    fontSize: 12.5, color: colors.text.secondary,
    fontStyle: "italic", marginBottom: 6,
  },
  thumb: {
    width: 60, height: 60, borderRadius: 8,
    backgroundColor: colors.bg.tertiary,
  },
  reviewBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.2)",
  },
  reviewBlockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reviewBy: {
    fontSize: 11, color: colors.text.muted, fontWeight: "600",
  },
  reviewFeedback: {
    fontSize: 12.5, color: colors.text.primary, lineHeight: 17,
    marginTop: 4,
  },
  assignActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.brand.maroon,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999,
  },
  actionBtnText: {
    color: colors.text.inverse,
    fontSize: 12.5, fontWeight: "700", letterSpacing: 0.4,
  },
  actionBtnAlt: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.bg.secondary,
    borderWidth: 1, borderColor: colors.brand.maroon,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999,
  },
  actionBtnAltText: {
    color: colors.brand.maroon,
    fontSize: 12.5, fontWeight: "700", letterSpacing: 0.4,
  },
  backdrop: {
    flex: 1, backgroundColor: "rgba(26,18,16,0.65)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  modalCard: {
    width: "100%", maxWidth: 460,
    backgroundColor: colors.bg.primary,
    borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: colors.border.medium,
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center",
    gap: 10, marginBottom: 6,
  },
  modalCrest: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: colors.brand.gold,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.15)",
  },
  modalTitle: {
    flex: 1, fontSize: 17, fontWeight: "700",
    color: colors.brand.maroon,
  },
  modalSub: {
    fontSize: 12.5, color: colors.text.secondary, marginBottom: 12,
  },
  modalInput: {
    backgroundColor: colors.bg.secondary,
    borderWidth: 1, borderColor: colors.border.subtle,
    borderRadius: 12, padding: 12, minHeight: 80,
    color: colors.text.primary, fontSize: 14,
  },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 12,
  },
  thumbsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  addThumb: {
    width: 60, height: 60,
    borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.brand.gold,
    borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(212,175,55,0.10)",
  },
  addThumbText: {
    fontSize: 9, color: colors.brand.gold, fontWeight: "700",
    marginTop: 2, letterSpacing: 0.5,
  },
  removeThumb: {
    position: "absolute", top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.brand.maroon,
    alignItems: "center", justifyContent: "center",
  },
  filesList: {
    gap: 6,
    marginTop: 8,
  },
  fileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.primary,
  },
  fileChipName: {
    flex: 1,
    fontSize: 12.5,
    color: colors.text.primary,
    fontWeight: "600",
  },
  roundFilesList: {
    marginTop: 6,
    gap: 6,
  },
  roundFileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.primary,
  },
  roundFileName: {
    flex: 1,
    fontSize: 12,
    color: colors.text.primary,
    fontWeight: "600",
  },
  confirmBtn: {
    marginTop: 14,
    backgroundColor: colors.brand.maroon,
    borderRadius: 12, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  confirmBtnText: {
    color: colors.text.inverse,
    fontWeight: "700", fontSize: 14, letterSpacing: 0.4,
  },
});
