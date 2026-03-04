import { z } from "zod";

export const goalPeriodSchema = z.enum(["weekly", "monthly", "quarterly"]);
export type GoalPeriod = z.infer<typeof goalPeriodSchema>;

export const taskStatusSchema = z.enum(["active", "completed", "overdue"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export const taskCategorySchema = z.enum(["Project", "Once Time", "Weekly", "Monthly", "Customer", "Housework"]);
export const reminderPresetSchema = z.enum([
  "none",
  "1_day_before",
  "2_days_before",
  "3_days_before",
  "1_week_before",
  "2_weeks_before",
  "3_weeks_before",
  "custom"
]);
export const repeatRuleSchema = z.enum([
  "none",
  "hourly",
  "daily",
  "weekdays",
  "weekends",
  "weekly",
  "biweekly",
  "monthly",
  "every_3_months",
  "every_6_months",
  "yearly",
  "custom"
]);
export const repeatEndTypeSchema = z.enum(["never", "on_date"]);
export const notificationSchema = z.enum(["off", "email", "telegram", "all"]);

export const createGoalSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  periodType: goalPeriodSchema,
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  targetValue: z.number().positive(),
  unit: z.string().min(1)
});

export const goalCheckinSchema = z.object({
  value: z.number().nonnegative().optional(),
  durationMins: z.number().nonnegative().optional(),
  note: z.string().max(1000).optional(),
  checkinDate: z.string().datetime().optional()
});

const createSubtaskSchema = z.object({
  title: z.string().min(1),
  category: taskCategorySchema.default("Once Time"),
  description: z.string().max(2000).optional(),
  dueAt: z.string().datetime().optional(),
  priority: taskPrioritySchema.default("medium"),
  reminderPreset: reminderPresetSchema.default("none"),
  customReminderAt: z.string().datetime().optional(),
  repeatRule: repeatRuleSchema.default("none"),
  repeatCustom: z.string().max(200).optional(),
  repeatEndType: repeatEndTypeSchema.default("never"),
  repeatEndDate: z.string().datetime().optional(),
  tags: z.array(z.string().min(1)).default([]),
  notificationChannel: notificationSchema.default("all")
});

export const createTaskSchema = z.object({
  title: z.string().min(1),
  category: taskCategorySchema.default("Once Time"),
  description: z.string().max(2000).optional(),
  dueAt: z.string().datetime().optional(),
  priority: taskPrioritySchema.default("medium"),
  reminderPreset: reminderPresetSchema.default("none"),
  customReminderAt: z.string().datetime().optional(),
  repeatRule: repeatRuleSchema.default("none"),
  repeatCustom: z.string().max(200).optional(),
  repeatEndType: repeatEndTypeSchema.default("never"),
  repeatEndDate: z.string().datetime().optional(),
  tags: z.array(z.string().min(1)).default([]),
  notificationChannel: notificationSchema.default("all"),
  goalId: z.string().uuid().optional(),
  subtasks: z.array(createSubtaskSchema).default([])
});

export const createReminderSchema = z.object({
  remindAt: z.string().datetime(),
  channel: z.enum(["email", "telegram", "webpush"])
});
