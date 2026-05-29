DO $$
BEGIN
  -- Add enum value if not exists (Postgres doesn't allow easy ALTER TYPE ADD IF NOT EXISTS prior to 13)
  BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'TEST_ASSIGNED';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'TEST_DEADLINE';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'TEST_START_REMINDER';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'TEST_RESUME_REMINDER';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'TEST_SUBMITTED';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'REPORT_PUBLISHED';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'TUTOR_ANNOUNCEMENT';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM_ANNOUNCEMENT';
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  -- Create notifications table if not exists
  CREATE TABLE IF NOT EXISTS "Notification" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" uuid NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" text NOT NULL,
    "body" text,
    "data" jsonb,
    "link" text,
    "read" boolean DEFAULT false,
    "createdAt" timestamptz DEFAULT now()
  );

  -- Add foreign key if not exists
  BEGIN
    ALTER TABLE "Notification" ADD CONSTRAINT fk_notification_user FOREIGN KEY ("userId") REFERENCES "User" (id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;