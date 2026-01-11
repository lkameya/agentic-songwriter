import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { approvalStore } from '@/lib/agent/core/approval-store';

// Approval request schema
const ApprovalRequestSchema = z.object({
  approvalId: z.string().min(1, 'Approval ID is required'),
  decision: z.enum(['approve', 'reject', 'regenerate']),
  feedback: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { approvalId, decision, feedback } = ApprovalRequestSchema.parse(body);

    console.log(`[Approval API] Received approval request for: ${approvalId}, decision: ${decision}, hasFeedback: ${!!feedback}`);
    const pendingIdsBefore = approvalStore.getPendingIds();
    console.log(`[Approval API] Pending approvals BEFORE resolve:`, pendingIdsBefore);
    console.log(`[Approval API] Request exists: ${approvalStore.hasRequest(approvalId)}`);

    // Resolve the approval with the decision and feedback
    // Note: resolveApproval checks if the request exists internally
    const resolved = approvalStore.resolveApproval(approvalId, decision, feedback);

    if (!resolved) {
      console.error(`[Approval API] Failed to resolve approval: ${approvalId}`);
      console.error(`[Approval API] Available IDs at time of failure:`, approvalStore.getPendingIds());
      return NextResponse.json(
        { 
          error: 'Approval request not found or already resolved',
          approvalId,
          availableIds: approvalStore.getPendingIds(),
        },
        { status: 404 }
      );
    }

    console.log(`[Approval API] Successfully resolved approval: ${approvalId}`, { decision, hasFeedback: !!feedback });
    return NextResponse.json({
      success: true,
      decision,
      feedback,
      approvalId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
