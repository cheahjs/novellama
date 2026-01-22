-- Data Repair Script for Chapter Count Inconsistencies
-- Run this on your novellama.db SQLite database

-- First, let's see which novels have inconsistent chapter counts
SELECT 
    n.id,
    n.title,
    n.chapterCount AS stored_count,
    COUNT(c.id) AS actual_count,
    MAX(c.number) AS max_chapter_number,
    n.readingChapterNumber
FROM novels n
LEFT JOIN chapters c ON n.id = c.novelId
GROUP BY n.id
HAVING n.chapterCount != COUNT(c.id);

-- Fix all chapter counts to match the actual number of chapter rows
UPDATE novels 
SET chapterCount = (
    SELECT COUNT(*) 
    FROM chapters 
    WHERE chapters.novelId = novels.id
);

-- Verify the fix
SELECT 
    n.id,
    n.title,
    n.chapterCount AS stored_count,
    COUNT(c.id) AS actual_count,
    MAX(c.number) AS max_chapter_number
FROM novels n
LEFT JOIN chapters c ON n.id = c.novelId
GROUP BY n.id;
