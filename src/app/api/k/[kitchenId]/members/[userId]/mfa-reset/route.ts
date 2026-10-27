import { kitchenRoute } from '@/server/http/kitchen-route';
import {
  resetUserMfaByAdmin,
  MfaRecoveryInputSchema,
} from '@/server/admin/mfa-recovery';
import { HttpError } from '@/server/http/errors';

export const POST = kitchenRoute(
  ['admin'],
  MfaRecoveryInputSchema,
  async ({ user, kitchenId, params, input }) => {
    const targetUserId = params.userId;
    if (!targetUserId) {
      throw new HttpError(400, 'ID pengguna target wajib disertakan.');
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetUserId)) {
      throw new HttpError(400, 'Format ID pengguna target tidak valid.');
    }

    const result = await resetUserMfaByAdmin({
      adminUserId: user.id,
      targetUserId,
      kitchenId,
      reason: input.reason,
    });

    return Response.json(result);
  },
);
