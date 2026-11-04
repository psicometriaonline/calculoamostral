import { sql } from "drizzle-orm";
import { pgTable, pgMaterializedView, text, varchar, integer, real, boolean, timestamp, jsonb, json, serial, uniqueIndex, unique, index, date, primaryKey, foreignKey, check, customType, bigint, doublePrecision, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tipo customizado tsvector (Postgres) — necessário para a coluna gerada
// `search_tsv` em lesson_transcripts. Drizzle 0.39 não tem `tsvector` nativo,
// mas com `customType` conseguimos declarar a coluna e o índice GIN no schema,
// evitando que `drizzle-kit push --force` (do post-merge) os derrube em silêncio
// (Task #473, extensão do fix da Task #469).
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: varchar("role").default("user").notNull(), // "admin" | "user"
  fullName: text("full_name"),
  email: text("email").unique(),
  phone: text("phone"), // Phone number
  cpf: text("cpf"), // CPF/CNPJ for Brazilian users
  biography: text("biography"),
  avatarPath: text("avatar_path"),
  timezone: text("timezone").default("America/Sao_Paulo"),
  isBanned: boolean("is_banned").default(false).notNull(), // Member ban status
  hasUnlimitedAccess: boolean("has_unlimited_access").default(false).notNull(), // Unlimited access flag
  isInstitutionalManager: boolean("is_institutional_manager").default(false).notNull(), // Flag for institutional contract managers
  importSource: text("import_source"), // "memberkit" | "hotmart" | "webhook" | "manual" - tracks where user was imported from
  lastSeenAt: timestamp("last_seen_at"), // Last activity timestamp
  loginCount: integer("login_count").default(0).notNull(), // Total login count
  birthDate: date("birth_date"),
  gender: varchar("gender"),
  genderOther: text("gender_other"),
  educationLevel: varchar("education_level"),
  cnpqArea: varchar("cnpq_area"),
  fieldOfStudy: varchar("field_of_study"),
  specificCourse: text("specific_course"),
  isResearcher: boolean("is_researcher"),
  isResearchCoordinator: boolean("is_research_coordinator"),
  isUniversityProfessor: boolean("is_university_professor"),
  isPhdProgramCoordinator: boolean("is_phd_program_coordinator"),
  institution: text("institution"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  emailVerificationCode: text("email_verification_code"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at"),
  lastVerificationCodeSentAt: timestamp("last_verification_code_sent_at"),
  verificationCodeAttempts: integer("verification_code_attempts").default(0).notNull(),
  profileCompleted: boolean("profile_completed").default(false).notNull(),
  onboardingSeen: boolean("onboarding_seen").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  phone: true,
  cpf: true,
  importSource: true,
}).extend({
  email: z.string().email().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  importSource: z.string().optional(),
});

// Profile update schema (excluding sensitive fields)
export const updateProfileSchema = createInsertSchema(users).pick({
  fullName: true,
  email: true,
  biography: true,
  timezone: true,
  birthDate: true,
  gender: true,
  genderOther: true,
  educationLevel: true,
  cnpqArea: true,
  fieldOfStudy: true,
  specificCourse: true,
  isResearcher: true,
  isResearchCoordinator: true,
  isUniversityProfessor: true,
  isPhdProgramCoordinator: true,
  institution: true,
}).extend({
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido"),
  biography: z.string().optional(),
  timezone: z.string().min(1, "Fuso horário é obrigatório"),
  birthDate: z.string().nullable().optional(),
  gender: z.enum(["male", "female", "non_binary", "other"]).nullable().optional(),
  genderOther: z.string().nullable().optional(),
  educationLevel: z.enum(["undergraduate", "graduate", "master_student", "master", "phd_student", "phd"]).nullable().optional(),
  cnpqArea: z.string().nullable().optional(),
  fieldOfStudy: z.string().nullable().optional(),
  specificCourse: z.string().nullable().optional(),
  isResearcher: z.boolean().nullable().optional(),
  isResearchCoordinator: z.boolean().nullable().optional(),
  isUniversityProfessor: z.boolean().nullable().optional(),
  isPhdProgramCoordinator: z.boolean().nullable().optional(),
  institution: z.string().nullable().optional(),
});

// Password change schema  
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

// Admin member update schema (for managing members)
export const updateMemberSchema = createInsertSchema(users).pick({
  fullName: true,
  email: true,
  phone: true,
  cpf: true,
  isBanned: true,
  hasUnlimitedAccess: true,
  role: true,
  createdAt: true,
  birthDate: true,
  gender: true,
  genderOther: true,
  educationLevel: true,
  cnpqArea: true,
  fieldOfStudy: true,
  specificCourse: true,
  isResearcher: true,
  isResearchCoordinator: true,
  isUniversityProfessor: true,
  isPhdProgramCoordinator: true,
  institution: true,
}).extend({
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  isBanned: z.boolean().optional(),
  hasUnlimitedAccess: z.boolean().optional(),
  role: z.enum(["user", "admin", "manager", "professor"]).optional(),
  createdAt: z.preprocess(
    (val) => {
      if (val === "" || val === null) return undefined;
      return val;
    },
    z.coerce.date().optional()
  ),
  newPassword: z.string().optional().refine(
    (val) => !val || val.length >= 6,
    { message: "Senha deve ter pelo menos 6 caracteres" }
  ),
  birthDate: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().nullable().optional()
  ),
  gender: z.preprocess(
    (val) => (val === "" ? null : val),
    z.enum(["male", "female", "non_binary", "other"]).nullable().optional()
  ),
  genderOther: z.string().nullable().optional(),
  educationLevel: z.preprocess(
    (val) => (val === "" ? null : val),
    z.enum(["undergraduate", "graduate", "master_student", "master", "phd_student", "phd"]).nullable().optional()
  ),
  cnpqArea: z.string().nullable().optional(),
  fieldOfStudy: z.string().nullable().optional(),
  specificCourse: z.string().nullable().optional(),
  isResearcher: z.boolean().nullable().optional(),
  isResearchCoordinator: z.boolean().nullable().optional(),
  isUniversityProfessor: z.boolean().nullable().optional(),
  isPhdProgramCoordinator: z.boolean().nullable().optional(),
  institution: z.string().nullable().optional(),
});

// Admin member create schema (for creating new members)
export const createMemberSchema = createInsertSchema(users).pick({
  fullName: true,
  email: true,
  phone: true,
  cpf: true,
  isBanned: true,
  hasUnlimitedAccess: true,
  role: true,
  createdAt: true,
  birthDate: true,
  gender: true,
  genderOther: true,
  educationLevel: true,
  cnpqArea: true,
  fieldOfStudy: true,
  specificCourse: true,
  isResearcher: true,
  isResearchCoordinator: true,
  isUniversityProfessor: true,
  isPhdProgramCoordinator: true,
  institution: true,
}).extend({
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  isBanned: z.boolean().default(false),
  hasUnlimitedAccess: z.boolean().default(false),
  role: z.enum(["user", "admin", "manager", "professor"]).default("user"),
  createdAt: z.preprocess(
    (val) => {
      if (val === "" || val === null) return undefined;
      return val;
    },
    z.coerce.date().optional()
  ),
  password: z.preprocess(
    (val) => {
      if (val === "" || val === null) return undefined;
      return val;
    },
    z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional()
  ),
  birthDate: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().nullable().optional()
  ),
  gender: z.preprocess(
    (val) => (val === "" ? null : val),
    z.enum(["male", "female", "non_binary", "other"]).nullable().optional()
  ),
  genderOther: z.string().nullable().optional(),
  educationLevel: z.preprocess(
    (val) => (val === "" ? null : val),
    z.enum(["undergraduate", "graduate", "master_student", "master", "phd_student", "phd"]).nullable().optional()
  ),
  cnpqArea: z.string().nullable().optional(),
  fieldOfStudy: z.string().nullable().optional(),
  specificCourse: z.string().nullable().optional(),
  isResearcher: z.boolean().nullable().optional(),
  isResearchCoordinator: z.boolean().nullable().optional(),
  isUniversityProfessor: z.boolean().nullable().optional(),
  isPhdProgramCoordinator: z.boolean().nullable().optional(),
  institution: z.string().nullable().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type UpdateMember = z.infer<typeof updateMemberSchema>;
export type CreateMember = z.infer<typeof createMemberSchema>;

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token é obrigatório"),
  newPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export const verifyAndResetPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
  code: z.string().length(4, "Código deve ter 4 dígitos"),
  newPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type VerifyAndResetPassword = z.infer<typeof verifyAndResetPasswordSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Menu customization table
export const menuConfigurations = pgTable("menu_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  menuType: varchar("menu_type").notNull(), // 'admin' | 'user'
  section: varchar("section").notNull(), // 'main' | 'aiTools'
  items: jsonb("items").notNull().$type<Array<{
    id: string;
    title: string;
    url: string;
    icon: string;
    order: number;
    customTitle?: string;
  }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMenuConfigurationSchema = createInsertSchema(menuConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MenuConfiguration = typeof menuConfigurations.$inferSelect;
export type InsertMenuConfiguration = z.infer<typeof insertMenuConfigurationSchema>;

// Authentication schemas
export const loginSchema = z.object({
  username: z.string().min(1, "Nome de usuário ou e-mail é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
  trustDevice: z.boolean().optional(),
});

export const registerSchema = z.object({
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
  cpf: z.string().optional(),
  acceptedTerms: z.boolean().optional(),
  acceptedPrivacy: z.boolean().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export const verifyEmailSchema = z.object({
  email: z.string().email("E-mail inválido"),
  code: z.string().length(4, "Código deve ter 4 dígitos"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export function isPhoneValueValid(value: string | null | undefined): boolean {
  if (!value) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

const phoneE164Required = z
  .string()
  .min(1, "Telefone é obrigatório")
  .refine((v) => v.trim().startsWith("+") && isPhoneValueValid(v), {
    message: "Telefone inválido",
  });

export const completeProfileSchema = z.object({
  phone: phoneE164Required,
  birthDate: z.string().min(1, "Data de nascimento é obrigatória"),
  gender: z.enum(["male", "female", "non_binary", "other"], { required_error: "Sexo é obrigatório" }),
  genderOther: z.string().optional(),
  educationLevel: z.enum(["undergraduate", "graduate", "master_student", "master", "phd_student", "phd"], { required_error: "Escolaridade é obrigatória" }),
  fieldOfStudy: z.string().min(1, "Área de atuação é obrigatória"),
  specificCourse: z.string().min(1, "Curso específico é obrigatório"),
  institution: z.string().min(1, "Instituição é obrigatória"),
  isResearcher: z.boolean().nullable(),
  isResearchCoordinator: z.boolean().nullable(),
  isUniversityProfessor: z.boolean().nullable(),
  isPhdProgramCoordinator: z.boolean().nullable(),
});

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type VerifyEmailData = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationData = z.infer<typeof resendVerificationSchema>;
export type CompleteProfileData = z.infer<typeof completeProfileSchema>;

// Categories table
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").default(0),
  productTab: varchar("product_tab").default("psicometria"), // Product tab grouping
});

// Courses table  
export const courses = pgTable("courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  coverImage: text("cover_image").notNull(),
  categoryId: varchar("category_id").references(() => categories.id),
  order: integer("order").default(0),
  // New fields for course editing
  salesUrl: text("sales_url"),
  sigla: text("sigla"),
  showInShowcase: boolean("show_in_showcase").default(true),
  enableCommentModeration: boolean("enable_comment_moderation").default(false),
  // Task #504 — Auto-aprovar transcrições Whisper recém-geradas. Quando true,
  // o worker grava `review_status='approved'` no INSERT inicial, eliminando o
  // passo manual de aprovar (útil em cursos onde o admin confia no Whisper).
  autoApproveWhisperTranscripts: boolean("auto_approve_whisper_transcripts").default(false),
  productTab: varchar("product_tab").default("psicometria"), // Product tab grouping (fallback if no category)
  isPrivate: boolean("is_private").default(true).notNull(), // Access control flag - SECURITY: default true for private courses
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  description: true,
  order: true,
  productTab: true,
});

export const insertCourseSchema = createInsertSchema(courses)
  .pick({
    title: true,
    description: true,
    coverImage: true,
    categoryId: true,
    order: true,
    salesUrl: true,
    sigla: true,
    showInShowcase: true,
    enableCommentModeration: true,
    autoApproveWhisperTranscripts: true,
    productTab: true,
    isPrivate: true,
  })
  .extend({
    coverImage: z.string().min(1, 'Imagem de capa é obrigatória'),
  });

// Frontend form schema (doesn't require coverImage since it comes from file upload)
export const courseFormSchema = createInsertSchema(courses)
  .pick({
    title: true,
    description: true,
    categoryId: true,
    order: true,
    salesUrl: true,
    sigla: true,
    showInShowcase: true,
    enableCommentModeration: true,
    autoApproveWhisperTranscripts: true,
    productTab: true,
    isPrivate: true,
  })
  .extend({
    coverImage: z.string().optional(),
  });

// Edit course form schema (for editing existing courses)
export const editCourseFormSchema = createInsertSchema(courses)
  .pick({
    title: true,
    description: true,
    categoryId: true,
    salesUrl: true,
    sigla: true,
    showInShowcase: true,
    enableCommentModeration: true,
    autoApproveWhisperTranscripts: true,
    productTab: true,
  })
  .extend({
    coverImage: z.string().optional(),
  });

// Course reorder schema for drag-and-drop
export const reorderCoursesSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().min(1, "Course ID é obrigatório"),
      order: z.number().int().min(0, "Order deve ser um número inteiro não negativo"),
      categoryId: z.string().nullable(),
    })
  ).min(1, "Pelo menos um curso deve ser reordenado"),
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type CourseForm = z.infer<typeof courseFormSchema>;
export type EditCourseForm = z.infer<typeof editCourseFormSchema>;
export type Course = typeof courses.$inferSelect;
export type ReorderCourses = z.infer<typeof reorderCoursesSchema>;

// Course Professors table (associates professor users with courses they can manage)
export const courseProfessors = pgTable("course_professors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: varchar("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProfessorCourse: uniqueIndex("course_professors_unique_idx").on(table.userId, table.courseId),
}));

export const insertCourseProfessorSchema = createInsertSchema(courseProfessors).pick({
  userId: true,
  courseId: true,
});

export type CourseProfessor = typeof courseProfessors.$inferSelect;
export type InsertCourseProfessor = z.infer<typeof insertCourseProfessorSchema>;

// Material schema for lesson supplementary content
export const materialSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string(),
  path: z.string(), // File path or URL
  type: z.string(), // File type (pdf, doc, etc.)
  size: z.number().optional(), // File size in bytes
  description: z.string().optional(),
  isGenerated: z.boolean().default(false), // True for AI-generated PDFs
});

export type Material = z.infer<typeof materialSchema>;

// Modules table (belong to courses)
export const modules = pgTable("modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  order: integer("order").default(0),
});

// Lessons table (belong to modules)
export const lessons = pgTable("lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  moduleId: varchar("module_id").references(() => modules.id).notNull(),
  order: integer("order").default(0),
  // Vimeo integration fields
  vimeoVideoId: text("vimeo_video_id"),
  vimeoUrl: text("vimeo_url"),
  videoDuration: integer("video_duration"), // in seconds
  // Materials field for supplementary content (PDFs, slides, etc.)
  materials: jsonb("materials").$type<Material[]>().default([]),
  // AI-generated summary field for lesson content
  summary: text("summary"),
  // Task #518 — Status materializado de legenda por idioma. Pré-calculado
  // pelas mesmas escritas que mexem em `lesson_transcripts` (worker, aprovação,
  // publicação, etc) através de `recomputeLessonSubtitleStatus` em
  // `server/lib/lessonSubtitleStatus.ts` — única fonte de verdade. A query da
  // listagem do Vimeo (#519) passa a LER aqui em vez de recalcular via EXISTS
  // a cada request. Valores possíveis: 'missing' | 'draft' | 'pending_review' |
  // 'approved' | 'published' | 'rejected' | 'outdated' (mesmo conjunto da
  // função `buildSubtitleStatusCond`). NULL = aula nunca foi backfillada
  // (transição) — tratada como 'missing' pelo consumidor.
  subtitleStatusPt: varchar("subtitle_status_pt"),
  subtitleStatusEs: varchar("subtitle_status_es"),
  subtitleStatusUpdatedAt: timestamp("subtitle_status_updated_at"),
}, (table) => ({
  vimeoVideoIdIdx: index("idx_lessons_vimeo_video_id")
    .on(table.vimeoVideoId)
    .where(sql`${table.vimeoVideoId} IS NOT NULL`),
  subtitleStatusPtIdx: index("idx_lessons_subtitle_status_pt")
    .on(table.subtitleStatusPt)
    .where(sql`${table.subtitleStatusPt} IS NOT NULL`),
  subtitleStatusEsIdx: index("idx_lessons_subtitle_status_es")
    .on(table.subtitleStatusEs)
    .where(sql`${table.subtitleStatusEs} IS NOT NULL`),
}));

export const insertModuleSchema = createInsertSchema(modules).pick({
  name: true,
  description: true,
  courseId: true,
  order: true,
});

export const insertLessonSchema = createInsertSchema(lessons).pick({
  title: true,
  description: true,
  moduleId: true,
  order: true,
  vimeoVideoId: true,
  vimeoUrl: true,
  videoDuration: true,
  materials: true,
});

// Form schema for creating lessons (frontend)
export const lessonFormSchema = createInsertSchema(lessons)
  .pick({
    title: true,
    description: true,
    moduleId: true,
    vimeoVideoId: true,
    vimeoUrl: true,
  })
  .extend({
    materials: z.array(materialSchema).optional(),
  });

export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type LessonForm = z.infer<typeof lessonFormSchema>;
export type Lesson = typeof lessons.$inferSelect;

// Comments table (belong to lessons and users)
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  lessonId: varchar("lesson_id").references(() => lessons.id).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  parentId: varchar("parent_id"), // For nested comments - self-reference
  rating: integer("rating"), // 1-5 rating (emoji reactions)
  isModerated: boolean("is_moderated").default(false),
  // Administrative fields
  status: varchar("status").default("unread").notNull(), // "unread" | "approved" | "rejected" | "pending"
  adminResponse: text("admin_response"), // Response from admin/professor
  aiGenerated: boolean("ai_generated").default(false), // True if response was AI-generated
  respondedAt: timestamp("responded_at"), // When admin responded
  respondedById: varchar("responded_by_id").references(() => users.id), // Who responded (admin/professor)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  editedAt: timestamp("edited_at"), // When comment was last edited by author
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  content: true,
  lessonId: true,
  userId: true,
  parentId: true,
  rating: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Notifications table for user notifications (comment replies, etc.)
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type").notNull(), // "comment_reply" | "admin_response" | etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  // Reference to related entities
  lessonId: varchar("lesson_id").references(() => lessons.id),
  commentId: varchar("comment_id").references(() => comments.id, { onDelete: "cascade" }),
  // Who triggered the notification (e.g., admin who responded)
  triggeredByUserId: varchar("triggered_by_user_id").references(() => users.id),
  // Reference to broadcast notification (for cascade delete when broadcast is removed)
  broadcastId: varchar("broadcast_id"),
  // Optional URL for broadcast notifications
  linkUrl: text("link_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  lessonId: true,
  commentId: true,
  triggeredByUserId: true,
  linkUrl: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Lesson transcripts table for storing subtitle files and AI-generated transcripts
// Task #315: extensão aditiva — novas colunas com timestamps, SRT/VTT, workflow
// de revisão e referência ao Vimeo. Todos os campos novos são nullable ou têm
// default; nada quebra dados ou rotas existentes (status legado continua sendo
// usado como antes; reviewStatus é uma dimensão paralela usada pelas Tasks #317+).
export const lessonTranscripts = pgTable("lesson_transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").references(() => lessons.id).notNull(),
  language: varchar("language").default("pt-BR").notNull(),
  source: varchar("source").notNull(), // "upload" | "ai" | "translation"
  status: varchar("status").default("ready").notNull(), // "ready" | "processing" | "failed"
  plainText: text("plain_text").notNull(),
  rawFormat: varchar("raw_format"), // "srt" | "vtt" | "txt"
  rawText: text("raw_text"), // Original subtitle file content
  // ── Task #315: timestamps e formatos derivados ──
  // Task #383: `avgLogprob` é o avg_logprob retornado pelo Whisper para cada
  // segmento (≈ 0 = alta confiança; ≤ -0.5 = trecho suspeito). Opcional para
  // não quebrar transcripts antigos que ainda não têm o campo populado.
  segmentsJson: jsonb("segments_json").$type<Array<{ idx: number; start: number; end: number; text: string; avgLogprob?: number | null }>>(),
  // ── Task #800: timestamps por PALAVRA do Whisper (timestamp_granularities).
  // Persistidos para permitir RE-SEGMENTAR as legendas PT-BR (cortando cues na
  // borda exata de cada palavra) sem re-chamar o Whisper. `null` = transcript
  // antigo/sem palavras; `[]` = transcrito mas sem palavras (áudio curto).
  // Declarado aqui para o `drizzle-kit push` do post-merge NÃO dropar a coluna.
  wordsJson: jsonb("words_json").$type<Array<{ word: string; start: number; end: number }>>(),
  srtText: text("srt_text"),
  vttText: text("vtt_text"),
  model: varchar("model"), // ex.: "whisper-1"
  durationSec: integer("duration_sec"),
  costCents: integer("cost_cents"),
  // ── Task #315: workflow de revisão (consumido pelas Tasks #317+) ──
  reviewStatus: varchar("review_status").default("draft").notNull(),
  // valores: "draft" | "pending_review" | "approved" | "rejected" | "published" | "outdated"
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  // ── Task #315: rastreio do Vimeo texttrack (gravação só via Tasks #316+) ──
  vimeoTexttrackUri: text("vimeo_texttrack_uri"),
  vimeoSyncedAt: timestamp("vimeo_synced_at"),
  vimeoActive: boolean("vimeo_active").default(false).notNull(),
  // ── Task #344: marcador de conteúdo (hash do VTT) usado pela publicação no
  // Vimeo para distinguir "republicar puro" (mesmo conteúdo → reativar URI)
  // de "conteúdo novo" (regerar/traduzir/editar → recriar texttrack). Usar
  // hash em vez de timestamp evita destruir a URI quando a edição é
  // cosmética (ex.: mudar review_status) e bumpa updated_at sem mudar VTT.
  // `vttHash` reflete o conteúdo atual; `vimeoSyncedHash` reflete o que
  // está atualmente publicado no Vimeo.
  vttHash: text("vtt_hash"),
  vimeoSyncedHash: text("vimeo_synced_hash"),
  // ── Task #316: rastrear tradução de origem ──
  translatedFromId: varchar("translated_from_id"),
  // ── Task #319: último admin que editou cues no drawer ──
  lastEditedBy: varchar("last_edited_by"),
  // ── Task #406: marca transcripts ES gerados com a pós-etapa de
  // rebalanceamento de timestamps habilitada. Consumido pelo drawer para
  // mostrar a pílula "Rebalanceado" e pelo histórico para auditoria. PT-BR
  // sempre permanece `false` (rebalanceamento é exclusivo da tradução).
  rebalanced: boolean("rebalanced").notNull().default(false),
  // ── Task #634: termos técnicos que a IA provavelmente errou neste transcript.
  // Detecção best-effort (variantes do dicionário + near-match difuso), roda ao
  // final do job e também retroativamente. NUNCA bloqueia o job. `null` = nunca
  // verificado; `[]` = verificado e limpo. Consumido pelo drawer de revisão e
  // pelo relatório consolidado no painel Vimeo.
  suspectTermsJson: jsonb("suspect_terms_json").$type<Array<{
    found: string;
    suggested: string;
    segmentIdx: number;
    start: number;
    end: number;
    kind: "variant" | "fuzzy" | "lowconf";
    termId?: string | null;
    avgLogprob?: number | null;
    verified?: boolean | null;
  }>>(),
  suspectTermsCheckedAt: timestamp("suspect_terms_checked_at"),
  // ── Task #772: descartes LOCAIS de termos suspeitos deste transcript. Lista
  // de chaves estáveis por ocorrência (`segmentIdx|found|suggested` normalizado)
  // que a re-detecção/re-verificação NUNCA deve ressuscitar. `null`/`[]` = nada
  // descartado (comportamento idêntico ao anterior). Declarada aqui para o
  // `drizzle-kit push` do post-merge não dropar a coluna criada pela migration.
  suspectTermsDismissedJson: jsonb("suspect_terms_dismissed_json").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // ── Task #473: declarar `search_tsv` (coluna gerada tsvector) no schema
  // para o `drizzle-kit push --force` do post-merge NÃO dropar a coluna nem
  // o índice GIN abaixo. A definição precisa casar exatamente com a que a
  // migration `ensure-transcription-tables.ts` cria como fallback defensivo.
  searchTsv: tsvector("search_tsv").generatedAlwaysAs(
    sql`to_tsvector('portuguese', coalesce("plain_text", ''))`,
  ),
}, (table) => ({
  // Task #469: declarar o índice UNIQUE em (lesson_id, language) no schema
  // para o `drizzle-kit push` do post-merge NÃO o dropar. O índice é
  // requisito do `ON CONFLICT (lesson_id, language)` usado pelo worker
  // de tradução em `server/transcription-worker.ts`. O nome precisa bater
  // com o que a migration `ensure-transcription-tables.ts` cria como
  // fallback (`uq_lesson_lang`).
  uqLessonLang: uniqueIndex("uq_lesson_lang").on(table.lessonId, table.language),
  // Task #473: índices criados pela migration ensure-transcription-tables.ts
  // declarados aqui para sobreviver ao `drizzle-kit push --force`. Os nomes
  // batem com os criados pela migration (fallback defensivo).
  searchTsvIdx: index("idx_lesson_transcripts_search_tsv").using("gin", table.searchTsv),
  reviewStatusIdx: index("idx_lesson_transcripts_review_status").on(table.reviewStatus),
  lessonLangReviewIdx: index("idx_lesson_transcripts_lesson_lang_review").on(
    table.lessonId,
    table.language,
    table.reviewStatus,
  ),
  lessonLangStatusIdx: index("idx_lesson_transcripts_lesson_lang_status").on(
    table.lessonId,
    table.language,
    table.status,
  ),
  activePartialIdx: index("idx_lesson_transcripts_active_partial")
    .on(table.lessonId, table.language)
    .where(sql`${table.vimeoActive} = true`),
  reviewedByFk: foreignKey({
    name: "lesson_transcripts_reviewed_by_fkey",
    columns: [table.reviewedBy],
    foreignColumns: [users.id],
  }).onDelete("set null"),
  translatedFromFk: foreignKey({
    name: "lesson_transcripts_translated_from_id_fkey",
    columns: [table.translatedFromId],
    foreignColumns: [table.id],
  }).onDelete("set null"),
  lastEditedByFk: foreignKey({
    name: "lesson_transcripts_last_edited_by_fkey",
    columns: [table.lastEditedBy],
    foreignColumns: [users.id],
  }).onDelete("set null"),
}));

// O ciclo de vida da MV é gerenciado pelo fluxo de schema de desenvolvimento
// (scripts/post-merge.sh) e pelo diff dev→prod do Publishing. `existing()` faz
// o drizzle-kit reconhecer o objeto sem tentar apagá-lo/recriá-lo no db:push.
// Os índices pertencem à própria MV e são criados junto dela no setup de dev.
export const subtitleCoverageMaterializedView = pgMaterializedView("mv_subtitle_coverage", {
  lessonId: varchar("lesson_id"),
  courseId: varchar("course_id"),
  moduleId: varchar("module_id"),
  showInShowcase: boolean("show_in_showcase"),
  videoDuration: integer("video_duration"),
  vimeoVideoId: text("vimeo_video_id"),
  ptTranscriptId: varchar("pt_transcript_id"),
  ptReviewStatus: varchar("pt_review_status"),
  ptVimeoActive: boolean("pt_vimeo_active"),
  ptVimeoSynced: boolean("pt_vimeo_synced"),
  esTranscriptId: varchar("es_transcript_id"),
  esReviewStatus: varchar("es_review_status"),
  esVimeoActive: boolean("es_vimeo_active"),
  esVimeoSynced: boolean("es_vimeo_synced"),
}).existing();

export const insertLessonTranscriptSchema = createInsertSchema(lessonTranscripts).pick({
  lessonId: true,
  language: true,
  source: true,
  status: true,
  plainText: true,
  rawFormat: true,
  rawText: true,
  segmentsJson: true,
  // Task #800 — permite persistir timestamps por palavra via updateTranscript.
  wordsJson: true,
  srtText: true,
  vttText: true,
  model: true,
  durationSec: true,
  costCents: true,
  reviewStatus: true,
  vimeoTexttrackUri: true,
  vimeoSyncedAt: true,
  vimeoActive: true,
  vttHash: true,
  vimeoSyncedHash: true,
  translatedFromId: true,
  lastEditedBy: true,
  rebalanced: true,
});

export type InsertLessonTranscript = z.infer<typeof insertLessonTranscriptSchema>;
export type LessonTranscript = typeof lessonTranscripts.$inferSelect;
export type TranscriptSegment = { idx: number; start: number; end: number; text: string; avgLogprob?: number | null };

// ============================================================================
// Task #634 — Dicionário de termos técnicos (estatística/psicometria) EDITÁVEL
// pelo admin. Alimenta três fluxos ADITIVOS (não-regressivos):
//   1. `prompt` do Whisper (vocabulário injetado ANTES da transcrição);
//   2. reforço do prompt de tradução (verbatim + hints de tradução);
//   3. detecção de termos suspeitos (variantes = erros comuns que a IA produz).
// Vazio/desabilitado => os três fluxos se comportam exatamente como antes.
// ============================================================================
export const transcriptionTechnicalTerms = pgTable("transcription_technical_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Forma canônica/correta (ex.: "ANOVA", "p-valor", "heterocedasticidade").
  term: text("term").notNull(),
  // Agrupamento opcional para a UI (ex.: "teste", "software", "medida", "conceito").
  category: varchar("category"),
  // true => NÃO traduzir (acrônimos/marcas/nomes próprios). Usado pelo tradutor.
  keepVerbatim: boolean("keep_verbatim").notNull().default(false),
  // Tradução ES preferida quando o termo DEVE ser traduzido (ex.: "p-valor"→"valor p").
  translation: text("translation"),
  // Erros comuns que a IA costuma produzir para este termo (grafias/fonética).
  // Base da detecção de "termos suspeitos". Em PORTUGUÊS.
  variants: text("variants").array().notNull().default(sql`'{}'::text[]`),
  // Task #677 — grafias erradas comuns em ESPANHOL (legendas ES). Em ES a forma
  // canônica sugerida é a `translation`; estas variantes detectam erros de
  // transcrição em palavras espanholas que NÃO são acrônimos universais.
  variantsEs: text("variants_es").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  enabled: boolean("enabled").notNull().default(true),
  // Maior prioridade entra primeiro no orçamento de ~224 tokens do prompt Whisper.
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references((): AnyPgColumn => users.id),
}, (table) => ({
  // Case-insensitive uniqueness — espelha a migração (lower("term")).
  termUnique: uniqueIndex("uq_transcription_terms_term").on(sql`lower(${table.term})`),
  enabledIdx: index("idx_transcription_terms_enabled").on(table.enabled),
}));

export const insertTranscriptionTechnicalTermSchema = createInsertSchema(transcriptionTechnicalTerms, {
  term: z.string().trim().min(1, "Termo é obrigatório").max(120),
  category: z.string().trim().max(60).optional().nullable(),
  translation: z.string().trim().max(120).optional().nullable(),
  variants: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  variantsEs: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
}).pick({
  term: true,
  category: true,
  keepVerbatim: true,
  translation: true,
  variants: true,
  variantsEs: true,
  notes: true,
  enabled: true,
  priority: true,
});

export const updateTranscriptionTechnicalTermSchema = insertTranscriptionTechnicalTermSchema.partial();

export type InsertTranscriptionTechnicalTerm = z.infer<typeof insertTranscriptionTechnicalTermSchema>;
export type UpdateTranscriptionTechnicalTerm = z.infer<typeof updateTranscriptionTechnicalTermSchema>;
export type TranscriptionTechnicalTerm = typeof transcriptionTechnicalTerms.$inferSelect;

// Task #635 — Ajustes finos da detecção de "termos suspeitos" (singleton).
// Expõe ao admin os limiares hoje fixos em detectSuspectTerms: o corte de
// avgLogprob (baixa confiança do Whisper) e a folga do casamento difuso nesses
// segmentos. Defaults preservam o comportamento atual.
export const transcriptionSuspectSettings = pgTable("transcription_suspect_settings", {
  id: varchar("id").primaryKey().default("singleton"),
  // Abaixo deste avgLogprob o segmento é tratado como "baixa confiança". Mais
  // próximo de 0 => mais segmentos entram (mais ruído); mais negativo => menos.
  lowconfLogprobThreshold: real("lowconf_logprob_threshold").notNull().default(-0.55),
  // Distância de edição máxima do casamento difuso em segmentos de baixa
  // confiança. Maior => mais frouxo (mais avisos); menor => mais estrito.
  lowconfMaxEditDistance: integer("lowconf_max_edit_distance").notNull().default(2),
  // Task #666 — quando ligado, o pipeline aplica AUTOMATICAMENTE todas as
  // correções seguras (kind === 'variant') ao texto, sem intervenção manual.
  // Default false: comportamento atual (só sinaliza, nunca altera) é preservado.
  autoApplySafeCorrections: boolean("auto_apply_safe_corrections").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references((): AnyPgColumn => users.id),
});

export const updateTranscriptionSuspectSettingsSchema = z.object({
  // Logprob é sempre negativo; limites largos para experimentação sem absurdos.
  lowconfLogprobThreshold: z.number().min(-5).max(0).default(-0.55),
  // 1 = só near-miss de 1 edição (mais estrito); até 4 para catálogos ruidosos.
  lowconfMaxEditDistance: z.number().int().min(1).max(4).default(2),
  // Task #666 — chave-mestra do auto-aplicar correções seguras. Default false.
  autoApplySafeCorrections: z.boolean().default(false),
});

export type TranscriptionSuspectSettings = typeof transcriptionSuspectSettings.$inferSelect;
export type UpdateTranscriptionSuspectSettings = z.infer<typeof updateTranscriptionSuspectSettingsSchema>;

// Task #772 — exceções GLOBAIS de termos suspeitos ("descartar sempre"). Cada
// linha é um par "encontrado→sugerido" NORMALIZADO (lower/trim/colapso de
// espaços) consultado por `detectSuspectTerms`: enquanto a exceção existir, esse
// par nunca mais é sinalizado como suspeito em transcript algum (variant, fuzzy
// ou lowconf), inclusive em novas transcrições. `*_sample` guardam a grafia
// original (display/remoção pelo dicionário). Tabela vazia => comportamento
// idêntico ao anterior (nada filtrado).
export const transcriptionSuspectExceptions = pgTable("transcription_suspect_exceptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  foundNorm: text("found_norm").notNull(),
  suggestedNorm: text("suggested_norm").notNull(),
  foundSample: text("found_sample"),
  suggestedSample: text("suggested_sample"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references((): AnyPgColumn => users.id),
}, (table) => ({
  // Espelha a migration: UNIQUE em (found_norm, suggested_norm) para o
  // `drizzle-kit push` do post-merge não dropar o índice de deduplicação.
  pairUnique: uniqueIndex("uq_suspect_exception_pair").on(table.foundNorm, table.suggestedNorm),
}));

export type TranscriptionSuspectException = typeof transcriptionSuspectExceptions.$inferSelect;

// Termo suspeito detectado num transcript (espelha `suspectTermsJson`).
export type SuspectTerm = {
  found: string;
  suggested: string;
  segmentIdx: number;
  start: number;
  end: number;
  // "variant": grafia errada cadastrada (alta confiança, determinístico).
  // "fuzzy": near-miss de 1 edição contra termo canônico.
  // "lowconf": segmento com baixa confiança do Whisper (avgLogprob) + near-miss
  //   de até 2 edições — sinal combinado (confiança do modelo + dicionário).
  kind: "variant" | "fuzzy" | "lowconf";
  termId?: string | null;
  avgLogprob?: number | null;
  // Resultado da verificação opcional por IA dos suspeitos incertos
  // (fuzzy/lowconf). `true` = IA confirmou; `false` = IA descartou;
  // ausente/null = não verificado (variantes não passam pela IA).
  verified?: boolean | null;
};

// Task #315: fila persistente de jobs de transcrição/tradução/sync Vimeo.
// Worker (server/transcription-worker.ts) consome usando FOR UPDATE SKIP LOCKED.
// jobType "publish_vimeo"/"unpublish_vimeo" só é enfileirado por ação manual
// explícita do admin (Tasks #316+); nunca automaticamente após transcrição.
export const transcriptionJobs = pgTable("transcription_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transcriptId: varchar("transcript_id").references((): AnyPgColumn => lessonTranscripts.id),
  lessonId: varchar("lesson_id").references(() => lessons.id).notNull(),
  jobType: varchar("job_type").notNull(), // "transcribe" | "translate" | "publish_vimeo" | "unpublish_vimeo"
  status: varchar("status").default("pending").notNull(), // "pending" | "running" | "completed" | "failed" | "cancelled"
  language: varchar("language"),
  targetLanguage: varchar("target_language"), // para translate
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  parentJobId: varchar("parent_job_id"),
  batchId: varchar("batch_id"),
  payload: jsonb("payload").default({}),
  error: text("error"),
  workerId: varchar("worker_id"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  nextAttemptAt: timestamp("next_attempt_at"),
  // Task #524 — heartbeat real do worker. Atualizado a cada ~30s enquanto o
  // job está `running`; usado por `recoverStaleJobs` para detectar crash em
  // ≤3min sem reverter falsamente jobs longos (vídeos 35min+).
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  createdBy: varchar("created_by").references(() => users.id),
  // Task #443 — admin pode "dispensar" um job failed pra ele sumir da UI
  // sem perder o registro histórico. Mantém o row no banco para auditoria.
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Task #473: índices criados pela migration ensure-transcription-tables.ts
  // declarados aqui para sobreviver ao `drizzle-kit push --force` do post-merge.
  // Os nomes batem com os criados pela migration (fallback defensivo).
  pendingIdx: index("idx_transcription_jobs_pending").on(table.status, table.nextAttemptAt),
  lessonStatusIdx: index("idx_transcription_jobs_lesson_status").on(table.lessonId, table.status),
  batchIdx: index("idx_transcription_jobs_batch").on(table.batchId),
  transcriptIdx: index("idx_transcription_jobs_transcript").on(table.transcriptId),
  heartbeatIdx: index("idx_transcription_jobs_heartbeat")
    .on(table.status, table.lastHeartbeatAt)
    .where(sql`${table.status} = 'running'`),
  lessonLangStatusIdx: index("idx_transcription_jobs_lesson_lang_status").on(
    table.lessonId,
    table.language,
    table.status,
  ),
  // Índice UNIQUE parcial: no máximo 1 job ativo (pending/running) por
  // (lesson_id, language, job_type). Resolve corrida de double-enqueue.
  uniqActive: uniqueIndex("uniq_transcription_jobs_active")
    .on(table.lessonId, table.language, table.jobType)
    .where(sql`status IN ('pending', 'running')`),
  acknowledgedByFk: foreignKey({
    name: "transcription_jobs_acknowledged_by_fkey",
    columns: [table.acknowledgedBy],
    foreignColumns: [users.id],
  }).onDelete("set null"),
}));

export const insertTranscriptionJobSchema = createInsertSchema(transcriptionJobs).pick({
  transcriptId: true,
  lessonId: true,
  jobType: true,
  status: true,
  language: true,
  targetLanguage: true,
  maxAttempts: true,
  parentJobId: true,
  batchId: true,
  payload: true,
  nextAttemptAt: true,
  createdBy: true,
});

export type InsertTranscriptionJob = z.infer<typeof insertTranscriptionJobSchema>;
export type TranscriptionJob = typeof transcriptionJobs.$inferSelect;

// Task #843 — Checkpoint de progresso por chunk para jobs 'transcribe' de
// vídeos longos. Tabela DEDICADA (não payload do job) para não inflar as
// consultas de listagem de jobs: segments/words de um vídeo de 60min podem
// somar centenas de KB. Uma linha por job (job_id PK).
// Task #854 — ciclo de vida: o checkpoint só é descartado quando o job
// CONCLUI. Em falha terminal ou cancelamento ele fica preservado para ser
// ADOTADO (re-chaveado) por um job novo da mesma aula+idioma, que retoma do
// último chunk transcrito. O GC do worker apaga checkpoints de jobs terminais
// apenas por idade (>30 dias) ou quando já existe transcript 'ready' mais
// novo para a mesma aula+idioma. ON DELETE CASCADE na migration continua
// cobrindo a exclusão do job em si.
export const transcriptionJobCheckpoints = pgTable("transcription_job_checkpoints", {
  jobId: varchar("job_id").primaryKey().references(() => transcriptionJobs.id, { onDelete: "cascade" }),
  transcriptId: varchar("transcript_id"),
  lessonId: varchar("lesson_id"),
  // Chaves de validade do resume: o áudio re-baixado precisa ter o MESMO
  // tamanho e o chunking o MESMO tamanho de chunk, senão os offsets não batem
  // e o checkpoint é descartado (recomeça do zero).
  audioSizeBytes: bigint("audio_size_bytes", { mode: "number" }).notNull(),
  chunkDurationSeconds: integer("chunk_duration_seconds").notNull(),
  totalChunks: integer("total_chunks").notNull(),
  // Chunks 0..nextChunkIndex-1 já concluídos; retomar a partir de nextChunkIndex.
  nextChunkIndex: integer("next_chunk_index").notNull(),
  cumulativeOffsetSec: doublePrecision("cumulative_offset_sec").notNull(),
  segmentsJson: jsonb("segments_json").notNull(),
  wordsJson: jsonb("words_json").notNull(),
  textsJson: jsonb("texts_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TranscriptionJobCheckpoint = typeof transcriptionJobCheckpoints.$inferSelect;

// Task #315: log de auditoria imutável de tudo que acontece com transcrições e
// jobs. Usado para histórico (Task #320) e para diagnosticar regressões.
export const transcriptionAuditLog = pgTable("transcription_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transcriptId: varchar("transcript_id"),
  jobId: varchar("job_id"),
  lessonId: varchar("lesson_id"),
  action: varchar("action").notNull(),
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status"),
  actorId: varchar("actor_id").references(() => users.id),
  actorType: varchar("actor_type").default("system").notNull(), // "system" | "admin" | "webhook"
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Task #473: índices criados pelas migrations ensure-transcription-tables.ts
  // e ensure-subtitle-settings.ts. Declarados aqui para sobreviver ao
  // `drizzle-kit push --force` do post-merge. Os nomes batem com os criados
  // pelas migrations (fallback defensivo).
  transcriptIdx: index("idx_transcription_audit_transcript").on(table.transcriptId, table.createdAt.desc()),
  jobIdx: index("idx_transcription_audit_job").on(table.jobId, table.createdAt.desc()),
  lessonIdx: index("idx_transcription_audit_lesson").on(table.lessonId, table.createdAt.desc()),
  actionCreatedIdx: index("idx_transcription_audit_action_created").on(table.action, table.createdAt.desc()),
  actorIdx: index("idx_transcription_audit_actor").on(table.actorId, table.createdAt.desc()),
}));

export const insertTranscriptionAuditLogSchema = createInsertSchema(transcriptionAuditLog).pick({
  transcriptId: true,
  jobId: true,
  lessonId: true,
  action: true,
  previousStatus: true,
  newStatus: true,
  actorId: true,
  actorType: true,
  metadata: true,
});

export type InsertTranscriptionAuditLog = z.infer<typeof insertTranscriptionAuditLogSchema>;
export type TranscriptionAuditLog = typeof transcriptionAuditLog.$inferSelect;

// ── Task #320: configurações operacionais do sistema de legendas ─────────────
// Tabela single-row (id fixo = 'singleton') com cap mensal, alertas de gasto
// e SLA de revisão pendente. Mudanças entram como audit `settings.updated`.
export const subtitleSettings = pgTable("subtitle_settings", {
  id: varchar("id").primaryKey().default("singleton"),
  monthlyCapUsd: integer("monthly_cap_usd").notNull().default(100),
  alertVideoHours: integer("alert_video_hours").notNull().default(2),
  alertBatchUsd: integer("alert_batch_usd").notNull().default(5),
  pendingReviewSlaDays: integer("pending_review_sla_days").notNull().default(7),
  // ── Legendas ES espelham automaticamente o PT-BR (Task #812); os antigos
  // ajustes ES (rebalance/word-seg/min-max cue/cps) foram removidos por não
  // terem mais efeito. As colunas es_* legadas são dropadas pela migration
  // ensure-subtitle-settings.
  // ── Task #799: rebalanceamento + quebra de linha PT-BR. Diferente do ES, o
  // default é LIGADO porque as legendas PT-BR saíam direto do Whisper sem
  // reprocessamento, aparecendo gigantes (até 4 linhas) no player do Vimeo.
  // `ptMaxCharsPerLine * ptMaxLines` vira o teto absoluto de caracteres por cue
  // (maxCharsPerCue) garantindo no máx. 2 linhas; preserva sincronismo (não
  // desloca bordas de bloco) e o invariante de raw_text/plain_text.
  ptRebalanceEnabled: boolean("pt_rebalance_enabled").notNull().default(true),
  ptMinCueSeconds: real("pt_min_cue_seconds").notNull().default(1.2),
  ptMaxCharsPerSecond: real("pt_max_chars_per_second").notNull().default(21),
  ptMaxCueSeconds: real("pt_max_cue_seconds").notNull().default(7),
  ptMaxCharsPerLine: integer("pt_max_chars_per_line").notNull().default(42),
  ptMaxLines: integer("pt_max_lines").notNull().default(2),
  // ── Task #800: segmentação PT-BR por TIMESTAMPS DE PALAVRA (método premium
  // Netflix/BBC). Quando LIGADO e o transcript tem `words_json`, o worker corta
  // os cues na borda exata de cada palavra (sincronismo perfeito) em vez de
  // estimar o tempo via rebalanceamento (#799). Default LIGADO; cai
  // automaticamente no rebalanceamento quando não há palavras disponíveis.
  ptWordSegmentationEnabled: boolean("pt_word_segmentation_enabled").notNull().default(true),
  // Task #526 — limiar para alerta proativo "tradução com QA suspeito".
  // Quando o job `translate` gera mais que este número de warnings de QA
  // (comprimento, acrônimo perdido, texto vazio), dispara um aviso para o
  // admin via adminErrorService (severity 'warning') com link para a aula.
  translateQaWarningThreshold: integer("translate_qa_warning_threshold").notNull().default(5),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const updateSubtitleSettingsSchema = z.object({
  monthlyCapUsd: z.number().int().min(0).max(100000),
  alertVideoHours: z.number().int().min(0).max(24),
  alertBatchUsd: z.number().int().min(0).max(100000),
  pendingReviewSlaDays: z.number().int().min(1).max(365),
  // Task #799 — PT-BR. Defaults no padrão da indústria de legendagem:
  // 42 chars/linha, 2 linhas, 21cps, 1.2s mín, 7s máx. Default LIGADO.
  ptRebalanceEnabled: z.boolean().default(true),
  ptMinCueSeconds: z.number().min(0.3).max(5).default(1.2),
  ptMaxCharsPerSecond: z.number().min(5).max(50).default(21),
  ptMaxCueSeconds: z.number().min(2).max(15).default(7),
  ptMaxCharsPerLine: z.number().int().min(20).max(80).default(42),
  ptMaxLines: z.number().int().min(1).max(3).default(2),
  // Task #800 — método premium (timestamps por palavra). Default LIGADO.
  ptWordSegmentationEnabled: z.boolean().default(true),
  // Task #526 — 0 desativa o alerta proativo. Limite superior conservador
  // (200) porque vídeos longos podem legitimamente acumular muitos warnings.
  translateQaWarningThreshold: z.number().int().min(0).max(200).default(5),
});

export type SubtitleSettings = typeof subtitleSettings.$inferSelect;
export type UpdateSubtitleSettings = z.infer<typeof updateSubtitleSettingsSchema>;

// Chat sessions table for AI chatbot conversations
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").references(() => lessons.id),
  title: text("title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chat messages table for chatbot conversation history
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => chatSessions.id).notNull(),
  role: varchar("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  lessonId: true,
  title: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  sessionId: true,
  role: true,
  content: true,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Transcription progress table for tracking real-time progress
export const transcriptionProgress = pgTable("transcription_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transcriptId: varchar("transcript_id").references(() => lessonTranscripts.id).notNull(),
  step: varchar("step").notNull(), // "downloading" | "processing" | "transcribing" | "finalizing" | "completed" | "failed"
  progress: integer("progress").default(0).notNull(), // 0-100
  message: text("message"),
  totalSteps: integer("total_steps").default(4).notNull(),
  currentStepIndex: integer("current_step_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  transcriptIdx: index("idx_transcription_progress_transcript").on(table.transcriptId),
}));

export const insertTranscriptionProgressSchema = createInsertSchema(transcriptionProgress).pick({
  transcriptId: true,
  step: true,
  progress: true,
  message: true,
  totalSteps: true,
  currentStepIndex: true,
});

export type InsertTranscriptionProgress = z.infer<typeof insertTranscriptionProgressSchema>;
export type TranscriptionProgress = typeof transcriptionProgress.$inferSelect;

// Knowledge Base table for storing book chapters and lesson transcripts
export const knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  sourceType: varchar("source_type").notNull(), // "chapter" | "transcript" 
  sourceId: varchar("source_id"), // chapter number or lesson id
  originalPath: text("original_path"), // path to original DOCX file
  rawText: text("raw_text").notNull(),
  wordCount: integer("word_count").default(0),
  isProcessed: boolean("is_processed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Knowledge Chunks table for storing text chunks with OpenAI embeddings
export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  knowledgeBaseId: varchar("knowledge_base_id").references(() => knowledgeBase.id).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: text("embedding").notNull(), // JSON string of OpenAI embedding vector
  embeddingModel: varchar("embedding_model").default("text-embedding-3-small").notNull(),
  tokenCount: integer("token_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).pick({
  title: true,
  sourceType: true,
  sourceId: true,
  originalPath: true,
  rawText: true,
  wordCount: true,
});

export const insertKnowledgeChunkSchema = createInsertSchema(knowledgeChunks).pick({
  knowledgeBaseId: true,
  chunkIndex: true,
  content: true,
  embedding: true,
  embeddingModel: true,
  tokenCount: true,
});

export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeChunk = z.infer<typeof insertKnowledgeChunkSchema>;
export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;

// RAG Query schema for chatbot requests
export const ragQuerySchema = z.object({
  query: z.string().min(1, "Query é obrigatória"),
  lessonId: z.string().optional(), // For contextualizing with current lesson
  courseId: z.string().optional(), // For contextualizing with current course
  maxResults: z.number().min(1).max(20).default(5),
  minSimilarity: z.number().min(0).max(1).default(0.7),
});

export type RagQuery = z.infer<typeof ragQuerySchema>;

// Comment with user info (for display)
export type CommentWithUser = Comment & {
  user: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
};

// Extended comment type with replies for nested comments
export type CommentWithReplies = Comment & {
  replies: CommentWithReplies[];
  user?: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  respondedBy?: {
    id: string;
    fullName: string | null;
  };
};

// Banners table for homepage promotional banners
export const banners = pgTable("banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imagePath: text("image_path").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  startAt: timestamp("start_at"), // When banner should start showing (nullable)
  endAt: timestamp("end_at"), // When banner should stop showing (nullable)
  order: integer("order").default(0).notNull(), // For ordering multiple banners
  title: text("title"), // Optional title for admin reference
  linkUrl: text("link_url"), // Optional link when banner is clicked
  // Audience targeting filters - null/empty = visible to all users (incl. anonymous)
  audienceFilters: jsonb("audience_filters").$type<any>().default(null),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Pop-ups table for full-screen promotional pop-ups (3:4 image)
export const popups = pgTable("popups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imagePath: text("image_path").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  order: integer("order").default(0).notNull(),
  title: text("title"),
  linkUrl: text("link_url"),
  audienceFilters: jsonb("audience_filters").$type<any>().default(null),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Task #599 — dispensa de pop-up por usuário (regra "último anula os
// anteriores" + cross-device). Substitui o dismiss em localStorage que
// existia apenas no navegador. PK composta evita duplicatas; FKs em
// cascade limpam o registro se o usuário ou o pop-up for removido.
export const popupDismissals = pgTable("popup_dismissals", {
  userId: varchar("user_id").notNull(),
  popupId: varchar("popup_id").notNull(),
  dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.popupId] }),
  userFk: foreignKey({
    name: "popup_dismissals_user_id_fkey",
    columns: [table.userId],
    foreignColumns: [users.id],
  }).onDelete("cascade"),
  popupFk: foreignKey({
    name: "popup_dismissals_popup_id_fkey",
    columns: [table.popupId],
    foreignColumns: [popups.id],
  }).onDelete("cascade"),
}));

export const insertBannerSchema = createInsertSchema(banners)
  .pick({
    imagePath: true,
    isEnabled: true,
    startAt: true,
    endAt: true,
    order: true,
    title: true,
    linkUrl: true,
  })
  .extend({
    imagePath: z.string().min(1, 'Imagem do banner é obrigatória'),
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
    audienceFilters: z.any().optional().nullable(),
  })
  .refine((data) => {
    // Validate that startAt is before endAt when both are provided
    if (data.startAt && data.endAt) {
      return new Date(data.startAt) < new Date(data.endAt);
    }
    return true;
  }, {
    message: "Data de início deve ser anterior à data de fim",
  });

// Form schema for banner creation (frontend)
export const bannerFormSchema = createInsertSchema(banners)
  .pick({
    isEnabled: true,
    startAt: true,
    endAt: true,
    order: true,
    title: true,
    linkUrl: true,
  })
  .extend({
    imagePath: z.string().optional(), // File upload will provide this
    useScheduling: z.boolean().default(false), // Controls if scheduling is enabled
    startAt: z.string().optional(),
    endAt: z.string().optional(),
  })
  .refine((data) => {
    // If scheduling is not used, dates are not required
    if (!data.useScheduling) {
      return true;
    }
    
    // If scheduling is used, both dates should be valid or both empty
    const hasStartAt = data.startAt && data.startAt.trim() !== '';
    const hasEndAt = data.endAt && data.endAt.trim() !== '';
    
    // If one date is provided, validate it
    if (hasStartAt) {
      try {
        new Date(data.startAt!).toISOString();
      } catch {
        return false;
      }
    }
    
    if (hasEndAt) {
      try {
        new Date(data.endAt!).toISOString();
      } catch {
        return false;
      }
    }
    
    // If both dates are provided, start should be before end
    if (hasStartAt && hasEndAt) {
      const startDate = new Date(data.startAt!);
      const endDate = new Date(data.endAt!);
      return startDate < endDate;
    }
    
    return true;
  }, {
    message: "Datas inválidas. Se usando agendamento, verifique se as datas são válidas e a data de início é anterior à de fim.",
  });

// Update schema for banner editing (backend)
export const updateBannerSchema = createInsertSchema(banners)
  .pick({
    isEnabled: true,
    startAt: true,
    endAt: true,
    order: true,
    title: true,
    linkUrl: true,
  })
  .extend({
    imagePath: z.string().optional(),
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
    audienceFilters: z.any().optional().nullable(),
  })
  .partial(); // All fields are optional for updates

export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type UpdateBanner = z.infer<typeof updateBannerSchema>;
export type BannerForm = z.infer<typeof bannerFormSchema>;
export type Banner = typeof banners.$inferSelect;

// Pop-up schemas (mirror banner shape; image is 3:4 ratio)
export const insertPopupSchema = createInsertSchema(popups)
  .pick({
    imagePath: true,
    isEnabled: true,
    startAt: true,
    endAt: true,
    order: true,
    title: true,
    linkUrl: true,
  })
  .extend({
    imagePath: z.string().min(1, 'Imagem do pop-up é obrigatória'),
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
    audienceFilters: z.any().optional().nullable(),
  })
  .refine((data) => {
    if (data.startAt && data.endAt) {
      return new Date(data.startAt) < new Date(data.endAt);
    }
    return true;
  }, { message: "Data de início deve ser anterior à data de fim" });

export const updatePopupSchema = createInsertSchema(popups)
  .pick({
    isEnabled: true,
    startAt: true,
    endAt: true,
    order: true,
    title: true,
    linkUrl: true,
  })
  .extend({
    imagePath: z.string().optional(),
    startAt: z.string().datetime().optional().nullable(),
    endAt: z.string().datetime().optional().nullable(),
    audienceFilters: z.any().optional().nullable(),
  })
  .partial();

export type InsertPopup = z.infer<typeof insertPopupSchema>;
export type UpdatePopup = z.infer<typeof updatePopupSchema>;
export type Popup = typeof popups.$inferSelect;

// User Progress Tracking Tables

// Track which lessons each user has completed
export const userLessonProgress = pgTable("user_lesson_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  lessonId: varchar("lesson_id").references(() => lessons.id).notNull(),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  resetVersion: text("reset_version").default("0").notNull(),
  videoProgress: integer("video_progress").default(0), // Progress percentage (0-100)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Track lesson ratings by users (1-5 stars)
export const lessonRatings = pgTable("lesson_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  lessonId: varchar("lesson_id").references(() => lessons.id).notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Track course certificates issued to users
export const userCourseCertificates = pgTable("user_course_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  completionPercentage: integer("completion_percentage").notNull(), // Should be 100 for certificates
  certificateData: jsonb("certificate_data").$type<{
    studentName: string;
    courseName: string;
    completionDate: string;
    workload: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Schemas for user progress tracking
export const insertUserLessonProgressSchema = createInsertSchema(userLessonProgress).pick({
  userId: true,
  lessonId: true,
  completed: true,
  videoProgress: true,
});

export const insertLessonRatingSchema = createInsertSchema(lessonRatings).pick({
  userId: true,
  lessonId: true,
  rating: true,
}).extend({
  rating: z.number().min(1).max(5),
});

export const insertUserCourseCertificateSchema = createInsertSchema(userCourseCertificates).pick({
  userId: true,
  courseId: true,
  completionPercentage: true,
  certificateData: true,
});

export type InsertUserLessonProgress = z.infer<typeof insertUserLessonProgressSchema>;
export type UserLessonProgress = typeof userLessonProgress.$inferSelect;
export type InsertLessonRating = z.infer<typeof insertLessonRatingSchema>;
export type LessonRating = typeof lessonRatings.$inferSelect;
export type InsertUserCourseCertificate = z.infer<typeof insertUserCourseCertificateSchema>;
export type UserCourseCertificate = typeof userCourseCertificates.$inferSelect;

// Certificate Templates for admin configuration
export const certificateTemplates = pgTable("certificate_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  courseId: varchar("course_id").references(() => courses.id).notNull(),
  backgroundImage: text("background_image"), // URL/path to uploaded image
  fields: jsonb("fields").$type<{
    studentName: boolean;
    startDate: boolean;
    completionDate: boolean;
    cpf: boolean;
  }>().notNull(),
  fieldPositions: jsonb("field_positions").$type<{
    studentName: { x: number; y: number };
    startDate?: { x: number; y: number };
    completionDate: { x: number; y: number };
    cpf?: { x: number; y: number };
  }>().notNull(),
  fontFamily: text("font_family").default("Helvetica").notNull(),
  fontSize: integer("font_size").default(14).notNull(),
  fontColor: text("font_color").default("#000000").notNull(),
  studentNameBold: boolean("student_name_bold").default(true).notNull(),
  studentNameUppercase: boolean("student_name_uppercase").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCertificateTemplateSchema = createInsertSchema(certificateTemplates).pick({
  name: true,
  courseId: true,
  backgroundImage: true,
  fields: true,
  fieldPositions: true,
  fontFamily: true,
  fontSize: true,
  fontColor: true,
  studentNameBold: true,
  studentNameUppercase: true,
  isActive: true,
});

export const updateCertificateTemplateSchema = insertCertificateTemplateSchema.partial();

export type InsertCertificateTemplate = z.infer<typeof insertCertificateTemplateSchema>;
export type UpdateCertificateTemplate = z.infer<typeof updateCertificateTemplateSchema>;
export type CertificateTemplate = typeof certificateTemplates.$inferSelect;

// Schema for certificate preview generation
export const certificatePreviewSchema = z.object({
  backgroundImage: z.string().min(1, "Background image is required"),
  fields: z.object({
    studentName: z.boolean(),
    startDate: z.boolean(),
    completionDate: z.boolean(),
    cpf: z.boolean(),
  }),
  fieldPositions: z.object({
    studentName: z.object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    }),
    startDate: z.object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    }).optional(),
    completionDate: z.object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    }),
    cpf: z.object({
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    }).optional(),
  }),
  fontFamily: z.string(),
  fontSize: z.number().min(8).max(72),
  fontColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
  studentNameBold: z.boolean(),
  studentNameUppercase: z.boolean(),
});

export type CertificatePreview = z.infer<typeof certificatePreviewSchema>;

// Library Electronic Tables

// Macro categories for library organization (e.g., "Análise Fatorial")
export const libraryMacroCategories = pgTable("library_macro_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  isFavorited: boolean("is_favorited").default(false).notNull(),
  favoriteOrder: integer("favorite_order"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Micro categories within macro categories (e.g., "Tamanho amostral", "retenção fatorial")
export const libraryMicroCategories = pgTable("library_micro_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  macroCategory: varchar("macro_category_id").references(() => libraryMacroCategories.id).notNull(),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Articles within micro categories - stores full reference text and optional DOI link
export const libraryArticles = pgTable("library_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(), // Full reference text (APA format or any format)
  doi: text("doi"), // DOI identifier (optional)
  doiUrl: text("doi_url"), // Full DOI URL for linking (optional)
  microCategoryId: varchar("micro_category_id").references(() => libraryMicroCategories.id).notNull(),
  order: integer("order").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  addedBy: varchar("added_by").references(() => users.id, { onDelete: "set null" }), // Who added the article
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User favorites for library macro categories (many-to-many relationship)
export const userFavoriteLibraryCategories = pgTable("user_favorite_library_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  macroCategoryId: varchar("macro_category_id").references(() => libraryMacroCategories.id, { onDelete: "cascade" }).notNull(),
  favoriteOrder: integer("favorite_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userMacroCategoryUnique: uniqueIndex("user_favorite_library_categories_user_id_macro_category_id_uniq").on(table.userId, table.macroCategoryId),
}));

// Schemas for library management
export const insertLibraryMacroCategorySchema = createInsertSchema(libraryMacroCategories).pick({
  name: true,
  description: true,
  order: true,
  isActive: true,
  isFavorited: true,
  favoriteOrder: true,
});

export const insertLibraryMicroCategorySchema = createInsertSchema(libraryMicroCategories).pick({
  name: true,
  description: true,
  macroCategory: true,
  order: true,
  isActive: true,
});

export const insertLibraryArticleSchema = createInsertSchema(libraryArticles).pick({
  title: true,
  doi: true,
  doiUrl: true,
  microCategoryId: true,
  order: true,
  isActive: true,
  addedBy: true,
});

export const insertUserFavoriteLibraryCategorySchema = createInsertSchema(userFavoriteLibraryCategories).pick({
  userId: true,
  macroCategoryId: true,
  favoriteOrder: true,
});

// Form schema for article creation (frontend)
export const libraryArticleFormSchema = createInsertSchema(libraryArticles)
  .pick({
    title: true,
    doi: true,
    doiUrl: true,
    microCategoryId: true,
  })
  .extend({
    doiUrl: z.string().url("URL do DOI deve ser válida").optional(),
  });

// Simplified form schema for multiple article insertion with separate fields
export const multipleArticleFormSchema = z.object({
  reference: z.string().min(1, "Referência é obrigatória"),
  url: z.string().url("URL deve ser válida").optional(),
  macroCategory: z.string().min(1, "Categoria é obrigatória"),
  microCategory: z.string().min(1, "Subcategoria é obrigatória"),
});

// Types
export type InsertLibraryMacroCategory = z.infer<typeof insertLibraryMacroCategorySchema>;
export type LibraryMacroCategory = typeof libraryMacroCategories.$inferSelect;

export type InsertLibraryMicroCategory = z.infer<typeof insertLibraryMicroCategorySchema>;
export type LibraryMicroCategory = typeof libraryMicroCategories.$inferSelect;

export type InsertLibraryArticle = z.infer<typeof insertLibraryArticleSchema>;
export type LibraryArticleForm = z.infer<typeof libraryArticleFormSchema>;
export type LibraryArticle = typeof libraryArticles.$inferSelect;

export type InsertUserFavoriteLibraryCategory = z.infer<typeof insertUserFavoriteLibraryCategorySchema>;
export type UserFavoriteLibraryCategory = typeof userFavoriteLibraryCategories.$inferSelect;

// Extended types with relationships
export type LibraryMicroCategoryWithArticles = LibraryMicroCategory & {
  articles: LibraryArticle[];
};

export type LibraryMacroCategoryWithMicros = LibraryMacroCategory & {
  microCategories: LibraryMicroCategoryWithArticles[];
};

// User Activities table for ranking system - tracks all point-earning activities
export const userActivities = pgTable("user_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  activityType: varchar("activity_type").notNull(), // "video_watch" | "lesson_complete" | "module_complete" | "course_complete" | "material_download" | "chat_question"
  relatedId: varchar("related_id"), // lesson_id, module_id, course_id, material_id, chat_message_id
  points: integer("points").notNull(),
  metadata: jsonb("metadata").$type<{
    minutesWatched?: number; // For video_watch
    materialName?: string; // For material_download
    questionContent?: string; // For chat_question
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Rankings table - stores calculated scores and positions  
export const userRankings = pgTable("user_rankings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  totalPoints: integer("total_points").default(0).notNull(),
  rank: integer("rank").default(0).notNull(), // Position in ranking (1st, 2nd, etc.)
  percentile: integer("percentile").default(0).notNull(), // Position as percentile (0-100)
  category: varchar("category").default("Curioso").notNull(), // "Top student" | "Avançado" | "Intermediário" | "Iniciante" | "Curioso"
  lastCalculated: timestamp("last_calculated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserActivitySchema = createInsertSchema(userActivities).pick({
  userId: true,
  activityType: true,
  relatedId: true,
  points: true,
  metadata: true,
});

export const insertUserRankingSchema = createInsertSchema(userRankings).pick({
  userId: true,
  totalPoints: true,
  rank: true,
  percentile: true,
  category: true,
});

export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivities.$inferSelect;
export type InsertUserRanking = z.infer<typeof insertUserRankingSchema>;
export type UserRanking = typeof userRankings.$inferSelect;

// Article Suggestions table - stores user suggestions for new articles
export const articleSuggestions = pgTable("article_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(), // Suggested article title/text
  url: text("url"), // Suggested article URL (optional)
  suggestedBy: varchar("suggested_by").references(() => users.id, { onDelete: "cascade" }).notNull(), // User who made the suggestion
  status: varchar("status").default("pending").notNull(), // "pending" | "reviewed" | "added" | "rejected"
  adminNotes: text("admin_notes"), // Optional notes from admin review
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertArticleSuggestionSchema = createInsertSchema(articleSuggestions).pick({
  title: true,
  url: true,
  suggestedBy: true,
  status: true,
  adminNotes: true,
});

// Form schema for article suggestions (frontend)
export const articleSuggestionFormSchema = z.object({
  articles: z.array(z.object({
    title: z.string().min(1, "Título é obrigatório"),
    url: z.string().url("URL deve ser válida").optional().or(z.literal("")),
  })).min(1, "Pelo menos um artigo deve ser adicionado"),
});

export type InsertArticleSuggestion = z.infer<typeof insertArticleSuggestionSchema>;
export type ArticleSuggestion = typeof articleSuggestions.$inferSelect;
export type ArticleSuggestionForm = z.infer<typeof articleSuggestionFormSchema>;

// Extended user type with ranking info for leaderboard display
export type UserWithRanking = User & {
  ranking: UserRanking;
  activityCount: number;
};

// Library Search Types - for organizing search results hierarchically
export interface LibrarySearchResult {
  article: LibraryArticle;
  microCategory: LibraryMicroCategory;
  macroCategory: LibraryMacroCategory;
  matchedFields: string[]; // Which fields matched the search (title, authors, abstract)
  highlightSnippet?: string; // Snippet with highlighted text
}

export interface LibrarySearchResultsByCategory {
  macroCategory: LibraryMacroCategory;
  microCategories: {
    microCategory: LibraryMicroCategory;
    articles: LibrarySearchResult[];
  }[];
  totalResults: number;
}

export interface LibrarySearchResponse {
  results: LibrarySearchResultsByCategory[];
  totalResults: number;
  query: string;
}

// Schema for search query validation
export const librarySearchSchema = z.object({
  query: z.string().min(1, "Search query is required").max(200, "Search query too long"),
  limit: z.number().min(1).max(100).optional().default(50),
});

// Subscription Tiers - for managing different subscription levels
export const subscriptionTiers = pgTable("subscription_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  label: text("label"), // optional friendly display label for the tier
  accessDays: integer("access_days"), // nullable - duração do acesso em dias (trial gratuito ou plano pago)
  isArchived: boolean("is_archived").default(false).notNull(), // true for discontinued/historical tiers from Memberkit
  isDefaultForPlatformSignup: boolean("is_default_for_platform_signup").default(false).notNull(), // only one tier can be true - auto-assigned to new platform registrations
  expiredResourcesAccess: boolean("expired_resources_access").default(true).notNull(),
  expiredToolsLimitPerDay: jsonb("expired_tools_limit_per_day").$type<Record<string, number | null>>().default({ classifier: 1, effect_size: 1, power_analysis: 1, syntax_generator: 1 }).notNull(),
  expiredLessonMinutesPerDay: integer("expired_lesson_minutes_per_day").default(15),
  memberkitLevelId: integer("memberkit_level_id"), // Maps to Memberkit membership_level_id for migration
  monthlyTokenQuota: integer("monthly_token_quota").default(20000).notNull(), // Token quota per month for this tier
  hotmartUrlMensal: text("hotmart_url_mensal"), // Checkout link for monthly billing on Hotmart
  hotmartUrlAnual: text("hotmart_url_anual"), // Checkout link for annual billing on Hotmart
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Many-to-many relationship between tiers and courses
export const tierCourses = pgTable("tier_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tierId: varchar("tier_id").references(() => subscriptionTiers.id, { onDelete: "cascade" }).notNull(),
  courseId: varchar("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  // Placeholder for future "turmas" functionality
  classId: varchar("class_id"), // Will be used when class system is implemented
});

// Many-to-many relationship between tiers and contents (tools, resources, support)
// Totally independent from tier_courses - contentType is NEVER 'course'
export const tierContents = pgTable("tier_contents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tierId: varchar("tier_id").references(() => subscriptionTiers.id, { onDelete: "cascade" }).notNull(),
  contentType: varchar("content_type").notNull(), // 'tool' | 'resource' | 'support'
  contentKey: varchar("content_key").notNull(),
}, (table) => ({
  uniqueTierContent: unique().on(table.tierId, table.contentType, table.contentKey),
}));

// Override manual do admin para conteúdos individuais de um membro
// Espelha o conceito de course_enrollments para ferramentas/recursos/suporte
export const contentAccessOverrides = pgTable("content_access_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  contentType: varchar("content_type").notNull(), // 'tool' | 'resource' | 'support'
  contentKey: varchar("content_key").notNull(),
  status: varchar("status").default("active").notNull(), // 'active' | 'blocked'
  autoManaged: boolean("auto_managed").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Explicit name matches PostgreSQL's 63-char identifier limit so drizzle
  // doesn't prompt about renaming on each push (the auto-generated name
  // `content_access_overrides_user_id_content_type_content_key_unique` is
  // 64 chars and would be silently truncated by Postgres, causing drift).
  uniqueUserContent: unique("content_access_overrides_user_id_content_type_content_key_uniqu").on(table.userId, table.contentType, table.contentKey),
}));

export const CONTROLLED_CONTENTS = {
  tools: [
    { contentKey: 'classificador', label: 'Classificador de Análise' },
    { contentKey: 'tamanho-efeito', label: 'Tamanho de Efeito' },
    { contentKey: 'poder-amostral', label: 'Calculadora Amostral (Poder)' },
    { contentKey: 'precisao-amostral', label: 'Calculadora Amostral (Precisão)' },
    { contentKey: 'gerador-sintaxe', label: 'Gerador de Sintaxe R' },
  ],
  resources: [
    { contentKey: 'glossario', label: 'Glossário de Termos' },
    { contentKey: 'biblioteca', label: 'Biblioteca Eletrônica' },
    { contentKey: 'livros', label: 'Livros Metodológicos' },
  ],
  support: [
    { contentKey: 'atendimento', label: 'Atendimento' },
  ],
} as const;

export type ContentType = 'tool' | 'resource' | 'support';
export type ContentKey = typeof CONTROLLED_CONTENTS.tools[number]['contentKey']
  | typeof CONTROLLED_CONTENTS.resources[number]['contentKey']
  | typeof CONTROLLED_CONTENTS.support[number]['contentKey'];

export const insertSubscriptionTierSchema = createInsertSchema(subscriptionTiers).pick({
  name: true,
  label: true,
  accessDays: true,
  isDefaultForPlatformSignup: true,
  expiredResourcesAccess: true,
  expiredToolsLimitPerDay: true,
  expiredLessonMinutesPerDay: true,
  monthlyTokenQuota: true,
  hotmartUrlMensal: true,
  hotmartUrlAnual: true,
}).extend({
  name: z.string().min(1, "Nome é obrigatório"),
  label: z.string().min(1).nullable().optional(),
  accessDays: z.number().int().min(0).nullable().optional(),
  isDefaultForPlatformSignup: z.boolean().optional().default(false),
  expiredResourcesAccess: z.boolean().optional().default(true),
  expiredToolsLimitPerDay: z.record(z.string(), z.number().int().min(0).nullable()).optional().default({ classifier: 1, effect_size: 1, power_analysis: 1, syntax_generator: 1 }),
  expiredLessonMinutesPerDay: z.number().int().min(0).nullable().optional().default(15),
  monthlyTokenQuota: z.number().int().min(0).optional().default(20000),
  hotmartUrlMensal: z.string().url("URL inválida").nullable().optional(),
  hotmartUrlAnual: z.string().url("URL inválida").nullable().optional(),
  courseIds: z.array(z.string()).min(0, "Selecione pelo menos um curso").optional(),
  contentKeys: z.array(z.object({
    contentType: z.enum(['tool', 'resource', 'support']),
    contentKey: z.string(),
  })).optional(),
});

export const insertTierCourseSchema = createInsertSchema(tierCourses).pick({
  tierId: true,
  courseId: true,
  classId: true,
});

export const insertTierContentSchema = createInsertSchema(tierContents).pick({
  tierId: true,
  contentType: true,
  contentKey: true,
});

export const insertContentAccessOverrideSchema = createInsertSchema(contentAccessOverrides).pick({
  userId: true,
  contentType: true,
  contentKey: true,
  status: true,
  autoManaged: true,
});

export type InsertSubscriptionTier = z.infer<typeof insertSubscriptionTierSchema>;
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;
export type InsertTierCourse = z.infer<typeof insertTierCourseSchema>;
export type TierCourse = typeof tierCourses.$inferSelect;
export type InsertTierContent = z.infer<typeof insertTierContentSchema>;
export type TierContent = typeof tierContents.$inferSelect;
export type InsertContentAccessOverride = z.infer<typeof insertContentAccessOverrideSchema>;
export type ContentAccessOverride = typeof contentAccessOverrides.$inferSelect;

// Hotmart Webhooks - for managing payment webhooks
export const hotmartWebhooks = pgTable("hotmart_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  hotmartToken: text("hotmart_token").notNull(), // Token from Hotmart for validation
  offerId: text("offer_id"), // Optional - links to specific Hotmart offer
  tierId: varchar("tier_id").references(() => subscriptionTiers.id, { onDelete: "cascade" }).notNull(),
  webhookToken: text("webhook_token").notNull().unique(), // Generated token for webhook URL
  status: text("status").default("active").notNull(), // active | inactive
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Hotmart Transactions - stores all webhook events received
export const hotmartTransactions = pgTable("hotmart_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookId: varchar("webhook_id").references(() => hotmartWebhooks.id, { onDelete: "cascade" }),
  transactionId: text("transaction_id").notNull(), // Hotmart transaction ID
  event: text("event"), // PURCHASE_APPROVED, PURCHASE_COMPLETE, etc. (null for old/migrated records)
  offerId: text("offer_id"), // Hotmart offer ID for deduplication (null for old/migrated records)
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  productName: text("product_name").notNull(),
  status: text("status").notNull(), // atrasada | ativada | iniciada | completa | cancelada | reembolsada | reclamada | expirada | renovacao_cancelada
  rawPayload: jsonb("raw_payload").notNull(), // Complete JSON from Hotmart
  providerEventId: text("provider_event_id"), // Hotmart event id when the source is a webhook/synthetic reconciliation fact
  evidenceSource: text("evidence_source"), // webhook | sales_history | subscription | recurring_purchase
  evidenceAt: timestamp("evidence_at"), // Authoritative occurrence/snapshot timestamp used for ordering
  remoteStatus: text("remote_status"), // Normalized Hotmart purchase/subscription state observed at ingestion
  subscriptionCode: text("subscription_code"), // Stable Hotmart subscriber code when available
  effectStatus: text("effect_status").default("pending").notNull(), // pending | processing | completed | failed | review | blocked
  effectAttempts: integer("effect_attempts").default(0).notNull(),
  effectError: text("effect_error"), // Sanitized operational summary; never credentials or buyer data
  effectUpdatedAt: timestamp("effect_updated_at"),
  processedAt: timestamp("processed_at"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // User created/updated by this transaction (for migration tracking)
  migrationAction: text("migration_action"), // created | updated | skipped (null for webhook transactions)
  migrationSource: text("migration_source"), // webhook | sales_history | memberkit (null for old webhook transactions)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  transactionIdEventUnique: uniqueIndex("hotmart_transactions_transaction_id_event_unique").on(
    table.transactionId,
    table.event,
  ),
  reconciliationEvidenceIdx: index("hotmart_transactions_reconciliation_evidence_idx").on(
    table.clientEmail,
    table.webhookId,
    table.evidenceAt.desc(),
  ),
}));

export const insertHotmartWebhookSchema = createInsertSchema(hotmartWebhooks).pick({
  name: true,
  hotmartToken: true,
  offerId: true,
  tierId: true,
}).extend({
  name: z.string().min(1, "Nome é obrigatório"),
  hotmartToken: z.string().min(1, "Token Hotmart é obrigatório"),
  offerId: z.string().optional(),
  tierId: z.string().min(1, "Selecione um nível de assinatura"),
});

export const insertHotmartTransactionSchema = createInsertSchema(hotmartTransactions).pick({
  webhookId: true,
  transactionId: true,
  event: true,
  offerId: true,
  clientName: true,
  clientEmail: true,
  productName: true,
  status: true,
  rawPayload: true,
  providerEventId: true,
  evidenceSource: true,
  evidenceAt: true,
  remoteStatus: true,
  subscriptionCode: true,
  effectStatus: true,
  effectAttempts: true,
  effectError: true,
  effectUpdatedAt: true,
});

export type InsertHotmartWebhook = z.infer<typeof insertHotmartWebhookSchema>;
export type HotmartWebhook = typeof hotmartWebhooks.$inferSelect;
export type InsertHotmartTransaction = z.infer<typeof insertHotmartTransactionSchema>;
export type HotmartTransaction = typeof hotmartTransactions.$inferSelect;

// User Subscriptions - relates users to subscription tiers
export const userSubscriptions = pgTable("user_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tierId: varchar("tier_id").references(() => subscriptionTiers.id, { onDelete: "cascade" }).notNull(),
  startDate: timestamp("start_date"), // nullable - can be blank if not provided in CSV import
  endDate: timestamp("end_date"), // nullable - if null, subscription doesn't expire (lifetime access determined by tier's accessDays)
  nextChargeDate: timestamp("next_charge_date"), // subscription_date_next_charge from Hotmart - used as expirationDate for enrollments
  status: varchar("status").default("active").notNull(), // active | expired | cancelled | delayed
  transactionId: varchar("transaction_id").references(() => hotmartTransactions.id, { onDelete: "cascade" }), // Link to Hotmart transaction
  willNotRenew: boolean("will_not_renew").default(false).notNull(), // true when user cancels renewal but keeps access until endDate
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).pick({
  userId: true,
  tierId: true,
  startDate: true,
  endDate: true,
  nextChargeDate: true,
  status: true,
  transactionId: true,
  willNotRenew: true,
});

export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptions.$inferSelect;

// Course enrollments - individual course access for users
export const courseEnrollments = pgTable("course_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  courseId: varchar("course_id").references(() => courses.id, { onDelete: "cascade" }).notNull(),
  status: varchar("status").default("active").notNull(), // active | cancelled | pending | expired
  expirationDate: timestamp("expiration_date"),
  accessMode: varchar("access_mode").default("tier").notNull(), // tier | manual
  autoManaged: boolean("auto_managed").default(true).notNull(), // If true, tier controls this enrollment; if false, manual override
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCourseEnrollmentSchema = createInsertSchema(courseEnrollments).pick({
  userId: true,
  courseId: true,
  status: true,
  expirationDate: true,
  accessMode: true,
  autoManaged: true,
});

export type InsertCourseEnrollment = z.infer<typeof insertCourseEnrollmentSchema>;
export type CourseEnrollment = typeof courseEnrollments.$inferSelect;

// AI Agents Categories - categorização de agentes de IA
export const agentCategories = pgTable("agent_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Agents - assistentes de IA usando OpenAI Assistants API
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  openaiAssistantId: text("openai_assistant_id"), // ID do assistant no OpenAI
  model: text("model").default("gpt-4o").notNull(),
  instructions: text("instructions").notNull(),
  tools: jsonb("tools").default([]).notNull(), // Array de tools: ['code_interpreter', 'file_search']
  temperature: text("temperature").default("1.0"),
  topP: text("top_p").default("1.0"),
  categoryId: integer("category_id").references(() => agentCategories.id, { onDelete: "set null" }),
  status: varchar("status").default("active").notNull(), // active | inactive
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Conversations - conversas dos usuários com agentes
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "cascade" }).notNull(),
  // Deprecated OpenAI Assistants thread ID. Kept for historical rows only.
  threadId: text("thread_id"),
  // OpenAI Responses API state. A null value means the conversation is
  // migrated lazily from the locally persisted transcript on its next turn.
  lastResponseId: text("last_response_id"),
  summary: text("summary"),
  chainStartIndex: integer("chain_start_index").default(0).notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messages - mensagens das conversas
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: varchar("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Recommendations - recomendações salvas pelos usuários
export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  type: varchar("type").default("general").notNull(), // 'statistical' | 'general'
  metadata: jsonb("metadata"), // Dados extras como research_id, etc
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertAgentCategorySchema = createInsertSchema(agentCategories).omit({ 
  createdAt: true 
});

export const insertAgentSchema = createInsertSchema(agents).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const updateAgentSchema = createInsertSchema(agents).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).partial();

export const insertConversationSchema = createInsertSchema(conversations).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertMessageSchema = createInsertSchema(messages).omit({ 
  createdAt: true 
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({ 
  id: true, 
  createdAt: true 
});

// Types
export type AgentCategory = typeof agentCategories.$inferSelect;
export type InsertAgentCategory = z.infer<typeof insertAgentCategorySchema>;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type UpdateAgent = z.infer<typeof updateAgentSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;

// Vimeo integration tables
export const vimeoConfig = pgTable("vimeo_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessToken: text("access_token").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vimeoImports = pgTable("vimeo_imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseId: varchar("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
  vimeoProjectId: text("vimeo_project_id").notNull(),
  vimeoProjectName: text("vimeo_project_name").notNull(),
  lessonsImported: integer("lessons_imported").default(0).notNull(),
  status: varchar("status").default("pending").notNull(), // "pending" | "processing" | "completed" | "failed"
  errorMessage: text("error_message"),
  importedBy: varchar("imported_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVimeoConfigSchema = createInsertSchema(vimeoConfig).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertVimeoImportSchema = createInsertSchema(vimeoImports).omit({ 
  id: true, 
  createdAt: true 
});

export type VimeoConfig = typeof vimeoConfig.$inferSelect;
export type InsertVimeoConfig = z.infer<typeof insertVimeoConfigSchema>;
export type VimeoImport = typeof vimeoImports.$inferSelect;
export type InsertVimeoImport = z.infer<typeof insertVimeoImportSchema>;

// Power Analysis Calculations (for statistical power analysis tools)
export const powerAnalysisCalculations = pgTable("power_analysis_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  testType: varchar("test_type").notNull(), // "t-test-one-sample", "t-test-dependent", "t-test-independent", etc.
  testFamily: varchar("test_family").notNull(), // "t-tests", "anova", "correlation", etc.
  
  // Input parameters (stored as JSON for flexibility)
  inputParameters: jsonb("input_parameters").notNull(),
  
  // Results
  calculatedPower: text("calculated_power"), // Statistical power (0-1)
  requiredSampleSize: integer("required_sample_size"), // Required N
  effectSize: text("effect_size"), // Cohen's d, r, etc.
  alpha: text("alpha"), // Significance level
  
  // Optional: calculation notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPowerAnalysisCalculationSchema = createInsertSchema(powerAnalysisCalculations).omit({
  id: true,
  createdAt: true,
});

export type PowerAnalysisCalculation = typeof powerAnalysisCalculations.$inferSelect;
export type InsertPowerAnalysisCalculation = z.infer<typeof insertPowerAnalysisCalculationSchema>;

// Sample Size by Precision Calculations (Cochran / Lwanga & Lemeshow)
export const sampleSizePrecisionCalculations = pgTable("sample_size_precision_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  procedureType: varchar("procedure_type").notNull(), // e.g. 'prevalence-cochran'
  inputParameters: jsonb("input_parameters").notNull(),
  n0: integer("n0").notNull(),
  nFinite: integer("n_finite"),
  nAdjusted: integer("n_adjusted"),
  zUsed: text("z_used").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  // Task #473: índice criado pela migration ensure-sample-size-precision-table.ts
  // declarado aqui para sobreviver ao `drizzle-kit push --force` do post-merge.
  userCreatedIdx: index("idx_sample_size_precision_user_created").on(table.userId, table.createdAt.desc()),
}));

export const insertSampleSizePrecisionCalculationSchema = createInsertSchema(sampleSizePrecisionCalculations).omit({
  id: true,
  createdAt: true,
});

export type SampleSizePrecisionCalculation = typeof sampleSizePrecisionCalculations.$inferSelect;
export type InsertSampleSizePrecisionCalculation = z.infer<typeof insertSampleSizePrecisionCalculationSchema>;

// Effect Size Calculations (for effect size calculator tools)
export const effectSizeCalculations = pgTable("effect_size_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  calculatorType: varchar("calculator_type").notNull(), // "cohens-d", "hedges-g", "glass-delta", "eta-squared", etc.
  calculationMethod: varchar("calculation_method"), // Specific method used within the calculator
  
  // Input parameters (stored as JSON for flexibility)
  inputParameters: jsonb("input_parameters").notNull(),
  
  // Results
  effectSizeValue: text("effect_size_value").notNull(), // The calculated effect size
  effectSizeInterpretation: varchar("effect_size_interpretation"), // "small", "medium", "large", etc.
  confidenceInterval: jsonb("confidence_interval"), // { lower: number, upper: number }
  
  // Additional result metadata
  resultDetails: jsonb("result_details"), // Any additional calculation details
  
  // Optional: calculation notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEffectSizeCalculationSchema = createInsertSchema(effectSizeCalculations).omit({
  id: true,
  createdAt: true,
});

export type EffectSizeCalculation = typeof effectSizeCalculations.$inferSelect;
export type InsertEffectSizeCalculation = z.infer<typeof insertEffectSizeCalculationSchema>;

// Product Tabs (Vitrines) - admin-configurable product tabs
export const productTabs = pgTable("product_tabs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(), // Display name (e.g., "Psicometria Online Academy")
  slug: varchar("slug").notNull().unique(), // Unique identifier (e.g., "psicometria")
  icon: varchar("icon").notNull(), // Lucide icon name (e.g., "GraduationCap")
  order: integer("order").notNull().default(0), // For ordering tabs
  videoUrl: text("video_url"), // YouTube tutorial URL for "Primeiros Passos" panel
  description: text("description"), // Optional description shown in the "Primeiros Passos" course card
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductTabSchema = createInsertSchema(productTabs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const updateProductTabSchema = createInsertSchema(productTabs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).partial();

export type ProductTab = typeof productTabs.$inferSelect;
export type InsertProductTab = z.infer<typeof insertProductTabSchema>;
export type UpdateProductTab = z.infer<typeof updateProductTabSchema>;

// ============================================
// GLOSSARY SYSTEM
// ============================================

// Glossary Categories
export const glossaryCategories = pgTable("glossary_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGlossaryCategorySchema = createInsertSchema(glossaryCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateGlossaryCategorySchema = createInsertSchema(glossaryCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type GlossaryCategory = typeof glossaryCategories.$inferSelect;
export type InsertGlossaryCategory = z.infer<typeof insertGlossaryCategorySchema>;
export type UpdateGlossaryCategory = z.infer<typeof updateGlossaryCategorySchema>;

// Glossary Terms
export const glossaryTerms = pgTable("glossary_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  categoryId: varchar("category_id").references(() => glossaryCategories.id, { onDelete: "set null" }),
  
  // Additional rich content fields
  pressupostos: text("pressupostos"),       // Statistical assumptions
  exemploUso: text("exemplo_uso"),          // Practical usage example
  resultado: text("resultado"),              // How to interpret results
  interpretacao: text("interpretacao"),      // Detailed interpretation
  referencias: text("referencias"),          // Bibliographic references
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGlossaryTermSchema = createInsertSchema(glossaryTerms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Nome é obrigatório"),
  slug: z.string().min(1, "Slug é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  categoryId: z.string().optional(),
  pressupostos: z.string().optional(),
  exemploUso: z.string().optional(),
  resultado: z.string().optional(),
  interpretacao: z.string().optional(),
  referencias: z.string().optional(),
});

export const updateGlossaryTermSchema = createInsertSchema(glossaryTerms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type GlossaryTerm = typeof glossaryTerms.$inferSelect;
export type InsertGlossaryTerm = z.infer<typeof insertGlossaryTermSchema>;
export type UpdateGlossaryTerm = z.infer<typeof updateGlossaryTermSchema>;

// Glossary Term Suggestions - User submitted term suggestions
export const glossaryTermSuggestions = pgTable("glossary_term_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  categoryId: varchar("category_id").references(() => glossaryCategories.id, { onDelete: "set null" }),
  status: varchar("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGlossaryTermSuggestionSchema = createInsertSchema(glossaryTermSuggestions).omit({
  id: true,
  createdAt: true,
  status: true,
  adminNotes: true,
}).extend({
  name: z.string().min(1, "Nome do termo é obrigatório"),
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres"),
  categoryId: z.string().optional(),
});

export type GlossaryTermSuggestion = typeof glossaryTermSuggestions.$inferSelect;
export type InsertGlossaryTermSuggestion = z.infer<typeof insertGlossaryTermSuggestionSchema>;

// OpenAI Configuration - armazena as credenciais e configurações do OpenAI
export const activecampaignConfig = pgTable("activecampaign_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiUrl: text("api_url"),
  apiKey: text("api_key"),
  listId: text("list_id"),
  registrationTags: text("registration_tags").default('Free-trial'),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertActiveCampaignConfigSchema = createInsertSchema(activecampaignConfig).omit({
  id: true,
  updatedAt: true,
});

export type ActiveCampaignConfig = typeof activecampaignConfig.$inferSelect;
export type InsertActiveCampaignConfig = z.infer<typeof insertActiveCampaignConfigSchema>;

// Tabela legada mantida temporariamente apenas para a limpeza idempotente das
// credenciais antigas. Nenhum resolvedor ou endpoint pode ler desta tabela.
export const openaiConfig = pgTable("openai_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKey: text("api_key").notNull(),
  statisticalClassifierAssistantId: text("statistical_classifier_assistant_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clarityConfig = pgTable("clarity_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: text("project_id"),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertClarityConfigSchema = createInsertSchema(clarityConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ClarityConfig = typeof clarityConfig.$inferSelect;
export type InsertClarityConfig = z.infer<typeof insertClarityConfigSchema>;

// AI Model Configuration - configurações dos modelos de IA para diferentes features
export const aiModelConfig = pgTable("ai_model_config", {
  id: serial("id").primaryKey(),
  feature: text("feature").notNull().unique(), // 'comment_assistance' | 'chatgpt' | 'statistical_classifier'
  model: text("model").notNull(), // 'gpt-4o', 'gpt-4', 'gpt-3.5-turbo', etc
  systemPrompt: text("system_prompt").notNull(),
  systemPromptWithDataset: text("system_prompt_with_dataset"), // Specific prompt for syntax generator with dataset
  temperature: text("temperature").notNull().default("0.7"), // 0.0 - 2.0, stored as string
  topP: text("top_p").notNull().default("1.0"), // 0.0 - 1.0, stored as string
  maxTokens: integer("max_tokens").notNull().default(1000),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAIModelConfigSchema = createInsertSchema(aiModelConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  feature: z.enum(['comment_assistance', 'chatgpt', 'statistical_classifier', 'syntax_generator']),
  model: z.string().min(1, "Modelo é obrigatório"),
  systemPrompt: z.string().min(1, "Prompt do sistema é obrigatório"),
  systemPromptWithDataset: z.string().optional(),
  temperature: z.string().regex(/^[0-2](\.\d{1,2})?$/, "Temperatura deve estar entre 0.0 e 2.0"),
  topP: z.string().regex(/^[0-1](\.\d{1,2})?$/, "Top P deve estar entre 0.0 e 1.0"),
  maxTokens: z.number().int().min(1).max(16000, "Max tokens deve estar entre 1 e 16000"),
  enabled: z.boolean().default(true),
});

export const updateAIModelConfigSchema = createInsertSchema(aiModelConfig).omit({
  id: true,
  feature: true, // Can't change feature once created
  createdAt: true,
  updatedAt: true,
}).extend({
  model: z.string().min(1, "Modelo é obrigatório"),
  systemPrompt: z.string().min(1, "Prompt do sistema é obrigatório"),
  systemPromptWithDataset: z.string().optional(),
  temperature: z.string().regex(/^[0-2](\.\d{1,2})?$/, "Temperatura deve estar entre 0.0 e 2.0"),
  topP: z.string().regex(/^[0-1](\.\d{1,2})?$/, "Top P deve estar entre 0.0 e 1.0"),
  maxTokens: z.number().int().min(1).max(16000, "Max tokens deve estar entre 1 e 16000"),
  enabled: z.boolean(),
});

export type AIModelConfig = typeof aiModelConfig.$inferSelect;
export type InsertAIModelConfig = z.infer<typeof insertAIModelConfigSchema>;
export type UpdateAIModelConfig = z.infer<typeof updateAIModelConfigSchema>;

// ============================================
// GLOBAL SEARCH SYSTEM
// ============================================

// Search result types for different categories
export interface SearchResultBase {
  id: string;
  title: string;
  snippet: string;
  url: string;
  category: string;
}

export interface CourseSearchResult extends SearchResultBase {
  category: 'Cursos';
  coverImage?: string;
  categoryName?: string;
}

export interface LessonSearchResult extends SearchResultBase {
  category: 'Aulas';
  courseTitle?: string;
  moduleTitle?: string;
  duration?: number;
}

export interface TranscriptSearchResult extends SearchResultBase {
  category: 'Transcrições';
  courseTitle?: string;
  lessonTitle?: string;
  timestamp?: number; // seconds
  formattedTime?: string; // "mm:ss"
}

export interface LibraryGlobalSearchResult extends SearchResultBase {
  category: 'Biblioteca';
  authors?: string;
  year?: number;
  macroCategory?: string;
}

export interface GlossarySearchResult extends SearchResultBase {
  category: 'Glossário';
  categoryName?: string;
}

export interface CommentSearchResult extends SearchResultBase {
  category: 'Comentários';
  authorName?: string;
  courseTitle?: string;
  lessonTitle?: string;
  createdAt?: Date;
}

export type SearchResult =
  | CourseSearchResult
  | LessonSearchResult
  | TranscriptSearchResult
  | LibraryGlobalSearchResult
  | GlossarySearchResult
  | CommentSearchResult;

export interface SearchResultsCategory {
  category: string;
  count: number;
  results: SearchResult[];
}

export interface GlobalSearchResponse {
  query: string;
  totalResults: number;
  categories: SearchResultsCategory[];
}

// Feature Flags table
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // Unique identifier like "biblioteca-eletronica", "ferramentas-estatisticas"
  name: text("name").notNull(), // Display name like "Biblioteca Eletrônica"
  description: text("description"), // Optional description
  enabled: boolean("enabled").default(false).notNull(), // Whether feature is enabled
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  updatedAt: true,
});

export const updateFeatureFlagSchema = createInsertSchema(featureFlags).pick({
  enabled: true,
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type UpdateFeatureFlag = z.infer<typeof updateFeatureFlagSchema>;

// Onboarding Popup Tools - controla quais ferramentas aparecem no popup de boas-vindas (independente das feature flags globais)
export const onboardingPopupTools = pgTable("onboarding_popup_tools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toolKey: text("tool_key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  icon: text("icon"),
  enabled: boolean("enabled").default(true).notNull(),
  order: integer("order").default(0).notNull(),
  videoUrl: text("video_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOnboardingPopupToolSchema = createInsertSchema(onboardingPopupTools).omit({
  id: true,
  updatedAt: true,
});

const youTubeUrlPattern = /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{6,}/;

export const updateOnboardingPopupToolSchema = createInsertSchema(onboardingPopupTools)
  .pick({ enabled: true, order: true, label: true, description: true, videoUrl: true })
  .partial()
  .extend({
    videoUrl: z
      .string()
      .url()
      .regex(youTubeUrlPattern, 'URL deve ser do YouTube (watch?v=, youtu.be/ ou embed/)')
      .nullable()
      .optional(),
  });

export const reorderOnboardingPopupToolsSchema = z.object({
  items: z.array(z.object({ id: z.string(), order: z.number().int() })),
});

export type OnboardingPopupTool = typeof onboardingPopupTools.$inferSelect;
export type InsertOnboardingPopupTool = z.infer<typeof insertOnboardingPopupToolSchema>;
export type UpdateOnboardingPopupTool = z.infer<typeof updateOnboardingPopupToolSchema>;

// Onboarding popup courses (admin-managed list shown under the "Cursos" tab)
export const onboardingPopupCourses = pgTable("onboarding_popup_courses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  courseKey: text("course_key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  hrefMode: text("href_mode").notNull().default('vitrine'),
  vitrineSlug: text("vitrine_slug"),
  hrefUrl: text("href_url"),
  categoryId: varchar("category_id").references(() => categories.id, { onDelete: 'set null' }),
  enabled: boolean("enabled").default(true).notNull(),
  order: integer("order").default(0).notNull(),
  videoUrl: text("video_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const popupCourseYouTubeUrlPattern = /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{6,}/;

// Aceita: URL absoluta http(s) ou caminho interno começando com "/"
export function isValidPopupCourseHrefUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  // Reject protocol-relative paths like "//evil.com" — they look like
  // internal paths but actually navigate cross-origin.
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('/')) return true;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      // eslint-disable-next-line no-new
      new URL(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

const baseOnboardingPopupCourseSchema = createInsertSchema(onboardingPopupCourses).omit({
  id: true,
  updatedAt: true,
});

function refinePopupCourseLink(
  data: {
    hrefMode?: 'vitrine' | 'url' | 'category';
    vitrineSlug?: string | null;
    hrefUrl?: string | null;
    categoryId?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.hrefMode === 'vitrine') {
    if (!data.vitrineSlug || data.vitrineSlug.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vitrineSlug'],
        message: 'Selecione uma vitrine',
      });
    }
  } else if (data.hrefMode === 'url') {
    const raw = data.hrefUrl ?? '';
    if (raw.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hrefUrl'],
        message: 'Informe uma URL',
      });
    } else if (!isValidPopupCourseHrefUrl(raw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hrefUrl'],
        message: 'Use uma URL absoluta (http/https) ou um caminho interno começando com "/"',
      });
    }
  } else if (data.hrefMode === 'category') {
    if (!data.categoryId || data.categoryId.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryId'],
        message: 'Selecione uma categoria',
      });
    }
  }
}

export const insertOnboardingPopupCourseSchema = baseOnboardingPopupCourseSchema
  .extend({
    courseKey: z.string().min(1, 'Identificador é obrigatório').regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífens'),
    label: z.string().min(1, 'Título é obrigatório'),
    hrefMode: z.enum(['vitrine', 'url', 'category']),
    vitrineSlug: z.string().nullable().optional(),
    hrefUrl: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    videoUrl: z
      .string()
      .url()
      .regex(popupCourseYouTubeUrlPattern, 'URL deve ser do YouTube (watch?v=, youtu.be/ ou embed/)')
      .nullable()
      .optional(),
  })
  .superRefine(refinePopupCourseLink);

export const updateOnboardingPopupCourseSchema = baseOnboardingPopupCourseSchema
  .pick({
    label: true,
    description: true,
    enabled: true,
    order: true,
    videoUrl: true,
    hrefMode: true,
    vitrineSlug: true,
    hrefUrl: true,
    categoryId: true,
  })
  .partial()
  .extend({
    hrefMode: z.enum(['vitrine', 'url', 'category']).optional(),
    vitrineSlug: z.string().nullable().optional(),
    hrefUrl: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    videoUrl: z
      .string()
      .url()
      .regex(popupCourseYouTubeUrlPattern, 'URL deve ser do YouTube (watch?v=, youtu.be/ ou embed/)')
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Em PATCH, qualquer alteração nos campos de link exige consistência:
    // - se enviar hrefUrl/vitrineSlug/categoryId, deve declarar o hrefMode correspondente;
    // - hrefUrl, mesmo quando enviado sozinho, é validado contra o formato
    //   permitido (http(s) absoluto ou caminho interno começando com "/").
    const linkFieldProvided =
      data.hrefMode !== undefined ||
      data.vitrineSlug !== undefined ||
      data.hrefUrl !== undefined ||
      data.categoryId !== undefined;

    if (!linkFieldProvided) return;

    if (data.hrefMode === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hrefMode'],
        message: 'Para alterar vitrineSlug, hrefUrl ou categoryId, informe também o hrefMode correspondente',
      });
      return;
    }

    refinePopupCourseLink(data, ctx);
  });

export const reorderOnboardingPopupCoursesSchema = z
  .object({
    items: z.array(
      z.object({
        id: z.string().min(1, 'ID obrigatório'),
        order: z.number().int().min(0, 'Order deve ser >= 0'),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    const ids = new Set<string>();
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (ids.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', i, 'id'],
          message: 'IDs duplicados na reordenação',
        });
      }
      ids.add(item.id);
    }
  });

export type OnboardingPopupCourse = typeof onboardingPopupCourses.$inferSelect;
export type InsertOnboardingPopupCourse = z.infer<typeof insertOnboardingPopupCourseSchema>;
export type UpdateOnboardingPopupCourse = z.infer<typeof updateOnboardingPopupCourseSchema>;

/**
 * Public API contract for GET /api/onboarding-popup-courses.
 *
 * The endpoint returns each course augmented with a server-resolved
 * `resolvedHref` field that already accounts for:
 *  - hrefMode === 'url' → uses `hrefUrl` directly when non-empty
 *  - hrefMode === 'vitrine' → builds `/?tab={vitrineSlug}#cursos` ONLY when
 *    the slug still matches an existing vitrine (product_tab)
 *  - hrefMode === 'category' → builds `/?tab={parentVitrine}#category-{id}`
 *    ONLY when the category still exists and its parent vitrine is valid
 *
 * When the destination cannot be resolved (stale slug, deleted category,
 * empty url, etc.), `resolvedHref` is omitted entirely. Frontend consumers
 * should treat a missing `resolvedHref` as "no CTA" and hide/disable the
 * "Ir para curso" button instead of falling back to a generic anchor.
 */
export type OnboardingPopupCoursePublic = OnboardingPopupCourse & {
  resolvedHref?: string;
};

// Vimeo Videos Cache table
export const vimeoVideos = pgTable("vimeo_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vimeoId: text("vimeo_id").notNull().unique(), // Vimeo's video ID (e.g., "123456789")
  name: text("name").notNull(),
  description: text("description"),
  duration: integer("duration"), // Duration in seconds
  thumbnailUrl: text("thumbnail_url"),
  link: text("link"), // Direct link to video on Vimeo
  embedUrl: text("embed_url"), // Embed URL for player
  createdTime: timestamp("created_time"), // When video was created on Vimeo
  modifiedTime: timestamp("modified_time"), // When video was last modified on Vimeo
  status: text("status"), // "available", "uploading", "transcoding", etc.
  viewCount: integer("view_count"), // Total plays from Vimeo stats.plays (cached at sync)
  isDeleted: boolean("is_deleted").default(false).notNull(), // Soft delete for videos removed from Vimeo
  rawMetadata: jsonb("raw_metadata"), // Store full Vimeo response for future use
  cachedAt: timestamp("cached_at").defaultNow().notNull(), // When we cached this video
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // Last update in our DB
}, (table) => ({
  // NOTE: Using regular index (not uniqueIndex) to match production database
  // This prevents Drizzle from generating DROP/CREATE migrations on every deploy
  statusCreatedIdx: index("vimeo_videos_status_created_idx").on(table.status, table.createdTime.desc()),
}));

export const insertVimeoVideoSchema = createInsertSchema(vimeoVideos).omit({
  id: true,
  cachedAt: true,
  updatedAt: true,
});

export type VimeoVideo = typeof vimeoVideos.$inferSelect;
export type InsertVimeoVideo = z.infer<typeof insertVimeoVideoSchema>;

// Vimeo Sync State table (singleton for tracking last sync)
export const vimeoSyncState = pgTable("vimeo_sync_state", {
  id: varchar("id").primaryKey().default("singleton"), // Always "singleton" - only one row
  lastSyncedAt: timestamp("last_synced_at"), // Last successful sync timestamp
  lastModifiedSeen: timestamp("last_modified_seen"), // Latest modified_time we've seen
  totalVideos: integer("total_videos").default(0).notNull(), // Total videos cached
  lastSyncStatus: text("last_sync_status"), // "success", "partial", "failed"
  lastSyncError: text("last_sync_error"), // Error message if failed
  videosAdded: integer("videos_added").default(0), // Videos added in last sync
  videosUpdated: integer("videos_updated").default(0), // Videos updated in last sync
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type VimeoSyncState = typeof vimeoSyncState.$inferSelect;

// ============================================
// Feature Request / Voting System
// ============================================

// Feature Requests table
export const featureRequests = pgTable("feature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  authorId: varchar("author_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: varchar("status").default("under_review").notNull(), // "under_review" | "planned" | "in_progress" | "completed"
  category: text("category"), // Optional category/tag
  targetDate: timestamp("target_date"), // Expected delivery date (optional)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFeatureRequestSchema = createInsertSchema(featureRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateFeatureRequestSchema = createInsertSchema(featureRequests).pick({
  title: true,
  description: true,
  status: true,
  category: true,
  targetDate: true,
}).extend({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["under_review", "planned", "in_progress", "completed"]).optional(),
  category: z.string().nullable().optional(),
  targetDate: z.preprocess(
    (val) => (val === "" || val === null ? null : val),
    z.coerce.date().nullable().optional()
  ),
});

export type FeatureRequest = typeof featureRequests.$inferSelect;
export type InsertFeatureRequest = z.infer<typeof insertFeatureRequestSchema>;
export type UpdateFeatureRequest = z.infer<typeof updateFeatureRequestSchema>;

// Feature Votes table (one vote per user per feature)
export const featureVotes = pgTable("feature_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  featureId: varchar("feature_id").references(() => featureRequests.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueVote: uniqueIndex("feature_votes_unique_idx").on(table.featureId, table.userId),
}));

export type FeatureVote = typeof featureVotes.$inferSelect;

// Feature Comments table
export const featureComments = pgTable("feature_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  featureId: varchar("feature_id").references(() => featureRequests.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  parentId: varchar("parent_id"), // Reference to parent comment for replies (null = top-level comment)
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeatureCommentSchema = createInsertSchema(featureComments).omit({
  id: true,
  createdAt: true,
}).extend({
  parentId: z.string().nullable().optional(),
});

export type FeatureComment = typeof featureComments.$inferSelect;
export type InsertFeatureComment = z.infer<typeof insertFeatureCommentSchema>;

// Feature Comment Votes table (upvote/downvote per comment)
export const featureCommentVotes = pgTable("feature_comment_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").references(() => featureComments.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  voteType: varchar("vote_type").notNull(), // "up" or "down"
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueCommentVote: uniqueIndex("feature_comment_votes_unique_idx").on(table.commentId, table.userId),
}));

export type FeatureCommentVote = typeof featureCommentVotes.$inferSelect;

// Extended types with relations
export interface FeatureRequestWithDetails extends FeatureRequest {
  author: Pick<User, 'id' | 'fullName' | 'avatarPath'>;
  voteCount: number;
  commentCount: number;
  hasVoted?: boolean; // For current user
}

export interface FeatureCommentWithAuthor extends FeatureComment {
  author: Pick<User, 'id' | 'fullName' | 'avatarPath'>;
  upvotes: number;
  downvotes: number;
  voteScore: number;
  userVote: 'upvote' | 'downvote' | null;
  replies?: FeatureCommentWithAuthor[]; // Nested replies for two-level structure
}

export interface TopContributor {
  userId: string;
  fullName: string | null;
  avatarPath: string | null;
  totalContributions: number; // votes + comments + requests
}

// ===================== TOKEN SYSTEM =====================

// User tokens table - tracks token balance and renewal
export const userTokens = pgTable("user_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  balance: integer("balance").default(0).notNull(), // Total balance = plan_balance + extras_balance (kept for compatibility)
  planBalance: integer("plan_balance").default(0).notNull(), // Tokens from active plan (reset monthly)
  extrasBalance: integer("extras_balance").default(0).notNull(), // Purchased extra tokens (accumulate, 60-day expiry)
  lastRenewalAt: timestamp("last_renewal_at").defaultNow().notNull(), // Last renewal timestamp
  tokenRenewalAnchorDate: timestamp("token_renewal_anchor_date"), // Fixed anchor for 30-day cycle (subscription start date)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserTokensSchema = createInsertSchema(userTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserTokens = typeof userTokens.$inferSelect;
export type InsertUserTokens = z.infer<typeof insertUserTokensSchema>;

// Token purchases table - tracks purchased token packages
export const tokenPurchases = pgTable("token_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  amount: integer("amount").notNull(), // Amount of tokens purchased
  price: integer("price").notNull(), // Price in cents (e.g., 2990 = R$29.90)
  status: varchar("status").default("pending").notNull(), // pending | completed | cancelled | refunded
  hotmartTransactionId: varchar("hotmart_transaction_id"), // Hotmart transaction reference
  metadata: jsonb("metadata").$type<Record<string, any>>(), // Extra data from payment gateway
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"), // purchased_at + 60 days, set when purchase is completed
  isExpired: boolean("is_expired").default(false).notNull(), // Flag to mark tokens as expired
});

export const insertTokenPurchaseSchema = createInsertSchema(tokenPurchases).omit({
  id: true,
  purchasedAt: true,
  completedAt: true,
});

export type TokenPurchase = typeof tokenPurchases.$inferSelect;
export type InsertTokenPurchase = z.infer<typeof insertTokenPurchaseSchema>;

// Token usage log - tracks how tokens are spent
export const tokenUsageLog = pgTable("token_usage_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  toolType: varchar("tool_type").notNull(), // 'chatbot' | 'classifier' | 'admin_adjustment' | 'monthly_renewal' | 'webhook_renewal'
  tokensUsed: integer("tokens_used").notNull(), // Positive for additions, negative for deductions
  balanceAfter: integer("balance_after"), // Balance after this transaction
  description: text("description"), // Brief description of usage
  adminId: varchar("admin_id").references(() => users.id, { onDelete: "set null" }), // Admin who made manual adjustment
  hotmartTransactionId: varchar("hotmart_transaction_id"), // Hotmart transaction code for webhook_renewal idempotency
  usedAt: timestamp("used_at").defaultNow().notNull(),
}, (table) => ({
  consumptionIdx: index("idx_token_usage_log_consumption")
    .on(table.userId, table.toolType, table.usedAt)
    .where(sql`${table.tokensUsed} < 0`),
  timelineIdx: index("idx_token_usage_log_timeline")
    .on(table.userId, table.usedAt)
    .where(sql`${table.tokensUsed} < 0`),
}));

export const insertTokenUsageLogSchema = createInsertSchema(tokenUsageLog).omit({
  id: true,
  usedAt: true,
});

export type TokenUsageLog = typeof tokenUsageLog.$inferSelect;
export type InsertTokenUsageLog = z.infer<typeof insertTokenUsageLogSchema>;

// Token pricing configuration - defines pricing per tool
export const tokenPricingConfig = pgTable("token_pricing_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  toolType: varchar("tool_type").notNull().unique(), // 'chatbot' | 'classifier'
  toolName: text("tool_name").notNull(), // Display name
  toolDescription: text("tool_description"), // Description for pricing page
  tokensPerUnit: integer("tokens_per_unit").notNull(), // How many tokens per use
  unitDescription: text("unit_description"), // "por mensagem" | "por análise"
  icon: text("icon"), // Icon name from lucide
  isActive: boolean("is_active").default(true).notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTokenPricingConfigSchema = createInsertSchema(tokenPricingConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TokenPricingConfig = typeof tokenPricingConfig.$inferSelect;
export type InsertTokenPricingConfig = z.infer<typeof insertTokenPricingConfigSchema>;

// Token balance response type for API
export interface TokenBalanceResponse {
  balance: number;         // total (plan + extras) — kept for backward compatibility
  planBalance: number;     // tokens from active plan (reset monthly)
  extrasBalance: number;   // purchased extra tokens (accumulate, 60-day expiry)
  lastRenewalAt: Date;
  nextRenewalAt: string; // Calculated: for Hotmart users = next_charge_date from Hotmart; for non-Hotmart = lastRenewalAt + 30 days; as "YYYY-MM-DD" date-only string (no timezone)
  hideTokenBadge?: boolean;
  extrasExpiresAt?: Date;  // Expiration date of the oldest active extras batch
}

// Consolidated token usage per tool
export interface TokenUsageSummary {
  toolType: string;
  totalTokensUsed: number;
  usageCount: number;
}

// Token history entry for admin view
export interface TokenHistoryEntry {
  id: string;
  toolType: string;
  tokensUsed: number;
  balanceAfter: number | null;
  description: string | null;
  adminId: string | null;
  adminName: string | null;
  usedAt: Date;
}

// Admin token adjustment request
export interface AdminTokenAdjustment {
  amount: number;
  action: 'add' | 'remove';
  description?: string;
}

// ===================== PENDING TOKEN PURCHASES =====================
// Stores token purchases for buyers whose email is not yet registered

export const pendingTokenPurchases = pgTable("pending_token_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: text("transaction_id").notNull().unique(),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name"),
  tokensAmount: integer("tokens_amount").notNull().default(200000),
  priceInCents: integer("price_in_cents").notNull().default(2990),
  hotmartEvent: text("hotmart_event"), // PURCHASE_APPROVED, PURCHASE_COMPLETE, etc.
  rawPayload: jsonb("raw_payload").$type<Record<string, any>>(),
  status: text("status").notNull().default('pending'), // pending | processed | cancelled
  blockedFreeTier: boolean("blocked_free_tier").default(false).notNull(), // True when blocked because user is on free tier
  processedAt: timestamp("processed_at"),
  processedByUserId: varchar("processed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPendingTokenPurchaseSchema = createInsertSchema(pendingTokenPurchases).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type PendingTokenPurchase = typeof pendingTokenPurchases.$inferSelect;
export type InsertPendingTokenPurchase = z.infer<typeof insertPendingTokenPurchaseSchema>;

// ===================== METHODOLOGICAL BOOKS (LIVROS METODOLÓGICOS) =====================

export const books = pgTable("books", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"), // Max 30 words description
  coverUrl: text("cover_url"), // Cover image URL from object storage
  type: varchar("type").notNull().default("academy"), // 'academy' | 'external'
  link: text("link"), // External link (required for external books, optional for academy)
  order: integer("order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  createdAt: true,
}).extend({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().max(300, "Descrição deve ter no máximo 300 caracteres").optional(),
  type: z.enum(["academy", "external"]),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;

// Book Suggestions - User submitted book recommendations
export const bookSuggestions = pgTable("book_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  link: text("link").notNull(),
  status: varchar("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookSuggestionSchema = createInsertSchema(bookSuggestions).omit({
  id: true,
  createdAt: true,
  status: true,
}).extend({
  title: z.string().min(1, "Título é obrigatório"),
  link: z.string().url("Link deve ser uma URL válida"),
});

export type BookSuggestion = typeof bookSuggestions.$inferSelect;
export type InsertBookSuggestion = z.infer<typeof insertBookSuggestionSchema>;

// ===================== TOOL USAGE ANALYTICS (RELATÓRIOS DE USO DE FERRAMENTAS) =====================

// Unified tool usage log - tracks all tool usage for analytics
export const toolUsageLog = pgTable("tool_usage_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Tool identification
  toolType: varchar("tool_type").notNull(), // 'classifier' | 'effect_size' | 'power_analysis' | 'chatbot' | 'glossary' | 'library' | 'books'
  actionType: varchar("action_type").notNull(), // 'interaction' | 'calculation' | 'completion' | 'search' | 'view' | 'click'
  
  // Context (varies by tool)
  subType: varchar("sub_type"), // test type, calculator type, etc.
  targetId: varchar("target_id"), // termId, articleId, bookId, lessonId, etc.
  searchQuery: text("search_query"), // search term if action is search
  metadata: jsonb("metadata").$type<Record<string, any>>(), // Additional context
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userToolIdx: uniqueIndex("tool_usage_user_tool_idx").on(table.userId, table.toolType, table.createdAt),
  toolTypeIdx: uniqueIndex("tool_usage_tool_type_idx").on(table.toolType, table.createdAt),
}));

export const insertToolUsageLogSchema = createInsertSchema(toolUsageLog).omit({
  id: true,
  createdAt: true,
});

export type ToolUsageLog = typeof toolUsageLog.$inferSelect;
export type InsertToolUsageLog = z.infer<typeof insertToolUsageLogSchema>;

// Tool types enum for consistency
export const TOOL_TYPES = {
  CLASSIFIER: 'classifier',
  EFFECT_SIZE: 'effect_size', 
  POWER_ANALYSIS: 'power_analysis',
  SYNTAX_GENERATOR: 'syntax_generator',
  CHATBOT: 'chatbot',
  GLOSSARY: 'glossary',
  LIBRARY: 'library',
  BOOKS: 'books',
} as const;

// Action types enum for consistency
export const ACTION_TYPES = {
  INTERACTION: 'interaction', // Each step/message in classifier
  CALCULATION: 'calculation', // Each calculation performed
  COMPLETION: 'completion', // Full flow completed (report generated)
  SEARCH: 'search', // Search performed
  VIEW: 'view', // Item viewed
  CLICK: 'click', // Link/DOI clicked
  SAVE: 'save', // Result saved
} as const;

export type ToolType = typeof TOOL_TYPES[keyof typeof TOOL_TYPES];
export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

// ===================== DAILY WATCH TRACKING (POST-EXPIRATION VIDEO LIMITS) =====================

export const dailyWatchTracking = pgTable("daily_watch_tracking", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  watchDate: date("watch_date").defaultNow().notNull(),
  minutesWatched: integer("minutes_watched").default(0).notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserDate: unique().on(table.userId, table.watchDate),
}));

export type DailyWatchTracking = typeof dailyWatchTracking.$inferSelect;

// ===================== EMAIL TEMPLATES =====================

// Email template types
export const EMAIL_TEMPLATE_TYPES = {
  // User-facing templates
  WELCOME: 'welcome',
  WELCOME_FREE: 'welcome_free',
  VERIFICATION_CODE: 'verification_code',
  PASSWORD_RESET: 'password_reset',
  NEW_PASSWORD_ADMIN: 'new_password_admin',
  CONTENT_RELEASED: 'content_released',
  INVITATION_SIGNUP: 'invitation_signup',
  CERTIFICATE_COMPLETION: 'certificate_completion',
  COMMENT_REPLIED: 'comment_replied',
  INSTITUTIONAL_INVITE: 'institutional_invite',
  INSTITUTIONAL_WELCOME: 'institutional_welcome',
  INSTITUTIONAL_MANAGER_WELCOME: 'institutional_manager_welcome',
  INSTITUTIONAL_PASSWORD_RESEND: 'institutional_password_resend',
  // Admin/internal notification templates
  ADMIN_NEW_COMMENT: 'admin_new_comment',
  ADMIN_FEATURE_SUGGESTION: 'admin_feature_suggestion',
  ADMIN_BOOK_SUGGESTION: 'admin_book_suggestion',
  ADMIN_GLOSSARY_SUGGESTION: 'admin_glossary_suggestion',
  ADMIN_INSTITUTIONAL_REQUEST: 'admin_institutional_request',
  ADMIN_SUPPORT: 'admin_support',
} as const;

export type EmailTemplateType = typeof EMAIL_TEMPLATE_TYPES[keyof typeof EMAIL_TEMPLATE_TYPES];

// Email Templates table
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull().unique(), // 'welcome' | 'content_released' | 'invitation_signup' | 'certificate_completion'
  name: text("name").notNull(), // Display name (e.g., "Boas vindas")
  description: text("description"), // Description of what the email does
  subject: text("subject").notNull(), // Email subject line
  body: text("body").notNull(), // Email body (HTML with template tags)
  isActive: boolean("is_active").default(true).notNull(), // Whether the email is enabled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  type: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type UpdateEmailTemplate = z.infer<typeof updateEmailTemplateSchema>;

// ===================== BROADCAST NOTIFICATIONS =====================

// Status types for broadcast notifications
export const BROADCAST_NOTIFICATION_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENT: 'sent',
} as const;

export type BroadcastNotificationStatus = typeof BROADCAST_NOTIFICATION_STATUS[keyof typeof BROADCAST_NOTIFICATION_STATUS];

// Recurrence types for broadcast notifications
export const BROADCAST_RECURRENCE_TYPE = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  SEMIANNUAL: 'semiannual',
  ANNUAL: 'annual',
} as const;

export type BroadcastRecurrenceType = typeof BROADCAST_RECURRENCE_TYPE[keyof typeof BROADCAST_RECURRENCE_TYPE];

// Zod schemas for recurrence config by type
export const dailyRecurrenceConfigSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato deve ser HH:MM"),
});

export const weeklyRecurrenceConfigSchema = z.object({
  weekday: z.number().min(0).max(6), // 0 = domingo, 6 = sábado
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato deve ser HH:MM"),
});

export const biweeklyRecurrenceConfigSchema = z.object({
  weekday: z.number().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato deve ser HH:MM"),
});

export const monthlyRecurrenceConfigSchema = z.object({
  day: z.number().min(1).max(31),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato deve ser HH:MM"),
});

export const semiannualRecurrenceConfigSchema = z.object({
  startDate: z.string(), // YYYY-MM-DD
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato deve ser HH:MM"),
});

export const annualRecurrenceConfigSchema = z.object({
  day: z.number().min(1).max(31),
  month: z.number().min(1).max(12),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Formato deve ser HH:MM"),
});

// Union type for recurrence config
export type DailyRecurrenceConfig = z.infer<typeof dailyRecurrenceConfigSchema>;
export type WeeklyRecurrenceConfig = z.infer<typeof weeklyRecurrenceConfigSchema>;
export type BiweeklyRecurrenceConfig = z.infer<typeof biweeklyRecurrenceConfigSchema>;
export type MonthlyRecurrenceConfig = z.infer<typeof monthlyRecurrenceConfigSchema>;
export type SemiannualRecurrenceConfig = z.infer<typeof semiannualRecurrenceConfigSchema>;
export type AnnualRecurrenceConfig = z.infer<typeof annualRecurrenceConfigSchema>;

export type RecurrenceConfig = 
  | DailyRecurrenceConfig 
  | WeeklyRecurrenceConfig 
  | BiweeklyRecurrenceConfig 
  | MonthlyRecurrenceConfig 
  | SemiannualRecurrenceConfig 
  | AnnualRecurrenceConfig;

// Audience filters for broadcast notifications, banners and popups.
// Free-Trial (trial) and Alunos (plans) are mutually-exclusive populations and are
// combined with OR (union). Papel acadêmico (academic) and Sexo (gender) refine the
// resulting population with AND. Options within a category = OR. empty/null = all active users.
export const audienceFiltersSchema = z.object({
  // Free trial status filters: 'active' (active sub on default-signup tier) | 'expired' (had it, no longer active)
  trial: z.array(z.enum(['active', 'expired'])).optional(),
  // Subscription tier IDs the user has an active subscription on. Special token 'eternos'
  // matches all tiers whose name contains [ETERNOS] or [PERPÉTUO].
  plans: z.array(z.string()).optional(),
  // Academic coordinator role: 'research_coord' (only research group), 'phd_coord' (only PPG), 'both' (both flags true)
  academic: z.array(z.enum(['research_coord', 'phd_coord', 'both'])).optional(),
  // Gender filters
  gender: z.array(z.enum(['male', 'female'])).optional(),
}).nullable();

export type AudienceFilters = z.infer<typeof audienceFiltersSchema>;

// Broadcast notifications table for admin-created notifications sent to all users
export const broadcastNotifications = pgTable("broadcast_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  linkUrl: text("link_url"), // Optional URL to redirect when clicked
  status: varchar("status").default("draft").notNull(), // 'draft' | 'scheduled' | 'sent' | 'recurring'
  scheduledAt: timestamp("scheduled_at"), // When to send (null = immediately when status changes to sent) - mutually exclusive with isRecurring
  sentAt: timestamp("sent_at"), // When actually sent (for one-time) or last sent (for recurring)
  recipientCount: integer("recipient_count").default(0), // Number of users who received it (cumulative for recurring)
  // Recurrence fields
  isRecurring: boolean("is_recurring").default(false).notNull(), // If true, scheduledAt is ignored
  recurrenceType: varchar("recurrence_type"), // 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'semiannual' | 'annual'
  recurrenceConfig: text("recurrence_config"), // JSON string with type-specific config
  nextRunAt: timestamp("next_run_at"), // Next scheduled execution for recurring broadcasts
  lastSentAt: timestamp("last_sent_at"), // Last time the recurring broadcast was sent
  sendCount: integer("send_count").default(0), // Number of times a recurring broadcast has been sent
  // Audience targeting filters - null/empty = all active users
  audienceFilters: jsonb("audience_filters").$type<AudienceFilters>().default(null),
  createdById: varchar("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBroadcastNotificationSchema = createInsertSchema(broadcastNotifications).omit({
  id: true,
  sentAt: true,
  recipientCount: true,
  nextRunAt: true,
  lastSentAt: true,
  sendCount: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBroadcastNotificationSchema = createInsertSchema(broadcastNotifications).omit({
  id: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type BroadcastNotification = typeof broadcastNotifications.$inferSelect;
export type InsertBroadcastNotification = z.infer<typeof insertBroadcastNotificationSchema>;
export type UpdateBroadcastNotification = z.infer<typeof updateBroadcastNotificationSchema>;

// ===================== INSTITUTIONAL MODULE =====================

// Status types for institutional requests
export const INSTITUTIONAL_REQUEST_STATUS = {
  NEW: 'new',
  IN_CONTACT: 'in_contact',
  CONVERTED: 'converted',
  ARCHIVED: 'archived',
} as const;

export type InstitutionalRequestStatus = typeof INSTITUTIONAL_REQUEST_STATUS[keyof typeof INSTITUTIONAL_REQUEST_STATUS];

// Role types for institutional requests
export const INSTITUTIONAL_ROLE_TYPES = {
  RESEARCH_GROUP_COORDINATOR: 'research_group_coordinator',
  PPG_COORDINATOR: 'ppg_coordinator',
  OTHER: 'other',
} as const;

export type InstitutionalRoleType = typeof INSTITUTIONAL_ROLE_TYPES[keyof typeof INSTITUTIONAL_ROLE_TYPES];

// Institution types
export const INSTITUTION_TYPES = {
  RESEARCH_GROUP: 'research_group',
  PPG: 'ppg',
  OTHER: 'other',
} as const;

export type InstitutionType = typeof INSTITUTION_TYPES[keyof typeof INSTITUTION_TYPES];

// Institutional user status
export const INSTITUTIONAL_USER_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REMOVED: 'removed',
} as const;

export type InstitutionalUserStatus = typeof INSTITUTIONAL_USER_STATUS[keyof typeof INSTITUTIONAL_USER_STATUS];

// Institutional requests table (public form submissions - leads)
export const institutionalRequests = pgTable("institutional_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  institution: text("institution"), // Institution name
  role: varchar("role").notNull(), // 'research_group_coordinator' | 'ppg_coordinator' | 'other'
  roleOther: text("role_other"), // Required when role is 'other'
  groupSize: varchar("group_size"), // legacy: '0-5' | '5-10' | '10-20' | '20+' (derivado de `seats` para novos leads)
  seats: integer("seats"), // Número exato de vagas escolhido na calculadora
  selectedPlan: varchar("selected_plan"), // 'pro' | 'premium'
  message: text("message").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  contactPreference: varchar("contact_preference"), // 'whatsapp' | 'email'
  status: varchar("status").default("new").notNull(), // 'new' | 'in_contact' | 'converted' | 'archived'
  convertedToClientId: varchar("converted_to_client_id"), // Reference to institutional_clients if converted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInstitutionalRequestSchema = createInsertSchema(institutionalRequests).omit({
  id: true,
  status: true,
  convertedToClientId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1, "Nome é obrigatório"),
  institution: z.string().min(1, "Instituição é obrigatória"),
  role: z.enum(["research_group_coordinator", "ppg_coordinator", "research_leader", "other"]),
  roleOther: z.string().optional(),
  groupSize: z.enum(["0-5", "5-10", "10-20", "20+"]).optional(),
  seats: z.coerce.number().int().min(1, "Informe ao menos 1 vaga"),
  selectedPlan: z.enum(["pro", "premium"]).default("pro"),
  message: z.string().min(10, "Descreva brevemente sua solicitação"),
  email: z.string().email("Email inválido"),
  phone: phoneE164Required,
  contactPreference: z.enum(["whatsapp", "email"]),
});

export type InstitutionalRequest = typeof institutionalRequests.$inferSelect;
export type InsertInstitutionalRequest = z.infer<typeof insertInstitutionalRequestSchema>;

// Institutional clients table (active contracts)
export const institutionalClients = pgTable("institutional_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  institutionName: text("institution_name").notNull(),
  institutionType: varchar("institution_type").notNull(), // 'research_group' | 'ppg' | 'other'
  institutionTypeOther: text("institution_type_other"), // Required when type is 'other'
  managerUserId: varchar("manager_user_id").references(() => users.id, { onDelete: "set null" }), // The user who manages this institution
  managerName: text("manager_name").notNull(),
  managerEmail: text("manager_email").notNull(),
  managerPhone: text("manager_phone"),
  totalSlots: integer("total_slots").notNull().default(0), // Total contracted slots
  usedSlots: integer("used_slots").notNull().default(0), // Currently used slots
  tierId: varchar("tier_id").references(() => subscriptionTiers.id, { onDelete: "set null" }), // Contracted plan (subscription tier). Null = plan not defined yet -> institutional access grants NOTHING until set.
  isActive: boolean("is_active").default(true).notNull(),
  contractStartDate: timestamp("contract_start_date"), // Contract start date
  contractEndDate: timestamp("contract_end_date"), // Contract expiration date
  notes: text("notes"), // Admin internal notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInstitutionalClientSchema = createInsertSchema(institutionalClients).omit({
  id: true,
  managerUserId: true,
  usedSlots: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  institutionName: z.string().min(1, "Nome da instituição é obrigatório"),
  institutionType: z.enum(["research_group", "ppg", "other"]),
  institutionTypeOther: z.string().nullable().optional(),
  managerName: z.string().min(1, "Nome do responsável é obrigatório"),
  managerEmail: z.string().email("Email inválido"),
  managerPhone: z.string().nullable().optional(),
  totalSlots: z.number().min(1, "Quantidade de vagas deve ser pelo menos 1"),
  tierId: z.string().min(1, "Selecione o plano da instituição"),
  isActive: z.boolean().default(true),
  notes: z.string().nullable().optional(),
  contractStartDate: z.coerce.date().nullable().optional(),
  contractEndDate: z.coerce.date().nullable().optional(),
});

export const updateInstitutionalClientSchema = createInsertSchema(institutionalClients).omit({
  id: true,
  managerUserId: true,
  usedSlots: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  institutionTypeOther: z.string().nullable().optional(),
  managerPhone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tierId: z.string().min(1, "Selecione o plano da instituição"),
  contractStartDate: z.coerce.date().nullable().optional(),
  contractEndDate: z.coerce.date().nullable().optional(),
}).partial();

export type InstitutionalClient = typeof institutionalClients.$inferSelect;
export type InsertInstitutionalClient = z.infer<typeof insertInstitutionalClientSchema>;
export type UpdateInstitutionalClient = z.infer<typeof updateInstitutionalClientSchema>;

// Institutional users table (users linked to an institution)
export const institutionalUsers = pgTable("institutional_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  institutionalClientId: varchar("institutional_client_id").references(() => institutionalClients.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // Null until user activates account
  email: text("email").notNull(),
  name: text("name").notNull(),
  cpf: text("cpf"),
  phone: text("phone"),
  status: varchar("status").default("pending").notNull(), // 'pending' | 'active' | 'expired' | 'removed'
  accessExpiresAt: timestamp("access_expires_at"), // Only admin can set this
  inviteToken: text("invite_token"), // Token for password setup
  inviteTokenExpiresAt: timestamp("invite_token_expires_at"),
  invitedAt: timestamp("invited_at").defaultNow(),
  activatedAt: timestamp("activated_at"), // When user set password and activated
  consentAcknowledgedAt: timestamp("consent_acknowledged_at"),
  consentVersion: varchar("consent_version", { length: 50 }),
  invitedById: varchar("invited_by_id").references(() => users.id), // Manager or admin who invited
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInstitutionalUserSchema = createInsertSchema(institutionalUsers).omit({
  id: true,
  institutionalClientId: true,
  userId: true,
  status: true,
  inviteToken: true,
  inviteTokenExpiresAt: true,
  invitedAt: true,
  activatedAt: true,
  consentAcknowledgedAt: true,
  consentVersion: true,
  invitedById: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  email: z.string().email("Email inválido"),
  name: z.string().min(1, "Nome é obrigatório"),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  accessExpiresAt: z.date().optional(),
});

export const updateInstitutionalUserSchema = createInsertSchema(institutionalUsers).omit({
  id: true,
  institutionalClientId: true,
  userId: true,
  inviteToken: true,
  inviteTokenExpiresAt: true,
  invitedAt: true,
  activatedAt: true,
  consentAcknowledgedAt: true,
  consentVersion: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type InstitutionalUser = typeof institutionalUsers.$inferSelect;
export type InsertInstitutionalUser = z.infer<typeof insertInstitutionalUserSchema>;
export type UpdateInstitutionalUser = z.infer<typeof updateInstitutionalUserSchema>;

// ========== APP VERSIONING ==========
// App versions table - main version records
export const appVersions = pgTable("app_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  version: varchar("version").notNull().unique(),
  releaseDate: timestamp("release_date").notNull(),
  description: text("description"),
  commitHash: varchar("commit_hash"),
  isVisible: boolean("is_visible").default(false).notNull(),
  isHidden: boolean("is_hidden").default(false).notNull(),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// App version items table - individual changes within a version
export const appVersionItems = pgTable("app_version_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  versionId: varchar("version_id").references(() => appVersions.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type").notNull(), // "correction" | "improvement" | "feature"
  title: text("title").notNull(),
  description: text("description"),
  createdById: varchar("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertAppVersionSchema = createInsertSchema(appVersions).omit({
  id: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  version: z.string().min(1, "Número da versão é obrigatório").regex(/^[\d.]+$/, "Use apenas números e pontos (ex: 1.0.0)"),
  releaseDate: z.coerce.date(),
  description: z.string().optional(),
  commitHash: z.string().optional(),
  isVisible: z.boolean().default(false),
  isHidden: z.boolean().default(false),
  items: z.array(z.object({
    type: z.enum(["correction", "improvement", "feature"]),
    title: z.string().min(1),
    description: z.string().optional(),
  })).optional(),
});

export const updateAppVersionSchema = createInsertSchema(appVersions).omit({
  id: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  version: z.string().min(1, "Número da versão é obrigatório").regex(/^[\d.]+$/, "Use apenas números e pontos").optional(),
  releaseDate: z.coerce.date().optional(),
  description: z.string().nullable().optional(),
  commitHash: z.string().nullable().optional(),
  isVisible: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  items: z.array(z.object({
    type: z.enum(["correction", "improvement", "feature"]),
    title: z.string().min(1),
    description: z.string().optional(),
  })).optional(),
}).partial();

export const insertAppVersionItemSchema = createInsertSchema(appVersionItems).omit({
  id: true,
  versionId: true,
  createdById: true,
  createdAt: true,
}).extend({
  type: z.enum(["correction", "improvement", "feature"]),
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
});

export type AppVersion = typeof appVersions.$inferSelect;
export type InsertAppVersion = z.infer<typeof insertAppVersionSchema>;
export type UpdateAppVersion = z.infer<typeof updateAppVersionSchema>;
export type AppVersionItem = typeof appVersionItems.$inferSelect;
export type InsertAppVersionItem = z.infer<typeof insertAppVersionItemSchema>;

// ========== GERADOR DE SINTAXE (USER DATASETS) ==========

// Variable statistics for numeric variables
export const variableStatsSchema = z.object({
  mean: z.number().optional(),
  sd: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  median: z.number().optional(),
  q1: z.number().optional(),
  q3: z.number().optional(),
});

// Variable metadata schema
export const variableMetadataSchema = z.object({
  name: z.string(),
  type: z.enum(["numeric", "categorical", "date", "text"]),
  stats: variableStatsSchema.optional(),
  levels: z.array(z.string()).optional(),
  levelCounts: z.record(z.string(), z.number()).optional(),
  missing: z.number().default(0),
  missingPct: z.number().default(0),
  unique: z.number().optional(),
});

// Dataset summary schema (sent to AI)
export const datasetSummarySchema = z.object({
  rows: z.number(),
  columns: z.number(),
  variables: z.array(variableMetadataSchema),
  sampleRows: z.array(z.record(z.string(), z.any())).optional(),
  diagnostics: z.object({
    hasOutliers: z.boolean().optional(),
    hasDuplicates: z.boolean().optional(),
    zeroVarianceColumns: z.array(z.string()).optional(),
  }).optional(),
});

export type VariableStats = z.infer<typeof variableStatsSchema>;
export type VariableMetadata = z.infer<typeof variableMetadataSchema>;
export type DatasetSummary = z.infer<typeof datasetSummarySchema>;

// User datasets table - stores uploaded data files
export const userDatasets = pgTable("user_datasets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  rowCount: integer("row_count"),
  columnCount: integer("column_count"),
  columnMetadata: jsonb("column_metadata").$type<VariableMetadata[]>(),
  datasetSummary: jsonb("dataset_summary").$type<DatasetSummary>(),
  status: varchar("status", { length: 20 }).default("processing").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (table) => ({
  userIdx: index("user_datasets_user_idx").on(table.userId),
  statusIdx: index("user_datasets_status_idx").on(table.status),
}));

// Dataset conversations table - chat history for each dataset (supports up to 3 tabs per dataset)
export const datasetConversations = pgTable("dataset_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  datasetId: varchar("dataset_id").references(() => userDatasets.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).default("Conversa 1").notNull(),
  tabIndex: integer("tab_index").default(0).notNull(), // 0, 1, or 2 (max 3 tabs)
  messages: jsonb("messages").$type<Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    generatedCode?: string; // Store R code blocks separately for easy access
  }>>().default([]),
  lastGeneratedCode: text("last_generated_code"), // Store the most recent R code for context
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  datasetIdx: index("dataset_conversations_dataset_idx").on(table.datasetId),
  datasetTabIdx: index("dataset_conversations_dataset_tab_idx").on(table.datasetId, table.tabIndex),
}));

// Insert schemas
export const insertUserDatasetSchema = createInsertSchema(userDatasets).omit({
  id: true,
  createdAt: true,
  lastAccessedAt: true,
  expiresAt: true,
}).extend({
  fileName: z.string().min(1, "Nome do arquivo é obrigatório"),
  fileSize: z.number().min(1).max(10 * 1024 * 1024, "Arquivo deve ter no máximo 10MB"),
  storageKey: z.string().min(1, "Chave de armazenamento é obrigatória"),
  status: z.enum(["processing", "ready", "error"]).default("processing"),
});

export const updateUserDatasetSchema = createInsertSchema(userDatasets).omit({
  id: true,
  userId: true,
  createdAt: true,
}).partial();

export const insertDatasetConversationSchema = createInsertSchema(datasetConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserDataset = typeof userDatasets.$inferSelect;
export type InsertUserDataset = z.infer<typeof insertUserDatasetSchema>;
export type UpdateUserDataset = z.infer<typeof updateUserDatasetSchema>;
export type DatasetConversation = typeof datasetConversations.$inferSelect;
export type InsertDatasetConversation = z.infer<typeof insertDatasetConversationSchema>;
export type DatasetMessage = { role: "user" | "assistant"; content: string; timestamp: string; generatedCode?: string; };

// Syntax Generator conversations table - standalone conversations without dataset requirement
// Supports two isolated modes: "free" (no dataset) and "dataset" (with dataset attached)
// Each mode has up to 3 conversations, for a total of 6 conversations per user
export const syntaxGeneratorConversations = pgTable("syntax_generator_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  datasetId: varchar("dataset_id").references(() => userDatasets.id, { onDelete: "set null" }), // Only used in dataset mode
  mode: varchar("mode", { length: 20 }).default("free").notNull(), // "free" or "dataset" - determines which tab section
  name: varchar("name", { length: 100 }).default("Conversa 1").notNull(),
  tabIndex: integer("tab_index").default(0).notNull(), // 0, 1, or 2 (max 3 tabs per mode)
  threadId: varchar("thread_id", { length: 100 }), // DEPRECATED: OpenAI Assistant thread ID (legacy)
  lastResponseId: varchar("last_response_id", { length: 100 }), // OpenAI Responses API - last response ID for conversation continuity
  messages: jsonb("messages").$type<Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    generatedCode?: string;
  }>>().default([]),
  lastGeneratedCode: text("last_generated_code"),
  // Rolling summary of older turns. Built proactively when an estimate of the
  // conversation's token footprint approaches the model's context window. It is
  // re-injected into the model `instructions` every turn (not into the stored
  // chain), preserving continuity after the chain is rotated.
  summary: text("summary"),
  // Index into `messages` where the CURRENT Responses API chain begins. After a
  // proactive/reactive rotation the stored chain is reset, so only the turns from
  // this index onward are actually in the model's context. Used to estimate the
  // ACTIVE chain footprint (not the full persisted transcript) for token budgeting.
  chainStartIndex: integer("chain_start_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("syntax_gen_conv_user_idx").on(table.userId),
  userModeTabIdx: index("syntax_gen_conv_user_mode_tab_idx").on(table.userId, table.mode, table.tabIndex),
}));

export const insertSyntaxGeneratorConversationSchema = createInsertSchema(syntaxGeneratorConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SyntaxGeneratorConversation = typeof syntaxGeneratorConversations.$inferSelect;
export type InsertSyntaxGeneratorConversation = z.infer<typeof insertSyntaxGeneratorConversationSchema>;

// ============================================================================
// ADMIN ERROR MONITORING SYSTEM
// Sistema de monitoramento de erros para área administrativa
// ============================================================================

// Admin Error Logs - Individual error occurrences
export const adminErrorLogs = pgTable("admin_error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'backend' | 'validation' | 'database' | 'auth'
  severity: varchar("severity", { length: 20 }).default("error").notNull(), // 'warning' | 'error' | 'critical'
  message: text("message").notNull(),
  stack: text("stack"),
  endpoint: varchar("endpoint", { length: 255 }),
  method: varchar("method", { length: 10 }),
  statusCode: integer("status_code"),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").$type<{
    query?: Record<string, any>;
    body?: Record<string, any>;
    headers?: Record<string, string>;
    duration?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  fingerprintIdx: index("admin_error_logs_fingerprint_idx").on(table.fingerprint),
  createdAtIdx: index("admin_error_logs_created_at_idx").on(table.createdAt),
  endpointIdx: index("admin_error_logs_endpoint_idx").on(table.endpoint),
  // Composite index to accelerate the latestSeverity correlated subquery
  // (ORDER BY created_at DESC LIMIT 1 WHERE fingerprint = ?)
  fingerprintCreatedAtIdx: index("admin_error_logs_fp_created_at_idx").on(table.fingerprint, table.createdAt),
  // Composite index to accelerate the EXISTS severity filter in getErrorGroups
  fingerprintSeverityIdx: index("admin_error_logs_fp_severity_idx").on(table.fingerprint, table.severity),
}));

export const insertAdminErrorLogSchema = createInsertSchema(adminErrorLogs).omit({
  id: true,
  createdAt: true,
});

export type AdminErrorLog = typeof adminErrorLogs.$inferSelect;
export type InsertAdminErrorLog = z.infer<typeof insertAdminErrorLogSchema>;

// Admin Error Groups - Grouped errors by fingerprint
export const adminErrorGroups = pgTable("admin_error_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull(),
  message: text("message").notNull(),
  endpoint: varchar("endpoint", { length: 255 }),
  status: varchar("status", { length: 20 }).default("open").notNull(), // 'open' | 'resolved' | 'ignored'
  occurrenceCount: integer("occurrence_count").default(1).notNull(),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  // Track when last frequency-based notification was sent (to avoid spam)
  lastFrequencyNotifiedAt: timestamp("last_frequency_notified_at"),
  // Track when last burst-threshold email alert was sent (Hotmart webhook critical errors).
  // Used to enforce a cooldown window after a burst alert is dispatched.
  lastBurstEmailSentAt: timestamp("last_burst_email_sent_at"),
}, (table) => ({
  statusIdx: index("admin_error_groups_status_idx").on(table.status),
  lastSeenIdx: index("admin_error_groups_last_seen_idx").on(table.lastSeenAt),
}));

export const insertAdminErrorGroupSchema = createInsertSchema(adminErrorGroups).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
  resolvedAt: true,
  lastFrequencyNotifiedAt: true,
  lastBurstEmailSentAt: true,
});

export type AdminErrorGroup = typeof adminErrorGroups.$inferSelect;
export type InsertAdminErrorGroup = z.infer<typeof insertAdminErrorGroupSchema>;

// Admin Error Notes - Multiple notes per error group
export const adminErrorNotes = pgTable("admin_error_notes", {
  id: serial("id").primaryKey(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull().references(() => adminErrorGroups.fingerprint, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  fingerprintIdx: index("admin_error_notes_fingerprint_idx").on(table.fingerprint),
  createdAtIdx: index("admin_error_notes_created_at_idx").on(table.createdAt),
}));

export const insertAdminErrorNoteSchema = createInsertSchema(adminErrorNotes).omit({
  id: true,
  createdAt: true,
});

export type AdminErrorNote = typeof adminErrorNotes.$inferSelect;
export type InsertAdminErrorNote = z.infer<typeof insertAdminErrorNoteSchema>;

// Admin Webhook Logs - Logging for webhook events (Hotmart, etc.)
export const adminWebhookLogs = pgTable("admin_webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: varchar("source", { length: 50 }).notNull(), // 'hotmart' | 'stripe' | 'other'
  eventType: varchar("event_type", { length: 100 }).notNull(),
  payload: jsonb("payload").$type<Record<string, any>>(),
  status: varchar("status", { length: 20 }).default("received").notNull(), // 'received' | 'processing' | 'success' | 'failed'
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index("admin_webhook_logs_source_idx").on(table.source),
  statusIdx: index("admin_webhook_logs_status_idx").on(table.status),
  createdAtIdx: index("admin_webhook_logs_created_at_idx").on(table.createdAt),
}));

export const insertAdminWebhookLogSchema = createInsertSchema(adminWebhookLogs).omit({
  id: true,
  createdAt: true,
});

export type AdminWebhookLog = typeof adminWebhookLogs.$inferSelect;
export type InsertAdminWebhookLog = z.infer<typeof insertAdminWebhookLogSchema>;

export const platformUpdates = pgTable("platform_updates", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlatformUpdateSchema = createInsertSchema(platformUpdates).omit({
  id: true,
  createdAt: true,
});

export type PlatformUpdate = typeof platformUpdates.$inferSelect;
export type InsertPlatformUpdate = z.infer<typeof insertPlatformUpdateSchema>;

// ─── Behavioral Tracking (Trial) ──────────────────────────────────────────────
// 100% isolated from tool_usage_log, user_activities, SubscriptionExpirationService

export const TRIAL_EVENT_NAMES = [
  'tool_calculadora_amostral_used',
  'tool_calculadora_amostral_saved',
  'tool_calculadora_amostral_downloaded',
  'tool_precisao_amostral_used',
  'tool_tamanho_efeito_used',
  'tool_tamanho_efeito_saved',
  'tool_tamanho_efeito_downloaded',
  'tool_classificador_ia_used',
  'tool_gerador_r_used',
  'tool_gerador_r_dataset_uploaded',
  'tool_gerador_r_downloaded',
  'tool_glossario_used',
  'tool_biblioteca_used',
  'tool_chatbot_ia_used',
  'support_question_opened',
  'support_question_replied_by_user',
  'support_chatbot_aulas_used',
  'intent_visited_pricing',
  'intent_visited_certificates',
  'intent_hit_paywall',
] as const;

export type TrialEventName = typeof TRIAL_EVENT_NAMES[number];

export const trialEvents = pgTable("trial_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  eventDetail: varchar("event_detail", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("trial_events_user_id_idx").on(table.userId),
  userEventIdx: index("trial_events_user_event_idx").on(table.userId, table.eventType),
  userCreatedIdx: index("trial_events_user_created_idx").on(table.userId, table.createdAt),
  createdAtIdx: index("trial_events_created_at_idx").on(table.createdAt),
}));

export const insertTrialEventSchema = createInsertSchema(trialEvents).omit({
  id: true,
  createdAt: true,
});

export type TrialEvent = typeof trialEvents.$inferSelect;
export type InsertTrialEvent = z.infer<typeof insertTrialEventSchema>;

export const trialScores = pgTable("trial_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  totalScore: integer("total_score").notNull(),
  breakdown: jsonb("breakdown").$type<Record<string, number>>().notNull(),
  engagementTier: varchar("engagement_tier", { length: 20 }).notNull(),
  lastModuleAccessed: varchar("last_module_accessed", { length: 255 }),
  datasetUploaded: boolean("dataset_uploaded").default(false),
  savedResult: boolean("saved_result").default(false),
  downloadedResult: boolean("downloaded_result").default(false),
  isActiveOnLastDay: boolean("is_active_on_last_day").default(false),
  syncedToAc: boolean("synced_to_ac").default(false).notNull(),
  acSyncedAt: timestamp("ac_synced_at"),
  acContactId: varchar("ac_contact_id", { length: 50 }),
  wabaSubtagApplied: varchar("waba_subtag_applied", { length: 50 }),
  wabaAppliedAt: timestamp("waba_applied_at"),
  appliedTags: text("applied_tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => ({
  userIdx: uniqueIndex("trial_scores_user_id_idx").on(table.userId),
  engagementTierIdx: index("trial_scores_engagement_tier_idx").on(table.engagementTier),
  syncedIdx: index("trial_scores_synced_idx").on(table.syncedToAc),
  wabaSubtagIdx: index("trial_scores_waba_subtag_idx").on(table.wabaSubtagApplied),
  appliedTagsIdx: index("trial_scores_applied_tags_idx").using("gin", table.appliedTags),
}));

export const insertTrialScoreSchema = createInsertSchema(trialScores).omit({
  id: true,
  createdAt: true,
});

export type TrialScore = typeof trialScores.$inferSelect;
export type InsertTrialScore = z.infer<typeof insertTrialScoreSchema>;

export const trialSyncErrors = pgTable("trial_sync_errors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  component: varchar("component", { length: 50 }).notNull(),
  errorMessage: text("error_message").notNull(),
  stackTrace: text("stack_trace"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  componentIdx: index("trial_sync_errors_component_idx").on(table.component),
  createdAtIdx: index("trial_sync_errors_created_at_idx").on(table.createdAt),
}));

export const insertTrialSyncErrorSchema = createInsertSchema(trialSyncErrors).omit({
  id: true,
  createdAt: true,
});

export type TrialSyncError = typeof trialSyncErrors.$inferSelect;
export type InsertTrialSyncError = z.infer<typeof insertTrialSyncErrorSchema>;

export const trialAcFieldConfig = pgTable("trial_ac_field_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldName: varchar("field_name", { length: 100 }).notNull(),
  acFieldId: varchar("ac_field_id", { length: 50 }).notNull(),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
}, (table) => ({
  fieldNameIdx: uniqueIndex("trial_ac_field_config_field_name_idx").on(table.fieldName),
}));

export const insertTrialAcFieldConfigSchema = createInsertSchema(trialAcFieldConfig).omit({
  id: true,
  cachedAt: true,
});

export type TrialAcFieldConfig = typeof trialAcFieldConfig.$inferSelect;
export type InsertTrialAcFieldConfig = z.infer<typeof insertTrialAcFieldConfigSchema>;

export interface ScoringConfigData {
  pointsPerDistinctTool: number;
  toolEventPoints?: {
    tool_precisao_amostral_used?: number;
  };
  depthActions: {
    datasetUpload: number;
    savedResult: number;
    downloadedResult: number;
    supportDialog: number;
  };
  pointsPerLesson: number;
  activeDaysThresholds: Array<{ min: number; max: number | null; points: number }>;
  intentSignals: {
    visitedPricing: number;
    visitedCertificates: number;
    hitPaywall: number;
  };
  lastDayTrialAccess: number;
  tierThresholds: {
    baixo: number;
    medio: number;
    alto: number;
  };
}

export const trialScoringConfig = pgTable("trial_scoring_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  config: jsonb("config").$type<ScoringConfigData>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TrialScoringConfig = typeof trialScoringConfig.$inferSelect;

export const rateLimitEvents = pgTable("rate_limit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ip: varchar("ip", { length: 45 }).notNull(),
  route: varchar("route", { length: 255 }).notNull(),
  limiterType: varchar("limiter_type", { length: 50 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ipIdx: index("rate_limit_events_ip_idx").on(table.ip),
  routeIdx: index("rate_limit_events_route_idx").on(table.route),
  limiterTypeIdx: index("rate_limit_events_limiter_type_idx").on(table.limiterType),
  createdAtIdx: index("rate_limit_events_created_at_idx").on(table.createdAt),
  ipCreatedAtIdx: index("rate_limit_events_ip_created_at_idx").on(table.ip, table.createdAt),
}));

export const insertRateLimitEventSchema = createInsertSchema(rateLimitEvents).omit({
  id: true,
  createdAt: true,
});

export type RateLimitEvent = typeof rateLimitEvents.$inferSelect;
export type InsertRateLimitEvent = z.infer<typeof insertRateLimitEventSchema>;

export const rateLimitAlertConfig = pgTable("rate_limit_alert_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  thresholdPerMinute: integer("threshold_per_minute").default(20).notNull(),
  thresholdPerHour: integer("threshold_per_hour").default(100).notNull(),
  alertCooldownMinutes: integer("alert_cooldown_minutes").default(30).notNull(),
  retentionDays: integer("retention_days").default(30).notNull(),
  lastAlertedAt: timestamp("last_alerted_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type RateLimitAlertConfig = typeof rateLimitAlertConfig.$inferSelect;

export const blockedIps = pgTable("blocked_ips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  reason: text("reason").notNull(),
  blockType: varchar("block_type", { length: 20 }).notNull().default("temporary"),
  violationCount: integer("violation_count").notNull().default(0),
  blockedAt: timestamp("blocked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  blockedBy: varchar("blocked_by").references(() => users.id),
  unblockedAt: timestamp("unblocked_at"),
  unblockedBy: varchar("unblocked_by").references(() => users.id),
  active: boolean("active").notNull().default(true),
  lastAutoBlockAlertAt: timestamp("last_auto_block_alert_at"),
}, (table) => ({
  ipIdx: index("blocked_ips_ip_idx").on(table.ipAddress),
  activeIdx: index("blocked_ips_active_idx").on(table.active),
  // Task #473: índice UNIQUE parcial criado pela migration
  // ensure-blocked-ips-active-unique.ts. Declarado aqui para sobreviver ao
  // `drizzle-kit push --force` do post-merge. Garante a barreira atômica do
  // ON CONFLICT em createBlockedIp contra duplicatas (Task #449).
  activeIpUniq: uniqueIndex("blocked_ips_active_ip_uniq")
    .on(table.ipAddress)
    .where(sql`active = true`),
}));

export const insertBlockedIpSchema = createInsertSchema(blockedIps).omit({
  id: true,
  blockedAt: true,
  unblockedAt: true,
  unblockedBy: true,
  lastAutoBlockAlertAt: true,
});

export type BlockedIp = typeof blockedIps.$inferSelect;
export type InsertBlockedIp = z.infer<typeof insertBlockedIpSchema>;

// Pesos default por limiterType — multiplicam a contagem de violações para
// compor o "score" ponderado. Tipos mais perigosos (brute-force, e-mail,
// operações caras) pesam mais; polling público pesa pouco.
export const DEFAULT_LIMITER_WEIGHTS: Record<string, number> = {
  auth: 5,
  email: 3,
  expensive: 3,
  chat: 2,
  sync: 2,
  error_report: 1,
  public_api: 1,
  public_config: 1,
  admin_api: 1,
};

// Escalonamento default da duração do auto-block: 1ª ofensa = 1h, 2ª = 6h,
// 3ª ou mais (na janela `escalationLookbackDays`) = 24h.
export const DEFAULT_ESCALATION_DURATIONS_HOURS: number[] = [1, 6, 24];

export const ipBlockConfig = pgTable("ip_block_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  perTypeThreshold: integer("per_type_threshold").notNull().default(20),
  // `totalThreshold` agora representa o teto da SOMA PONDERADA (count *
  // weightsByType[type]). Default 50 mantém comportamento original quando
  // todos os pesos são 1.
  totalThreshold: integer("total_threshold").notNull().default(50),
  windowMinutes: integer("window_minutes").notNull().default(60),
  // `blockDurationHours` ainda existe como teto/legado, mas a duração real
  // é escolhida em `escalationDurationsHours` segundo o histórico do IP.
  blockDurationHours: integer("block_duration_hours").notNull().default(24),
  violationsRetentionDays: integer("violations_retention_days").notNull().default(90),
  blocksRetentionDays: integer("blocks_retention_days").notNull().default(90),
  alertCooldownMinutes: integer("alert_cooldown_minutes").notNull().default(30),
  // Mapa limiterType → peso (inteiro >=0). 0 desabilita esse tipo no auto-block.
  weightsByType: jsonb("weights_by_type").$type<Record<string, number>>().notNull().default(DEFAULT_LIMITER_WEIGHTS),
  // Janela (em dias) usada para escalonar a duração: contamos quantas vezes
  // o mesmo IP já foi auto-blocked aqui dentro.
  escalationLookbackDays: integer("escalation_lookback_days").notNull().default(7),
  // Sequência de durações em horas. `[1, 6, 24]` significa: 0 bloqueios
  // anteriores → 1h, 1 anterior → 6h, 2+ anteriores → 24h.
  escalationDurationsHours: jsonb("escalation_durations_hours").$type<number[]>().notNull().default(DEFAULT_ESCALATION_DURATIONS_HOURS),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  singletonKey: text("singleton_key").notNull().default('singleton').unique(),
});

export type IpBlockConfig = typeof ipBlockConfig.$inferSelect;

export const ipAllowlist = pgTable("ip_allowlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipOrCidr: varchar("ip_or_cidr", { length: 60 }).notNull().unique(),
  description: text("description"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIpAllowlistSchema = createInsertSchema(ipAllowlist).omit({
  id: true,
  createdAt: true,
});

export type IpAllowlistEntry = typeof ipAllowlist.$inferSelect;
export type InsertIpAllowlistEntry = z.infer<typeof insertIpAllowlistSchema>;

export const rateLimitViolations = pgTable("rate_limit_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  limiterType: varchar("limiter_type", { length: 50 }).notNull(),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  userAgent: text("user_agent"),
}, (table) => ({
  ipIdx: index("rate_limit_violations_ip_idx").on(table.ipAddress),
  occurredAtIdx: index("rate_limit_violations_occurred_at_idx").on(table.occurredAt),
}));

export const insertRateLimitViolationSchema = createInsertSchema(rateLimitViolations).omit({
  id: true,
  occurredAt: true,
});

export type RateLimitViolation = typeof rateLimitViolations.$inferSelect;
export type InsertRateLimitViolation = z.infer<typeof insertRateLimitViolationSchema>;

// ============================================
// ONBOARDING SPECIAL ENTRIES
// ============================================
// Stores configurable "special" cards in the onboarding popup/panel
// (e.g. the "Estou começando do Zero" recommended card).
// Each row is identified by a unique key (e.g. 'zero').

export const onboardingSpecialEntries = pgTable("onboarding_special_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  enabled: boolean("enabled").default(true).notNull(),
  label: text("label").notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  // CTA routing — same shape as `onboarding_popup_courses` so admins can
  // configure where the special entry's "Ir para curso" button leads.
  hrefMode: text("href_mode").notNull().default('vitrine'),
  vitrineSlug: text("vitrine_slug"),
  hrefUrl: text("href_url"),
  categoryId: varchar("category_id").references(() => categories.id, { onDelete: 'set null' }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const updateOnboardingSpecialEntrySchema = createInsertSchema(onboardingSpecialEntries)
  .pick({
    enabled: true,
    label: true,
    description: true,
    videoUrl: true,
    hrefMode: true,
    vitrineSlug: true,
    hrefUrl: true,
    categoryId: true,
  })
  .partial()
  .extend({
    videoUrl: z
      .string()
      .url()
      .regex(
        /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{6,}/,
        'URL deve ser do YouTube (watch?v=, youtu.be/ ou embed/)',
      )
      .nullable()
      .optional(),
    hrefMode: z.enum(['vitrine', 'url', 'category']).optional(),
    vitrineSlug: z.string().nullable().optional(),
    hrefUrl: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // Same consistency rule used for `onboarding_popup_courses`: if any
    // link-related field is provided, hrefMode must be declared and the
    // corresponding field must be valid (URL passes the absolute/internal
    // path check from `isValidPopupCourseHrefUrl`).
    const linkFieldProvided =
      data.hrefMode !== undefined ||
      data.vitrineSlug !== undefined ||
      data.hrefUrl !== undefined ||
      data.categoryId !== undefined;

    if (!linkFieldProvided) return;

    if (data.hrefMode === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hrefMode'],
        message: 'Para alterar vitrineSlug, hrefUrl ou categoryId, informe também o hrefMode correspondente',
      });
      return;
    }

    refinePopupCourseLink(data, ctx);
  });

export type OnboardingSpecialEntry = typeof onboardingSpecialEntries.$inferSelect;
export type UpdateOnboardingSpecialEntry = z.infer<typeof updateOnboardingSpecialEntrySchema>;

/**
 * Public API contract for GET /api/onboarding/special/:key.
 *
 * Same `resolvedHref` enrichment pattern as `OnboardingPopupCoursePublic`:
 * the server resolves the destination so consumers do not need to query
 * `/api/product-tabs` or `/api/categories`. When the destination cannot
 * be resolved, `resolvedHref` is omitted.
 */
export type OnboardingSpecialEntryPublic = OnboardingSpecialEntry & {
  resolvedHref?: string;
};

// Singleton settings row controlling whether each onboarding FAB
// (rocket → "Primeiros Passos"; compass → "Por onde começar?")
// is rendered in the student area. Hiding the compass FAB does NOT
// disable the auto-open popup for new users — those flows live in
// OnboardingLauncher and only consult `profileCompleted`/`onboardingSeen`.
export const onboardingFabVisibility = pgTable("onboarding_fab_visibility", {
  id: varchar("id").primaryKey().default('singleton'),
  showRocketFab: boolean("show_rocket_fab").default(true).notNull(),
  showCompassFab: boolean("show_compass_fab").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const updateOnboardingFabVisibilitySchema = createInsertSchema(onboardingFabVisibility)
  .pick({ showRocketFab: true, showCompassFab: true })
  .partial();

export type OnboardingFabVisibility = typeof onboardingFabVisibility.$inferSelect;
export type UpdateOnboardingFabVisibility = z.infer<typeof updateOnboardingFabVisibilitySchema>;

// ============================================================================
// EXTERNALLY-MANAGED TABLES — declared here ONLY to prevent `drizzle-kit push
// --force` (rodado por scripts/post-merge.sh após cada merge) de considerá-las
// "extras" e dropá-las silenciosamente. Não são manipuladas pelo app via
// Drizzle ORM — toda interação acontece via SQL bruto (`db.execute(sql\`…\`)`)
// ou por bibliotecas externas. Por isso não exportamos insertSchema nem
// types — só a definição estrutural é necessária para o diff do drizzle-kit
// passar limpo.
//
// IMPORTANTE: a estrutura aqui declarada precisa casar 1:1 com a estrutura
// real em produção (validado via information_schema). Qualquer divergência
// dispara ALTER/DROP destrutivo no próximo deploy. Os nomes de PK foram
// escolhidos para casar com prod (não com o nome que drizzle geraria por
// padrão).
// ============================================================================

// Gerenciada pelo `connect-pg-simple` (store do express-session).
// PK em prod chama-se `session_pkey` (legado da convenção antiga do
// connect-pg-simple, quando a tabela se chamava `session`). Em ambientes onde
// a PK ainda chama `user_sessions_pkey`, a migração runtime
// `ensure-orphan-tables-pk-naming` faz o rename no boot ANTES do db:push.
export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid").notNull(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.sid], name: "session_pkey" }),
  expireIdx: index("IDX_user_sessions_expire").on(t.expire),
}));

// Markers internos para inicializações one-shot (ex: seed de
// `onboarding_popup_courses`). Criada e populada por SQL bruto em
// `server/routes.ts:initializeOnboardingPopupCourses`. A migração runtime
// `ensure-orphan-tables-pk-naming` garante que ela exista no boot, mesmo se
// um db:push anterior tiver dropado.
export const systemBootstrapMarkers = pgTable("system_bootstrap_markers", {
  key: text("key").notNull(),
  setAt: timestamp("set_at", { precision: 6 }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.key], name: "system_bootstrap_markers_pkey" }),
}));

// ============================================================================
// Task #505: Effect Size Calculator Ratings (star ratings per calculator)
// ============================================================================

export const EFFECT_SIZE_CALCULATOR_KEYS = [
  "cohens_d",
  "glass_delta",
  "hedges_g",
  "eta_squared",
  "omega_squared",
  "cramers_v",
  "phi",
  "cohens_w",
  "cohens_f",
  "cohens_f2",
  "odds_ratio",
  "risk_ratio",
  "hazard_ratio",
  "nnt",
  "standardized_beta",
] as const;

export type EffectSizeCalculatorKey = (typeof EFFECT_SIZE_CALCULATOR_KEYS)[number];

export const EFFECT_SIZE_CALCULATOR_LABELS: Record<EffectSizeCalculatorKey, string> = {
  cohens_d: "d de Cohen",
  glass_delta: "Δ de Glass",
  hedges_g: "g de Hedges",
  eta_squared: "η² (Eta²)",
  omega_squared: "ω² (Omega²)",
  cramers_v: "V de Cramér",
  phi: "Phi (φ)",
  cohens_w: "w de Cohen",
  cohens_f: "f de Cohen",
  cohens_f2: "f² de Cohen",
  odds_ratio: "Odds Ratio",
  risk_ratio: "Risk Ratio",
  hazard_ratio: "Hazard Ratio",
  nnt: "NNT",
  standardized_beta: "Beta Padronizado",
};

export const effectSizeCalculatorRatings = pgTable("effect_size_calculator_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  calculatorKey: text("calculator_key").notNull(),
  rating: integer("rating").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const effectSizeCalculatorPromptState = pgTable("effect_size_calculator_prompt_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  calculatorKey: text("calculator_key").notNull(),
  successfulCalculationCount: integer("successful_calculation_count").notNull().default(0),
  // Snapshot do `successfulCalculationCount` no instante em que o usuário
  // avaliou ou dispensou o popup. Usado para exigir um NOVO uso da MESMA
  // ferramenta após o cooldown — o popup só volta se
  // `successfulCalculationCount > interactionAtCount` E o cooldown já passou.
  interactionAtCount: integer("interaction_at_count").notNull().default(0),
  dismissedAt: timestamp("dismissed_at"),
  ratedAt: timestamp("rated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userCalculatorUnique: unique("effect_size_calc_prompt_user_calc_unique").on(t.userId, t.calculatorKey),
}));

export const effectSizeRatingSettings = pgTable("effect_size_rating_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  calculationsThreshold: integer("calculations_threshold").notNull().default(3),
  dismissCooldownDays: integer("dismiss_cooldown_days").notNull().default(60),
  // Task #576: atraso (ms) entre o backend liberar o prompt e a abertura
  // real do popup. 0 = imediato. Default 4000 preserva o comportamento
  // hardcoded anterior nas 15 calculadoras de TE.
  popupDelayMs: integer("popup_delay_ms").notNull().default(4000),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  singletonCheck: check("effect_size_rating_settings_id_singleton", sql`${table.id} = 1`),
}));

export const insertEffectSizeCalculatorRatingSchema = createInsertSchema(effectSizeCalculatorRatings).pick({
  userId: true,
  calculatorKey: true,
  rating: true,
}).extend({
  rating: z.number().int().min(1).max(5),
  calculatorKey: z.enum(EFFECT_SIZE_CALCULATOR_KEYS),
});

export const updateEffectSizeRatingSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  calculationsThreshold: z.number().int().min(1).optional(),
  dismissCooldownDays: z.number().int().min(1).optional(),
  // Task #576: 0 ≤ delay ≤ 60000 ms (1 minuto). 0 = popup imediato.
  popupDelayMs: z.number().int().min(0).max(60000).optional(),
});

export type EffectSizeCalculatorRating = typeof effectSizeCalculatorRatings.$inferSelect;
export type EffectSizeCalculatorPromptState = typeof effectSizeCalculatorPromptState.$inferSelect;
export type EffectSizeRatingSettings = typeof effectSizeRatingSettings.$inferSelect;
export type InsertEffectSizeCalculatorRating = z.infer<typeof insertEffectSizeCalculatorRatingSchema>;
export type UpdateEffectSizeRatingSettings = z.infer<typeof updateEffectSizeRatingSettingsSchema>;

// =====================================================================
// Task #569 — Generalized tool rating keys (Effect Size + Classificador
// e futuras ferramentas). A tabela `effect_size_calculator_ratings` é
// reutilizada (coluna `calculator_key` aceita qualquer toolKey); as
// configurações de threshold/cooldown/enabled por ferramenta ficam em
// `tool_rating_settings`. Para preservar a UI atual das calculadoras de
// TE, a tabela legada `effect_size_rating_settings` continua sendo a
// fonte para todas as chaves EFFECT_SIZE_CALCULATOR_KEYS (config
// compartilhada). Chaves novas (ex.: 'classificador') usam linhas
// próprias em `tool_rating_settings`.
// =====================================================================
export const RATING_TOOL_KEYS = [
  ...EFFECT_SIZE_CALCULATOR_KEYS,
  "classificador",
  "poder_amostral",
  "precisao_amostral",
  "gerador_sintaxe",
] as const;

export type RatingToolKey = (typeof RATING_TOOL_KEYS)[number];

export const RATING_TOOL_LABELS: Record<string, string> = {
  ...EFFECT_SIZE_CALCULATOR_LABELS,
  classificador: "Classificador de Análise",
  poder_amostral: "Calculadora Amostral (Por Poder Estatístico)",
  precisao_amostral: "Calculadora Amostral (Por Precisão de Estimativa)",
  gerador_sintaxe: "Gerador de Sintaxe R",
};

export const toolRatingSettings = pgTable("tool_rating_settings", {
  toolKey: text("tool_key").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  calculationsThreshold: integer("calculations_threshold").notNull().default(1),
  dismissCooldownDays: integer("dismiss_cooldown_days").notNull().default(60),
  // Task #576: idêntico à coluna em effect_size_rating_settings.
  popupDelayMs: integer("popup_delay_ms").notNull().default(4000),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const updateToolRatingSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  calculationsThreshold: z.number().int().min(1).optional(),
  dismissCooldownDays: z.number().int().min(1).optional(),
  popupDelayMs: z.number().int().min(0).max(60000).optional(),
});

export type ToolRatingSettings = typeof toolRatingSettings.$inferSelect;
export type UpdateToolRatingSettings = z.infer<typeof updateToolRatingSettingsSchema>;

// ============================================================================
// Task #606 — Backups automáticos do banco com cópia externa
// Registra cada execução de backup (auto/manual) com lock por ambiente
// (índice único parcial em status='running') para evitar runs concorrentes.
// ============================================================================
export const dbBackups = pgTable("db_backups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  environment: text("environment").notNull(), // 'development' | 'production'
  status: text("status").notNull(), // 'running' | 'success' | 'partial' | 'failed'
  source: text("source").notNull(), // 'auto' | 'manual'
  triggeredBy: varchar("triggered_by"), // userId for manual runs
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  durationMs: integer("duration_ms"),
  sizeBytes: integer("size_bytes"),
  objectPath: text("object_path"), // Replit Object Storage path
  driveFileId: text("drive_file_id"),
  driveWebViewLink: text("drive_web_view_link"),
  errorMessage: text("error_message"),
  filename: text("filename"),
}, (table) => ({
  // Lock per environment: only one running backup at a time per env.
  runningUnique: uniqueIndex("db_backups_env_running_unique")
    .on(table.environment)
    .where(sql`status = 'running'`),
  envFinishedIdx: index("db_backups_env_finished_idx").on(table.environment, table.finishedAt),
}));

export type DbBackup = typeof dbBackups.$inferSelect;
export type InsertDbBackup = typeof dbBackups.$inferInsert;

// Singleton config (id=1 enforced via CHECK). Stores the Drive folder ID
// auto-created on first run + timestamps used to dedupe staleness alerts.
export const dbBackupConfig = pgTable("db_backup_config", {
  id: integer("id").primaryKey(),
  driveFolderId: text("drive_folder_id"),
  driveFolderEnvironment: text("drive_folder_environment"),
  notificationEmails: text("notification_emails").array(),
  lastStalenessAlertAt: timestamp("last_staleness_alert_at"),
  lastStalenessAlertEnv: text("last_staleness_alert_env"),
  // Forma 2 (backup oportunista disparado por tráfego): intervalo desejado
  // entre backups automáticos (horas) e o timestamp da última checagem de
  // "backup vencido", usado para throttle entre processos do Autoscale.
  autoBackupIntervalHours: integer("auto_backup_interval_hours").default(24),
  lastAutoCheckAt: timestamp("last_auto_check_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type DbBackupConfig = typeof dbBackupConfig.$inferSelect;
