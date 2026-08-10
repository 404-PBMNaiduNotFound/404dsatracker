"use client";

import { useState, useMemo } from "react";
import { useTopicReminders } from "@/hooks/useTopicReminders";
import { usePlan } from "@/hooks/usePlan";
import { todayIso, formatDate } from "@/lib/plan";
import { toast } from "sonner";
import { Bell, Calendar, Clock, Plus, Trash2, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TopicReminderSection() {
  const { reminders, loading, addReminder, removeReminder } = useTopicReminders();
  const { days } = usePlan();

  // Extract unique topic names from user plan
  const planTopics = useMemo(() => {
    const set = new Set<string>();
    days.forEach((d) => {
      if (d.topic) set.add(d.topic);
    });
    return Array.from(set).sort();
  }, [days]);

  const [selectedTopic, setSelectedTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("19:00");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const topicToSet = selectedTopic === "custom" || !selectedTopic ? customTopic.trim() : selectedTopic;
    if (!topicToSet) {
      toast.error("Please select or enter a topic name.");
      return;
    }
    if (!date) {
      toast.error("Please pick a date.");
      return;
    }
    if (!time) {
      toast.error("Please set a reminder time.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addReminder({
        topic: topicToSet,
        date,
        time,
        note: note.trim() || undefined,
      });

      toast.success(`Reminder set for "${topicToSet}" on ${formatDate(date)} at ${format12HourTime(time)}!`, {
        description: "You'll receive browser and email notifications at the scheduled time.",
      });

      // Reset form
      setSelectedTopic("");
      setCustomTopic("");
      setNote("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add reminder. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, topic: string) => {
    try {
      await removeReminder(id);
      toast.success(`Deleted reminder for "${topic}".`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete reminder.");
    }
  };

  function format12HourTime(t: string) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
  }

  return (
    <div className="mb-8 rounded-2xl border border-border/80 bg-card/60 p-5 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              Topic Reminders
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3" /> Email & In-App
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Schedule targeted reminders for specific DSA topics to be notified on your chosen date & time.
            </p>
          </div>
        </div>
      </div>

      {/* Reminder Creation Form */}
      <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-border/60 bg-muted/30 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Topic Select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Select Topic</Label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">-- Pick Topic from Plan --</option>
              {planTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="custom">+ Enter Custom Topic...</option>
            </select>
          </div>

          {/* Custom Topic Input (if chosen or empty topic) */}
          {(selectedTopic === "custom" || selectedTopic === "") && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Custom Topic Name</Label>
              <Input
                placeholder="e.g. Graphs, Dynamic Programming"
                value={customTopic}
                onChange={(e) => setCustomTopic(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          )}

          {/* Date Picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" /> Date
            </Label>
            <Input
              type="date"
              min={todayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Time Picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" /> Time
            </Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {/* Note & Submit */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-1">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Optional Note / Problem Focus</Label>
            <Input
              placeholder="e.g. Revise Hard DP problems or revision notes"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-9 px-4 text-xs gap-1.5 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Plus className="size-4" />
            Set Reminder
          </Button>
        </div>
      </form>

      {/* Reminders List */}
      <div>
        <h3 className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <span>Scheduled Reminders</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {reminders.length}
          </span>
        </h3>

        {loading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Loading reminders...</div>
        ) : reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/50 p-6 text-center">
            <Bell className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs font-medium text-foreground">No topic reminders set yet</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Use the form above to schedule a reminder for any topic on a specific day and time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reminders.map((rem) => {
              const isPast = rem.triggered;
              return (
                <div
                  key={rem.id}
                  className={`group relative flex items-start justify-between rounded-xl border p-3.5 transition-all ${
                    isPast
                      ? "border-border/40 bg-muted/20 opacity-75"
                      : "border-primary/20 bg-background hover:border-primary/40 shadow-xs"
                  }`}
                >
                  <div className="space-y-1 pr-8">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">{rem.topic}</span>
                      {isPast ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <CheckCircle2 className="size-3" /> Triggered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Bell className="size-3" /> Scheduled
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        {formatDate(rem.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {format12HourTime(rem.time)}
                      </span>
                    </div>

                    {rem.note && (
                      <p className="text-xs text-muted-foreground/90 italic pt-1 border-t border-border/40 mt-1.5">
                        "{rem.note}"
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleDelete(rem.id, rem.topic)}
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    title="Delete reminder"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
