export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function jsonAdminOnlyError(action: string, status = 403) {
  return jsonError(`Only admins can ${action}.`, status);
}
