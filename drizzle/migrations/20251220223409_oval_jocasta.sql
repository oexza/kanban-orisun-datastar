CREATE TABLE IF NOT EXISTS "boards" (
                                        "id" text PRIMARY KEY NOT NULL,
                                        "title" text NOT NULL,
                                        "description" text,
                                        "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "card_tags" (
                                           "card_id" text NOT NULL,
                                           "tag_id" text NOT NULL,
                                           CONSTRAINT "card_tags_card_id_tag_id_pk" PRIMARY KEY("card_id","tag_id")
    );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cards" (
                                       "id" text PRIMARY KEY NOT NULL,
                                       "list_id" text NOT NULL,
                                       "title" text NOT NULL,
                                       "description" text,
                                       "assignee_id" text,
                                       "position" integer NOT NULL,
                                       "completed" boolean DEFAULT false,
                                       "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
                                          "id" text PRIMARY KEY NOT NULL,
                                          "card_id" text NOT NULL,
                                          "user_id" text NOT NULL,
                                          "text" text NOT NULL,
                                          "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lists" (
                                       "id" text PRIMARY KEY NOT NULL,
                                       "board_id" text NOT NULL,
                                       "title" text NOT NULL,
                                       "position" integer NOT NULL,
                                       "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projector_checkpoint" (
                                                      "id" text PRIMARY KEY NOT NULL,
                                                      "name" text NOT NULL,
                                                      "commit_position" numeric NOT NULL,
                                                      "prepare_position" numeric NOT NULL,
                                                      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "projector_checkpoint_name_unique" UNIQUE("name")
    );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
                                      "id" text PRIMARY KEY NOT NULL,
                                      "name" text NOT NULL,
                                      "color" text NOT NULL,
                                      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
                                       "id" text PRIMARY KEY NOT NULL,
                                       "name" text NOT NULL
);
--> statement-breakpoint
-- Add foreign key constraints (idempotent)
DO $$
BEGIN
    -- card_tags foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'card_tags_card_id_cards_id_fk') THEN
ALTER TABLE "card_tags" ADD CONSTRAINT "card_tags_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'card_tags_tag_id_tags_id_fk') THEN
ALTER TABLE "card_tags" ADD CONSTRAINT "card_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
END IF;

    -- cards foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cards_list_id_lists_id_fk') THEN
ALTER TABLE "cards" ADD CONSTRAINT "cards_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;
END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cards_assignee_id_users_id_fk') THEN
ALTER TABLE "cards" ADD CONSTRAINT "cards_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
END IF;

    -- comments foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comments_card_id_cards_id_fk') THEN
ALTER TABLE "comments" ADD CONSTRAINT "comments_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;
END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comments_user_id_users_id_fk') THEN
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
END IF;

    -- lists foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'lists_board_id_boards_id_fk') THEN
ALTER TABLE "lists" ADD CONSTRAINT "lists_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;
END IF;
END $$;
--> statement-breakpoint

-- Create indexes (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'card_tags_card_id_idx') THEN
CREATE INDEX "card_tags_card_id_idx" ON "card_tags" USING btree ("card_id");
END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'card_tags_tag_id_idx') THEN
CREATE INDEX "card_tags_tag_id_idx" ON "card_tags" USING btree ("tag_id");
END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'cards_list_id_idx') THEN
CREATE INDEX "cards_list_id_idx" ON "cards" USING btree ("list_id");
END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'cards_position_idx') THEN
CREATE INDEX "cards_position_idx" ON "cards" USING btree ("position");
END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'cards_assignee_id_idx') THEN
CREATE INDEX "cards_assignee_id_idx" ON "cards" USING btree ("assignee_id");
END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'comments_card_id_idx') THEN
CREATE INDEX "comments_card_id_idx" ON "comments" USING btree ("card_id");
END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'comments_user_id_idx') THEN
CREATE INDEX "comments_user_id_idx" ON "comments" USING btree ("user_id");
END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'comments_created_at_idx') THEN
CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'lists_board_id_idx') THEN
CREATE INDEX "lists_board_id_idx" ON "lists" USING btree ("board_id");
END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'lists_position_idx') THEN
CREATE INDEX "lists_position_idx" ON "lists" USING btree ("position");
END IF;
END $$;