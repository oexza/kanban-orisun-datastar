-- Add board_created_id column to boards table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'boards' AND column_name = 'board_created_id'
    ) THEN
        ALTER TABLE "boards" ADD COLUMN "board_created_id" text;
    END IF;
END $$;

-- Add board_list_created_id column to lists table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lists' AND column_name = 'board_list_created_id'
    ) THEN
        ALTER TABLE "lists" ADD COLUMN "board_list_created_id" text;
    END IF;
END $$;

-- Add unique constraint on board_created_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'boards_board_created_id_unique'
        AND table_name = 'boards'
    ) THEN
        ALTER TABLE "boards" ADD CONSTRAINT "boards_board_created_id_unique" UNIQUE("board_created_id");
    END IF;
END $$;

-- Add unique constraint on board_list_created_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'lists_board_list_created_id_unique'
        AND table_name = 'lists'
    ) THEN
        ALTER TABLE "lists" ADD CONSTRAINT "lists_board_list_created_id_unique" UNIQUE("board_list_created_id");
    END IF;
END $$;