-- RZ Fixer baseline: NEW, EMPTY databases only. Never replay over existing tables.
-- Ordered: tables and inline constraints, all indexes, then foreign keys.
-- Transaction, target confirmation, schema verification and ledger are handled by scripts/migrate.mjs.

CREATE TABLE "repair_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar(24) NOT NULL,
	"customer_name" varchar(100) NOT NULL,
	"phone" varchar(10) NOT NULL,
	"email" varchar(254) NOT NULL,
	"appliance_type" varchar(64) NOT NULL,
	"problem_description" text NOT NULL,
	"address" text NOT NULL,
	"customer_id" uuid,
	"preferred_date" date,
	"preferred_time" varchar(100),
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"cancellation_reason" text,
	"email_status" varchar(24) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repair_requests_request_id_unique" UNIQUE("request_id")
);

CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" varchar(24) NOT NULL,
	"customer_id" uuid NOT NULL,
	"customer_name" varchar(100) NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(10) NOT NULL,
	"appliance_type" varchar(64) NOT NULL,
	"problem_description" text NOT NULL,
	"preferred_date" date NOT NULL,
	"preferred_time" varchar(100) NOT NULL,
	"address" text NOT NULL,
	"additional_notes" text,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"cancellation_reason" text,
	"email_status" varchar(24) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_booking_id_unique" UNIQUE("booking_id")
);

CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"session_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(64) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);

CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"session_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_session_hash_unique" UNIQUE("session_hash")
);

CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" varchar(24) NOT NULL,
	"customer_id" uuid,
	"request_id" varchar(24),
	"booking_id" varchar(24),
	"customer_name" varchar(100) NOT NULL,
	"customer_email" varchar(254) NOT NULL,
	"appliance_type" varchar(64) NOT NULL,
	"rating" integer NOT NULL,
	"review_message" text NOT NULL,
	"show_first_name" boolean DEFAULT false NOT NULL,
	"is_verified" boolean DEFAULT true NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_review_id_unique" UNIQUE("review_id")
);

CREATE TABLE "review_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"customer_id" uuid,
	"customer_email" varchar(254) NOT NULL,
	"request_id" varchar(24),
	"booking_id" varchar(24),
	"review_id" varchar(24),
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "rate_limit_buckets" (
	"bucket_key" varchar(64) PRIMARY KEY NOT NULL,
	"attempt_timestamps" timestamp with time zone[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);

CREATE TABLE "site_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "repair_requests_customer_id_idx" ON "repair_requests" USING btree ("customer_id");

CREATE INDEX "bookings_customer_id_idx" ON "bookings" USING btree ("customer_id");

CREATE UNIQUE INDEX "customers_email_unique" ON "customers" USING btree ("email");

CREATE UNIQUE INDEX "auth_sessions_hash_unique" ON "auth_sessions" USING btree ("session_hash");

CREATE INDEX "auth_sessions_customer_id_idx" ON "auth_sessions" USING btree ("customer_id");

CREATE UNIQUE INDEX "password_reset_tokens_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");

CREATE INDEX "password_reset_tokens_customer_id_idx" ON "password_reset_tokens" USING btree ("customer_id");

CREATE INDEX "admin_users_username_idx" ON "admin_users" USING btree ("username");

CREATE INDEX "admin_sessions_admin_user_id_idx" ON "admin_sessions" USING btree ("admin_user_id");

CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions" USING btree ("expires_at");

CREATE UNIQUE INDEX "reviews_customer_request_unique" ON "reviews" USING btree ("customer_id","request_id");

CREATE UNIQUE INDEX "reviews_customer_booking_unique" ON "reviews" USING btree ("customer_id","booking_id");

CREATE UNIQUE INDEX "reviews_request_unique" ON "reviews" USING btree ("request_id");

CREATE UNIQUE INDEX "reviews_booking_unique" ON "reviews" USING btree ("booking_id");

CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");

CREATE INDEX "reviews_customer_id_idx" ON "reviews" USING btree ("customer_id");

CREATE UNIQUE INDEX "review_invitations_token_hash_unique" ON "review_invitations" USING btree ("token_hash");

CREATE INDEX "review_invitations_request_id_idx" ON "review_invitations" USING btree ("request_id");

CREATE INDEX "review_invitations_booking_id_idx" ON "review_invitations" USING btree ("booking_id");

CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets" USING btree ("expires_at");

ALTER TABLE "repair_requests" ADD CONSTRAINT "repair_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_request_id_repair_requests_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."repair_requests"("request_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("booking_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_request_id_repair_requests_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."repair_requests"("request_id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_booking_id_bookings_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("booking_id") ON DELETE cascade ON UPDATE no action;
