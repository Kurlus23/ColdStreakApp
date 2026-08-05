-- Add challenge-tracking columns to plunges table.
-- challenger_user_id: the user whose pending challenge this plunge answers (nullable).
-- challenge_result_sent: flips true once the challenger receives a win/loss push notification.
-- Both columns are additive; existing rows default to NULL / false respectively.
ALTER TABLE plunges ADD COLUMN IF NOT EXISTS challenger_user_id integer;
ALTER TABLE plunges ADD COLUMN IF NOT EXISTS challenge_result_sent boolean NOT NULL DEFAULT false;
