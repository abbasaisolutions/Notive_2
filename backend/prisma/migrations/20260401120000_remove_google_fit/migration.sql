-- Remove Google Fit integration
-- Drops GoogleFitConnection, HealthContext, and HealthInsight tables

DROP TABLE IF EXISTS "HealthInsight";
DROP TABLE IF EXISTS "HealthContext";
DROP TABLE IF EXISTS "GoogleFitConnection";
