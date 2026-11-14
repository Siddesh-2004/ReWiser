CREATE TYPE "public"."answer_mode" AS ENUM('audio', 'text');--> statement-breakpoint
CREATE TYPE "public"."notion_item_type" AS ENUM('page', 'database');--> statement-breakpoint
CREATE TYPE "public"."quiz_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"mode" "answer_mode" NOT NULL,
	"transcript" text NOT NULL,
	"correctness_score" real NOT NULL,
	"fluency_score" real,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "answers_question_id_unique" UNIQUE("question_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notion_user_id" text NOT NULL,
	"name" text,
	"email" text,
	"avatar_url" text,
	"notion_workspace_id" text NOT NULL,
	"notion_workspace_name" text,
	"notion_bot_id" text,
	"notion_access_token" text NOT NULL,
	"notion_refresh_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_notion_user_id_unique" UNIQUE("notion_user_id")
);
--> statement-breakpoint
CREATE TABLE "notion_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"notion_id" text NOT NULL,
	"type" "notion_item_type" NOT NULL,
	"title" text NOT NULL,
	"parent_id" uuid,
	"notion_url" text,
	"last_edited_time" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"due_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"difficulty" integer NOT NULL,
	"status" "quiz_status" DEFAULT 'pending' NOT NULL,
	"source_edited_time" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_items" ADD CONSTRAINT "notion_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_items" ADD CONSTRAINT "notion_items_parent_id_notion_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."notion_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_plans" ADD CONSTRAINT "revision_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_plans" ADD CONSTRAINT "revision_plans_item_id_notion_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."notion_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_plan_id_revision_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."revision_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notion_items_user_notion_unique" ON "notion_items" USING btree ("user_id","notion_id");--> statement-breakpoint
CREATE INDEX "notion_items_parent_idx" ON "notion_items" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "revision_plans_user_item_unique" ON "revision_plans" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE INDEX "revision_plans_due_idx" ON "revision_plans" USING btree ("user_id","is_active","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quizzes_plan_round_unique" ON "quizzes" USING btree ("plan_id","round");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_quiz_position_unique" ON "questions" USING btree ("quiz_id","position");