import { useRef, useState } from "react";

/** A synchronous lock also guards keyboard shortcuts before React rerenders. */
export function useFormSubmission<T>(onSave: (data: T) => Promise<void>) {
  const pending = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const submit = async (data: T) => {
    if (pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setSaveError("");
    try {
      await onSave(data);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save. Please try again.");
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };
  return { submit, isSaving, saveError };
}
