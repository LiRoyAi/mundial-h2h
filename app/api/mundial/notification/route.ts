export const dynamic = "force-dynamic";

// Tournament is over: no notifications or onboarding in the read-only archive.
export function GET() {
  return Response.json({ message: null, showOnboarding: false, newBadgeId: null });
}
