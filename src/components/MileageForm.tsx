import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { X, Calendar, Route, FileText, Compass, AlertCircle } from "lucide-react";
import { MileageEntry } from "../types";

interface MileageFormProps {
  entryToEdit: MileageEntry | null;
  onSave: (entry: Omit<MileageEntry, "id"> & { id?: string }) => void;
  onCancel: () => void;
}

const TRIP_TYPES = [
  "Ride-share",
  "Delivery",
  "Client Meeting",
  "Supplies Pick-up",
  "Courier Run",
  "Other Business"
];

export default function MileageForm({ entryToEdit, onSave, onCancel }: MileageFormProps) {
  const [date, setDate] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startOdometer, setStartOdometer] = useState("");
  const [endOdometer, setEndOdometer] = useState("");
  const [tripType, setTripType] = useState("Ride-share");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<{
    date?: string;
    purpose?: string;
    startOdometer?: string;
    endOdometer?: string;
    tripType?: string;
  }>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Initialize fields if editing
  useEffect(() => {
    if (entryToEdit) {
      setDate(entryToEdit.date);
      setPurpose(entryToEdit.purpose);
      setStartOdometer(entryToEdit.startOdometer.toString());
      setEndOdometer(entryToEdit.endOdometer.toString());
      setTripType(entryToEdit.tripType);
      setNotes(entryToEdit.notes || "");
    } else {
      // Default to today's date
      const today = new Date().toISOString().split("T")[0];
      setDate(today);
      setPurpose("");
      setStartOdometer("");
      setEndOdometer("");
      setTripType("Ride-share");
      setNotes("");
    }
    setErrors({});
    setTouched({});
    setIsSubmitted(false);
  }, [entryToEdit]);

  // Real-time validation
  useEffect(() => {
    const newErrors: typeof errors = {};

    if (!date) {
      newErrors.date = "Please select a date.";
    }
    
    if (!purpose.trim()) {
      newErrors.purpose = "Please state the business purpose.";
    }
    
    const numStart = parseInt(startOdometer, 10);
    if (startOdometer === "") {
      newErrors.startOdometer = "Start odometer is required.";
    } else if (isNaN(numStart) || numStart < 0) {
      newErrors.startOdometer = "Enter a valid positive start odometer reading.";
    }
    
    const numEnd = parseInt(endOdometer, 10);
    if (endOdometer === "") {
      newErrors.endOdometer = "End odometer is required.";
    } else if (isNaN(numEnd) || numEnd < 0) {
      newErrors.endOdometer = "Enter a valid positive end odometer reading.";
    } else if (numEnd <= numStart) {
      newErrors.endOdometer = "End odometer must be greater than start odometer.";
    }

    setErrors(newErrors);
  }, [date, purpose, startOdometer, endOdometer]);

  const markTouched = (field: string) => {
    setTouched(prev => prev[field] ? prev : { ...prev, [field]: true });
  };

  const showError = (field: string) => {
    return !!(errors[field as keyof typeof errors] && (touched[field] || isSubmitted));
  };

  // Handle live calculation
  const numStart = parseInt(startOdometer, 10) || 0;
  const numEnd = parseInt(endOdometer, 10) || 0;
  const liveDistance = Math.max(0, numEnd - numStart);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);

    // Mark all validated fields as touched to display errors if any
    const allFields = ["date", "purpose", "startOdometer", "endOdometer"];
    const nextTouched: Record<string, boolean> = {};
    allFields.forEach(f => {
      nextTouched[f] = true;
    });
    setTouched(nextTouched);

    if (Object.keys(errors).length > 0) return;

    onSave({
      id: entryToEdit?.id,
      date,
      purpose: purpose.trim(),
      startOdometer: numStart,
      endOdometer: numEnd,
      distance: liveDistance,
      tripType,
      notes: notes.trim() || undefined,
    });
  };

  // Keyboard shortcut listener for saving the form (Ctrl+S)
  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSubmitRef.current(e as any);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        id="mileage-form-container"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/20 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100" id="form-title">
              {entryToEdit ? "Edit Business Trip" : "Log Business Trip"}
            </h3>
          </div>
          <button
            onClick={onCancel}
            type="button"
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
            id="close-form-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Primary Details (Date and Trip Type) */}
            <div className="space-y-4 md:col-span-2 bg-slate-100/60 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Date & Trip Type
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Date */}
                <div className="space-y-1">
                  <label htmlFor="trip-date" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Date of Travel
                  </label>
                  <input
                    type="date"
                    id="trip-date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); markTouched("date"); }}
                    onBlur={() => markTouched("date")}
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition [color-scheme:dark] ${
                      showError("date") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                    }`}
                  />
                  {showError("date") && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3" /> {errors.date}</p>
                  )}
                </div>

                {/* Trip Type */}
                <div className="space-y-1">
                  <label htmlFor="trip-type" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Category of Trip
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="trip-type"
                      value={tripType}
                      onChange={(e) => setTripType(e.target.value)}
                      list="trip-types-list"
                      placeholder="Type or select a category..."
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-850 dark:text-slate-100 border border-slate-250 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition"
                    />
                    <datalist id="trip-types-list">
                      {TRIP_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

              </div>
            </div>

            {/* Odometer Metrics (Start, End) */}
            <div className="space-y-4 bg-slate-100/60 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Odometer Readings
              </span>
              
              <div className="space-y-3">
                {/* Start Odometer */}
                <div className="space-y-1">
                  <label htmlFor="start-odometer" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Start Odometer (km)
                  </label>
                  <input
                    type="number"
                    id="start-odometer"
                    min="0"
                    step="1"
                    placeholder="e.g., 124500"
                    value={startOdometer}
                    onChange={(e) => { setStartOdometer(e.target.value); markTouched("startOdometer"); }}
                    onBlur={() => markTouched("startOdometer")}
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                      showError("startOdometer") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                    }`}
                  />
                  {showError("startOdometer") && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3" /> {errors.startOdometer}</p>
                  )}
                </div>

                {/* End Odometer */}
                <div className="space-y-1">
                  <label htmlFor="end-odometer" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    End Odometer (km)
                  </label>
                  <input
                    type="number"
                    id="end-odometer"
                    min="0"
                    step="1"
                    placeholder="e.g., 124820"
                    value={endOdometer}
                    onChange={(e) => { setEndOdometer(e.target.value); markTouched("endOdometer"); }}
                    onBlur={() => markTouched("endOdometer")}
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                      showError("endOdometer") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                    }`}
                  />
                  {showError("endOdometer") && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3" /> {errors.endOdometer}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Purpose and Description */}
            <div className="space-y-4 bg-slate-100/60 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Trip Purpose & Details
              </span>
              
              <div className="space-y-3">
                {/* Purpose */}
                <div className="space-y-1">
                  <label htmlFor="trip-purpose" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Business Purpose
                  </label>
                  <input
                    type="text"
                    id="trip-purpose"
                    placeholder="e.g., Delivery shift, Client meeting"
                    value={purpose}
                    onChange={(e) => { setPurpose(e.target.value); markTouched("purpose"); }}
                    onBlur={() => markTouched("purpose")}
                    className={`w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition ${
                      showError("purpose") ? "border-red-500 ring-1 ring-red-500" : "border-slate-250 dark:border-slate-700"
                    }`}
                  />
                  {showError("purpose") && (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3" /> {errors.purpose}</p>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label htmlFor="trip-notes" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Additional Notes (Optional)
                  </label>
                  <input
                    type="text"
                    id="trip-notes"
                    placeholder="e.g., Friday rush, heavy rain..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 border border-slate-250 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Real-time Distance Calculation summary banner */}
          <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-xl p-4 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                <Route className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-350 dark:text-slate-300 font-bold uppercase tracking-wider">
                  Auto-Calculated Distance
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-400">
                  {numEnd > numStart 
                    ? `End Odometer (${numEnd.toLocaleString()}) - Start Odometer (${numStart.toLocaleString()})`
                    : "Please enter valid start and end odometer readings."
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xl font-bold font-mono text-blue-400 block" id="calculated-distance-display">
                {liveDistance.toLocaleString()} km
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold">
                Estimated distance
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 transition cursor-pointer"
              id="cancel-form-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 border border-blue-700 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition shadow-md shadow-blue-100 dark:shadow-none cursor-pointer"
              id="submit-form-btn"
            >
              {entryToEdit ? "Save Changes" : "Log Trip"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
