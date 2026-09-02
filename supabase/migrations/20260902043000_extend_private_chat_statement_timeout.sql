-- Preserve all private-chat read-only, cost, row, role, and result-size limits
-- while allowing measured production function scans enough transient-load headroom.
alter role analytics_chat_login set statement_timeout = '10s';
alter role analytics_chat_reader set statement_timeout = '10s';
