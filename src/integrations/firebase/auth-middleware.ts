import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { verifyIdToken } from "./admin.server";

// Available for any server function that needs a verified caller uid (none of
// the current server functions require it — generateExplainer/askAi are
// stateless — but this is kept for parity with the old
// requireSupabaseAuth and for future use).
export const requireFirebaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    if (!request?.headers) throw new Error("Unauthorized: No request headers available");

    const authHeader = request.headers.get("authorization");
    if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized: No token provided");

    let decoded;
    try {
      decoded = await verifyIdToken(token);
    } catch {
      throw new Error("Unauthorized: Invalid token");
    }
    if (!decoded.uid) throw new Error("Unauthorized: No user ID found in token");

    return next({
      context: { userId: decoded.uid, claims: decoded },
    });
  },
);
