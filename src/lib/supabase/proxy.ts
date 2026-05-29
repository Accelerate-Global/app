import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  clearProxiedIdentityHeaders,
  setProxiedIdentityHeaders,
} from "@/lib/auth-identity-headers";
import { logError } from "@/lib/error-logging";
import { getSupabaseConfig, hasSupabaseConfig } from "@/lib/supabase/config";
import { getWorkspaceRole } from "@/lib/workspace-role";

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const responseHeaders = new Headers();
  let refreshedCookies: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];

  clearProxiedIdentityHeaders(requestHeaders);

  function buildResponse() {
    const nextResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    refreshedCookies.forEach(({ name, value, options }) => {
      nextResponse.cookies.set(name, value, options);
    });

    responseHeaders.forEach((value, key) => {
      nextResponse.headers.set(key, value);
    });

    return nextResponse;
  }

  let response = buildResponse();

  if (!hasSupabaseConfig()) {
    return response;
  }

  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        refreshedCookies = cookiesToSet;

        Object.entries(headers).forEach(([key, value]) => {
          responseHeaders.set(key, value);
        });

        response = buildResponse();
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const fullName =
        typeof user.user_metadata?.full_name === "string" &&
          user.user_metadata.full_name.trim()
          ? user.user_metadata.full_name.trim()
          : null;

      setProxiedIdentityHeaders(requestHeaders, {
        ownerId: user.id,
        email: user.email ?? null,
        fullName,
        workspaceRole: getWorkspaceRole(user.app_metadata?.workspace_role),
      });
    }

    response = buildResponse();
  } catch (error) {
    logError("Failed to refresh Supabase session", error);
  }

  return response;
}
