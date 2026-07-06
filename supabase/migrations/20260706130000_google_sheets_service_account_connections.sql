do $$
begin
  if to_regclass('private.api_connection_oauth_credentials') is not null
     and to_regclass('vault.secrets') is not null then
    delete from vault.secrets as secrets
    using private.api_connection_oauth_credentials as credentials
    where secrets.id = credentials.secret_vault_id;
  end if;
end $$;

drop table if exists private.google_sheets_connection_drafts;

alter table if exists private.api_connections
  drop column if exists oauth_credential_id;

drop table if exists private.api_connection_oauth_credentials;
