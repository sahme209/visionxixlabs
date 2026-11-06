-- REVIEW ONLY. Tool transaction owns BEGIN/COMMIT; no execution authorized.
SET TRANSACTION READ ONLY;

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

SET LOCAL statement_timeout='30s';

SET LOCAL lock_timeout='5s';

SET LOCAL idle_in_transaction_session_timeout='60s';

SELECT current_database() AS database,current_user AS role,current_setting('server_version_num')::integer AS server_version_num,current_setting('transaction_read_only') AS read_only,current_setting('transaction_isolation') AS isolation;

SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,character_maximum_length,collation_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('PipelineAICallReservation','PipelineStageRun','PipelineRun','AIUsageReservation') ORDER BY table_name,ordinal_position LIMIT 300;

SELECT c.relname AS table_name,i.relname AS index_name,x.indisunique,x.indisprimary,x.indisvalid,pg_get_indexdef(x.indexrelid) AS definition FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_class i ON i.oid=x.indexrelid WHERE n.nspname='public' AND c.relname IN ('PipelineAICallReservation','PipelineStageRun','PipelineRun','AIUsageReservation') ORDER BY c.relname,i.relname LIMIT 150;

SELECT c.relname AS table_name,k.conname,k.contype,k.convalidated,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('PipelineAICallReservation','PipelineStageRun','PipelineRun','AIUsageReservation') ORDER BY c.relname,k.conname LIMIT 150;

SELECT migration_name,CASE WHEN rolled_back_at IS NOT NULL THEN 'rolled_back' WHEN finished_at IS NOT NULL THEN 'finished' ELSE 'unfinished' END AS status,applied_steps_count FROM public._prisma_migrations ORDER BY migration_name LIMIT 100;

SELECT count(*) AS migration_count FROM public._prisma_migrations;

SELECT 'PipelineAICallReservation' AS relation,status,count(*) AS rows FROM public."PipelineAICallReservation" GROUP BY status UNION ALL SELECT 'AIUsageReservation',status,count(*) FROM public."AIUsageReservation" GROUP BY status UNION ALL SELECT 'PipelineRun',status,count(*) FROM public."PipelineRun" GROUP BY status UNION ALL SELECT 'PipelineStageRun',status,count(*) FROM public."PipelineStageRun" GROUP BY status ORDER BY relation,status LIMIT 100;

SELECT backend_type,state,wait_event_type,count(*) AS sessions,max(EXTRACT(EPOCH FROM (clock_timestamp()-xact_start)))::bigint AS oldest_transaction_seconds FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() GROUP BY backend_type,state,wait_event_type ORDER BY backend_type,state,wait_event_type LIMIT 50;

SELECT c.relname AS table_name,l.mode,l.granted,count(*) AS locks FROM pg_locks l JOIN pg_class c ON c.oid=l.relation JOIN pg_namespace n ON n.oid=c.relnamespace WHERE l.database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND n.nspname='public' AND c.relname IN ('PipelineAICallReservation','PipelineStageRun','PipelineRun','AIUsageReservation') GROUP BY c.relname,l.mode,l.granted ORDER BY c.relname,l.mode,l.granted LIMIT 100;
